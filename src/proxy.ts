import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/billing']
const API_PUBLIC = ['/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (API_PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Check trial expiry for page routes only (not API)
  const trialEndsAt = token.trial_ends_at as string | null | undefined
  if (trialEndsAt && !pathname.startsWith('/api') && !pathname.startsWith('/billing') && !pathname.startsWith('/onboarding')) {
    const expired = new Date(trialEndsAt) < new Date()
    if (expired) {
      return NextResponse.redirect(new URL('/billing?reason=trial_expired', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
