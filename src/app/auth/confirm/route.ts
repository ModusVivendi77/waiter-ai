import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Handles Supabase's built-in transactional email links ("Confirm signup",
 * "Reset Password", invite). GoTrue builds those links as
 * `<SiteURL>/auth/confirm?token_hash=...&type=signup|recovery|invite`,
 * so this mirrors the /auth/callback route without the OAuth `code` exchange.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next')

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (type as 'email' | 'sms' | 'email_change' | 'recovery' | 'invite') ?? 'email',
    })

    if (error) {
      return NextResponse.redirect(new URL('/verify-email?error=invalid-link', requestUrl.origin))
    }

    // Password-reset links continue to the reset page.
    if (type === 'recovery') {
      const target = next && next.startsWith('/') ? next : '/reset-password'
      return NextResponse.redirect(new URL(target, requestUrl.origin))
    }

    return NextResponse.redirect(new URL('/login?verified=1', requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
