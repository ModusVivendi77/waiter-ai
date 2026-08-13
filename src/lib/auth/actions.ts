'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/server'
import { registerRestaurantSchema, verifyEmailSchema } from '@/lib/auth/schemas'
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

  // Send a 6-digit verification code to the owner's email. The account cannot
  // sign in until the code is confirmed at /verify-email.
  try {
    const { error: otpError } = await admin.auth.signInWithOtp({ email })
    if (otpError) {
      console.error('Verification code dispatch failed:', otpError.message)
      return { error: 'Account created, but we could not send the verification code. Please use the resend option on the verification page.' }
    }
  } catch (error) {
    console.error('Verification code dispatch threw:', error)
    return { error: 'Account created, but we could not send the verification code. Please use the resend option on the verification page.' }
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

export async function verifyEmailCode(_: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  const parsed = verifyEmailSchema.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Verification failed.' }
  }

  const { email, code } = parsed.data
  const admin = createAdminClient()

  const { error } = await admin.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  })

  if (error) {
    return { error: 'That verification code is invalid or has expired. Please request a new one.' }
  }

  return {
    success: 'Email verified. You can now sign in with the owner account.',
  }
}

export async function resendVerificationCode(_: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  const email = String(formData.get('email') || '').trim()

  if (!email) {
    return { error: 'Email is required.' }
  }

  const limit = rateLimit(`verify-email:${email.toLowerCase()}`, 3, 10 * 60 * 1000)
  if (!limit.allowed) {
    return { error: 'Too many verification emails. Please wait a few minutes and try again.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.signInWithOtp({ email })

  if (error) {
    return { error: error.message }
  }

  return { success: 'A new verification code has been sent.' }
}

export async function signOut() {
  redirect('/login')
}
