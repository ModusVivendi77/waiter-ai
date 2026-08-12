'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/server'
import { registerRestaurantSchema } from '@/lib/auth/schemas'
import { sendRegistrationEmail } from '@/lib/notifications/email'

export type RegisterState = {
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
    email_confirm: true,
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
    success: 'Restaurant created. You can now sign in with the owner account.',
  }
}

export async function signOut() {
  redirect('/login')
}
