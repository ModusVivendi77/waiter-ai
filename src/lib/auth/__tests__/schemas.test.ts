import { describe, expect, it } from 'vitest'

import { passwordResetSchema, registerRestaurantSchema, verifyEmailSchema } from '@/lib/auth/schemas'

describe('registerRestaurantSchema', () => {
  const validPayload = {
    fullName: 'Jane Owner',
    restaurantName: 'The Green Bar',
    email: 'jane@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  }

  it('accepts a valid registration payload', () => {
    const result = registerRestaurantSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('rejects a full name that is too short', () => {
    const result = registerRestaurantSchema.safeParse({ ...validPayload, fullName: 'J' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email address', () => {
    const result = registerRestaurantSchema.safeParse({ ...validPayload, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects a short password', () => {
    const result = registerRestaurantSchema.safeParse({ ...validPayload, password: 'Short1!', confirmPassword: 'Short1!' })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched passwords', () => {
    const result = registerRestaurantSchema.safeParse({ ...validPayload, confirmPassword: 'Different1!' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Passwords do not match.')
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })

  it('trims whitespace from name, restaurant name, and email', () => {
    const result = registerRestaurantSchema.safeParse({
      fullName: '  Jane Owner  ',
      restaurantName: '  The Green Bar  ',
      email: '  jane@example.com  ',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.fullName).toBe('Jane Owner')
      expect(result.data.restaurantName).toBe('The Green Bar')
      expect(result.data.email).toBe('jane@example.com')
    }
  })
})

describe('verifyEmailSchema', () => {
  it('accepts a valid email and 6-digit code', () => {
    const result = verifyEmailSchema.safeParse({
      email: 'jane@example.com',
      code: '123456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = verifyEmailSchema.safeParse({
      email: 'not-an-email',
      code: '123456',
    })
    expect(result.success).toBe(false)
  })

  it('rejects codes that are not exactly 6 digits', () => {
    const short = verifyEmailSchema.safeParse({ email: 'jane@example.com', code: '12345' })
    const long = verifyEmailSchema.safeParse({ email: 'jane@example.com', code: '1234567' })
    const letters = verifyEmailSchema.safeParse({ email: 'jane@example.com', code: 'abcdef' })

    expect(short.success).toBe(false)
    expect(long.success).toBe(false)
    expect(letters.success).toBe(false)
  })

  it('trims whitespace from email and code', () => {
    const result = verifyEmailSchema.safeParse({
      email: '  jane@example.com  ',
      code: '  123456  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('jane@example.com')
      expect(result.data.code).toBe('123456')
    }
  })
})

describe('passwordResetSchema', () => {
  it('accepts matching strong passwords', () => {
    const result = passwordResetSchema.safeParse({
      password: 'NewPassword123!',
      confirmPassword: 'NewPassword123!',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a short password', () => {
    const result = passwordResetSchema.safeParse({
      password: 'Short1!',
      confirmPassword: 'Short1!',
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched passwords', () => {
    const result = passwordResetSchema.safeParse({
      password: 'NewPassword123!',
      confirmPassword: 'Different123!',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Passwords do not match.')
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })
})