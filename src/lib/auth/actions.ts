'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/server'
import { registerRestaurantSchema } from '@/lib/auth/schemas'
import { sendRegistrationEmail } from '@/lib/notifications/email'
import { rateLimit } from '@/lib/utils/rateLimit'

export type RegisterState = {
  error?: string
  success?: string
}

export type VerifyEmailState = {
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

  const { error: membershipError } = await admin.from('restaurant_users').insert({
    restaurant_id: restaurant.id,
    user_id: createdUser.user.id,
    role: 'OWNER',
  })

  if (membershipError) {
    await admin.from('restaurants').delete().eq('id', restaurant.id)
    await admin.auth.admin.deleteUser(createdUser.user.id)
    return { error: membershipError.message }
  }

  // Dispatch the built-in Supabase "Confirm signup" email template to the
  // owner's inbox. The account cannot sign in until the link is confirmed.
  try {
    const { error: resendError } = await admin.auth.resend({ type: 'signup', email })
    if (resendError) {
      console.error('Confirmation email dispatch failed:', resendError.message)
      return { error: 'Account created, but we could not send the confirmation email. Please use the resend option on the verification page.' }
    }
  } catch (error) {
    console.error('Confirmation email dispatch threw:', error)
    return { error: 'Account created, but we could not send the confirmation email. Please use the resend option on the verification page.' }
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

export async function resendConfirmationEmail(_: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  const email = String(formData.get('email') || '').trim()

  if (!email) {
    return { error: 'Email is required.' }
  }

  const limit = rateLimit(`confirm-email:${email.toLowerCase()}`, 3, 10 * 60 * 1000)
  if (!limit.allowed) {
    return { error: 'Too many confirmation emails. Please wait a few minutes and try again.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.resend({ type: 'signup', email })

  if (error) {
    return { error: error.message }
  }

  return { success: 'A new confirmation email has been sent. Check your inbox.' }
}

export async function signOut() {
  redirect('/login')
}
