import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Pages that don't require auth.
// IMPORTANT: '/' must be exact-match (not prefix) — startsWith('/') would match every URL.
const PUBLIC_PAGE_EXACT = new Set(['/', '/demo', '/verify-email'])
const PUBLIC_PAGE_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/billing']

// Routes only HR admins can access (employees are redirected to /portal)
const HR_ONLY_PREFIXES = [
  '/dashboard', '/employees', '/attendance', '/payroll',
  '/leave', '/recruitment', '/analytics', '/settings', '/onboarding',
]

const API_PUBLIC = [
  '/api/auth',
  '/api/attendance/device-push', // ZKTeco device PUSH — identified by push_token in URL
  '/iclock',                      // ZKTeco/ESSL ADMS standard endpoint (AiFace Magnum, F18, etc.)
]

// These sub-paths under /api/devices/* are device-initiated (no JWT possible).
// The route handler must still verify the device's push_token in the request — these
// are NOT trusted just because the path is public.
const DEVICE_SUBPATHS_PUBLIC = ['/heartbeat']

function isPublicPage(pathname: string): boolean {
  if (PUBLIC_PAGE_EXACT.has(pathname)) return true
  return PUBLIC_PAGE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublicPage(pathname)) return NextResponse.next()
  if (API_PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next()
  if (DEVICE_SUBPATHS_PUBLIC.some(p => pathname.endsWith(p))) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    // API routes should return 401, not redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Role-based page guards (page routes only)
  if (!pathname.startsWith('/api/')) {
    const role = token.role as string | undefined

    // Employees must not reach HR-only pages
    if (role === 'employee') {
      const isHrRoute = HR_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (isHrRoute) {
        return NextResponse.redirect(new URL('/portal', req.url))
      }
    }

    // HR admins landing directly on /portal → dashboard
    if (role === 'hr_admin' && (pathname === '/portal' || pathname.startsWith('/portal/'))) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
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
