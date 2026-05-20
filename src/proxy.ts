import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/billing']
const API_PUBLIC = [
  '/api/auth',
  '/api/attendance/device-push', // ZKTeco device PUSH — identified by push_token in URL
  '/iclock',                      // ZKTeco/ESSL ADMS standard endpoint (AiFace Magnum, F18, etc.)
]

// These sub-paths under /api/devices/* are device-initiated (no JWT possible)
const DEVICE_SUBPATHS_PUBLIC = ['/heartbeat']

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (API_PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (DEVICE_SUBPATHS_PUBLIC.some(p => pathname.endsWith(p))) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    // API routes should return 401, not redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
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
