import { describe, expect, it } from 'vitest'

import { localizeAuthError } from '@/lib/i18n/auth-errors'

function fakeT(key: string) {
  return `[[${key}]]`
}

describe('localizeAuthError', () => {
  it('maps known schema messages to translation keys', () => {
    expect(localizeAuthError('Full name is required.', fakeT)).toBe('[[auth.errFullName]]')
    expect(localizeAuthError('Restaurant name is required.', fakeT)).toBe('[[auth.errRestaurantName]]')
    expect(localizeAuthError('Enter a valid email address.', fakeT)).toBe('[[auth.errEmail]]')
    expect(localizeAuthError('Password must be at least 8 characters long.', fakeT)).toBe(
      '[[auth.errPasswordMin]]'
    )
    expect(localizeAuthError('Passwords do not match.', fakeT)).toBe('[[auth.errPasswordsMatch]]')
  })

  it('maps provider messages', () => {
    expect(localizeAuthError('A user with this email address has already been registered.', fakeT)).toBe(
      '[[auth.errEmailTaken]]'
    )
    expect(localizeAuthError('Too many confirmation emails. Please wait a few minutes and try again.', fakeT)).toBe(
      '[[auth.errTooManyEmails]]'
    )
  })

  it('returns unknown messages unchanged and null for empty', () => {
    expect(localizeAuthError('Some other provider error.', fakeT)).toBe('Some other provider error.')
    expect(localizeAuthError(null, fakeT)).toBeNull()
    expect(localizeAuthError(undefined, fakeT)).toBeNull()
  })
})
