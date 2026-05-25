import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

// Routes only HR admins can access
const HR_ONLY_PREFIXES = [
  '/dashboard',
  '/employees',
  '/attendance',
  '/payroll',
  '/leave',
  '/recruitment',
  '/analytics',
  '/settings',
  '/billing',
  '/onboarding',
]

// Routes only employees (non-admin) should be redirected away from
// (they belong in /portal/*)
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl

  // Not logged in: let next-auth handle redirect to /login
  if (!token) return NextResponse.next()

  const role = token.role as string | undefined

  // Employees trying to reach HR-only pages → send to portal
  if (role === 'employee') {
    const isHrRoute = HR_ONLY_PREFIXES.some(p => pathname.startsWith(p))
    if (isHrRoute) {
      return NextResponse.redirect(new URL('/portal', req.url))
    }
  }

  // HR admins landing on /portal → redirect to dashboard
  if (role === 'hr_admin' && pathname === '/portal') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/employees/:path*',
    '/attendance/:path*',
    '/payroll/:path*',
    '/leave/:path*',
    '/recruitment/:path*',
    '/analytics/:path*',
    '/settings/:path*',
    '/billing/:path*',
    '/onboarding/:path*',
    '/portal/:path*',
    '/portal',
  ],
}
