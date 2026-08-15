'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { registerRestaurantSchema, restaurantNameSchema } from '@/lib/auth/schemas'
import { sendRegistrationEmail } from '@/lib/notifications/email'
import { rateLimit } from '@/lib/utils/rateLimit'
import { requireUser } from '@/lib/auth/guards'

export type RegisterState = {
  error?: string
  success?: string
  /** True when the account was created but the confirmation email could not be delivered yet. */
  emailPending?: boolean
  /** Short human-readable reason the confirmation email was not delivered. */
  emailNotice?: string
}

export type VerifyEmailState = {
  error?: string
  success?: string
}

export type AddRestaurantState = {
  error?: string
  success?: string
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type ConfirmationDispatchResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Delivers the signup confirmation email for an account created via the admin
 * API (which never auto-sends one).
 *
 * Uses Supabase's built-in "Confirm signup" template, the same mechanism the
 * password-reset flow relies on (`resetPasswordForEmail` → built-in "Reset
 * Password" email). The link in that template points at our own
 * `/auth/confirm` route (`auth.confirmRedirect`), so no third-party email
 * provider is involved.
 */
async function dispatchConfirmationEmail(email: string): Promise<ConfirmationDispatchResult> {
  const admin = createAdminClient()
  const { error: resendError } = await admin.auth.resend({ type: 'signup', email })

  if (resendError) {
    return { ok: false, reason: resendError.message }
  }

  return { ok: true }
}

function isEmailRateLimitError(reason: string) {
  return /rate limit/i.test(reason)
}

export async function registerRestaurant(_: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerRestaurantSchema.safeParse({
    fullName: formData.get('fullName'),
    restaurantName: formData.get('restaurantName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Registration failed.' }
  }

  const { fullName, restaurantName, email, password } = parsed.data
  const admin = createAdminClient()
  const slug = slugify(restaurantName)

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      full_name: fullName,
    },
  })

  if (createUserError || !createdUser.user) {
    return { error: createUserError?.message ?? 'Unable to create the user account.' }
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .insert({
      name: restaurantName,
      slug,
    })
    .select('id')
    .single()

  if (restaurantError || !restaurant) {
    await admin.auth.admin.deleteUser(createdUser.user.id)
    return { error: restaurantError?.message ?? 'Unable to create the restaurant profile.' }
  }

  let { error: membershipError } = await admin.from('restaurant_users').insert({
    restaurant_id: restaurant.id,
    user_id: createdUser.user.id,
    role: 'OWNER',
    full_name: fullName,
  })
  if (membershipError?.code === '42703') {
    // `full_name` column not migrated yet — insert without it.
    const retry = await admin.from('restaurant_users').insert({
      restaurant_id: restaurant.id,
      user_id: createdUser.user.id,
      role: 'OWNER',
    })
    membershipError = retry.error
  }

  if (membershipError) {
    await admin.from('restaurants').delete().eq('id', restaurant.id)
    await admin.auth.admin.deleteUser(createdUser.user.id)
    return { error: membershipError.message }
  }

  // Dispatch the signup confirmation email to the owner's inbox via Supabase's
  // built-in "Confirm signup" template. The account cannot sign in until the
  // link in that email is confirmed (handled by /auth/confirm).
  const confirmation = await dispatchConfirmationEmail(email)

  if (!confirmation.ok) {
    // The account exists but the email is not out yet. Route the user to the
    // verify-email page so they can resend once the provider cooldown passes.
    console.error('Confirmation email dispatch failed:', confirmation.reason)
    return {
      success: email,
      emailPending: true,
      emailNotice: isEmailRateLimitError(confirmation.reason)
        ? 'The email provider is temporarily rate-limited.'
        : 'The confirmation email could not be sent.',
    }
  }

  try {
    await sendRegistrationEmail({
      email,
      fullName,
      restaurantName,
    })
  } catch (error) {
    console.error('Registration email dispatch failed:', error)
  }

  revalidatePath('/platform')

  return {
    success: email,
  }
}

/**
 * Lets an already-authenticated user register an additional restaurant. The
 * restaurant is created and the current user is linked as its OWNER. Unlike
 * `registerRestaurant`, no new auth user or email confirmation is involved —
 * the caller's existing session is reused.
 */
export async function addRestaurant(_: AddRestaurantState, formData: FormData): Promise<AddRestaurantState> {
  const parsed = restaurantNameSchema.safeParse({
    restaurantName: formData.get('restaurantName'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Restaurant name is required.' }
  }

  const user = await requireUser()

  const limit = rateLimit(`add-restaurant:${user.id}`, 5, 10 * 60 * 1000)
  if (!limit.allowed) {
    return { error: 'Too many restaurant creations. Please wait a few minutes and try again.' }
  }

  const admin = createAdminClient()
  const slug = slugify(parsed.data.restaurantName)

  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .insert({
      name: parsed.data.restaurantName,
      slug,
    })
    .select('id, name')
    .single()

  if (restaurantError || !restaurant) {
    return { error: restaurantError?.message ?? 'Unable to create the restaurant.' }
  }

  let { error: membershipError } = await admin.from('restaurant_users').insert({
    restaurant_id: restaurant.id,
    user_id: user.id,
    role: 'OWNER',
    full_name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
  })
  if (membershipError?.code === '42703') {
    // `full_name` column not migrated yet — insert without it.
    const retry = await admin.from('restaurant_users').insert({
      restaurant_id: restaurant.id,
      user_id: user.id,
      role: 'OWNER',
    })
    membershipError = retry.error
  }

  if (membershipError) {
    await admin.from('restaurants').delete().eq('id', restaurant.id)
    return { error: membershipError.message }
  }

  revalidatePath('/platform')

  return { success: restaurant.name }
}

export async function resendConfirmationEmail(_: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  const email = String(formData.get('email') || '').trim()

  if (!email) {
    return { error: 'Email is required.' }
  }

  const limit = rateLimit(`confirm-email:${email.toLowerCase()}`, 3, 10 * 60 * 1000)
  if (!limit.allowed) {
    return { error: 'Too many confirmation emails. Please wait a few minutes and try again.' }
  }

  const confirmation = await dispatchConfirmationEmail(email)

  if (!confirmation.ok) {
    console.error('Confirmation email resend failed:', confirmation.reason)
    return {
      error: isEmailRateLimitError(confirmation.reason)
        ? 'The email provider is temporarily rate-limited. Please wait a few minutes and try again.'
        : `Unable to resend the confirmation email: ${confirmation.reason}`,
    }
  }

  return { success: 'A new confirmation email has been sent. Check your inbox.' }
}

export async function signOut() {
  redirect('/login')
}
