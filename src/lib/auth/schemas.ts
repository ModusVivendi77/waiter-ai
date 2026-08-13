import { z } from 'zod'

const passwordField = z.string().min(8, 'Password must be at least 8 characters long.')

export const registerRestaurantSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required.'),
    restaurantName: z.string().trim().min(2, 'Restaurant name is required.'),
    email: z.string().trim().email('Enter a valid email address.'),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const passwordResetSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
