import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/platform'

  // Handle email confirmation links from the built-in Supabase "Confirm signup"
  // template. The link points back here with ?token_hash=...&type=signup.
  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (type as 'email' | 'sms' | 'email_change' | 'recovery' | 'invite') ?? 'email',
    })

    if (error) {
      return NextResponse.redirect(new URL('/verify-email?error=invalid-link', requestUrl.origin))
    }

    // Password-reset links carry ?next=/reset-password. After verifyOtp
    // establishes the temporary recovery session, send the user to the reset
    // page instead of the signup-confirmation landing page.
    if (type === 'recovery' && next.startsWith('/')) {
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }

    return NextResponse.redirect(new URL('/login?verified=1', requestUrl.origin))
  }

  // Handle OAuth/SSO callback exchange (`?code=...`).
  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}