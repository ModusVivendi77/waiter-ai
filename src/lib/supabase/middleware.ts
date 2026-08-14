import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { normalizeSupabaseUrl } from '@/lib/supabase/config'

type CookieToSet = {
  name: string
  value: string
  options?: {
    domain?: string
    expires?: Date
    httpOnly?: boolean
    maxAge?: number
    path?: string
    sameSite?: 'lax' | 'strict' | 'none' | boolean
    secure?: boolean
  }
}

// Routes a logged-out visitor may use. Everything else (the platform, admin,
// and the root landing page) is protected: anonymous users only see the login
// page. The customer QR flow (/t/*, /orders/*) stays public.
const PUBLIC_PREFIXES = [
  '/t/',
  '/orders/',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/platform/signup',
  '/auth/',
  '/api/',
]

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return response
  }

  const supabase = createServerClient(normalizeSupabaseUrl(url), anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

        response = NextResponse.next({
          request,
        })

        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url)
    if (pathname && pathname !== '/') {
      loginUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Logged-in users landing on the root go straight to their workspace.
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/platform', request.url))
  }

  return response
}
