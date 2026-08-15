/**
 * Server actions and zod schemas return English-only messages. Map the
 * well-known ones to translation keys so auth forms can show them in the
 * active UI language; anything unknown passes through untranslated.
 */
type Translate = (key: string) => string

const AUTH_ERROR_MAP: Array<[RegExp, string]> = [
  [/full name/i, 'auth.errFullName'],
  [/restaurant name/i, 'auth.errRestaurantName'],
  [/valid email/i, 'auth.errEmail'],
  [/at least 8 characters/i, 'auth.errPasswordMin'],
  [/do not match/i, 'auth.errPasswordsMatch'],
  [/already been registered|already registered/i, 'auth.errEmailTaken'],
  [/unable to create the user account/i, 'auth.errCreateAccount'],
  [/email is required/i, 'auth.errEmailRequired'],
  [/too many confirmation emails/i, 'auth.errTooManyEmails'],
]

export function localizeAuthError(message: string | null | undefined, t: Translate): string | null {
  if (!message) return null
  for (const [pattern, key] of AUTH_ERROR_MAP) {
    if (pattern.test(message)) return t(key)
  }
  return message
}
