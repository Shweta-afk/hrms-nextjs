/**
 * Next.js edge middleware — runs before every matched request hits a route handler.
 *
 * Why this matters:
 *   Without this file, auth protection is purely application-layer (each API route
 *   and page calls requireAuth/requireAdmin manually). If a developer forgets to add
 *   that guard, the route is publicly accessible. This middleware is the safety net:
 *   any protected path that is not in the matcher is simply unreachable without a
 *   valid NextAuth session, regardless of what the route handler does.
 *
 * What it does:
 *   1. Verifies the NextAuth JWT on every matched request.
 *   2. Redirects unauthenticated users to /login (pages) or returns 401 (API).
 *   3. Enforces role separation: employees are redirected to /portal if they try
 *      to access hr_admin-only pages.
 *
 * What it does NOT protect (explicitly excluded from matcher):
 *   - /api/auth/*           — NextAuth's own endpoints
 *   - /api/iclock/*         — Biometric device push (API-key authenticated)
 *   - /api/billing/webhook  — Razorpay webhook (signature authenticated)
 *   - /api/cron/*           — Vercel cron (CRON_SECRET bearer-authenticated)
 *   - /api/dev/*            — Dev-only endpoints (gated by ALLOW_DEV_ENDPOINTS + NODE_ENV)
 *   - Public pages          — login, signup, verify-email, forgot/reset password
 *   - Marketing             — homepage, /demo
 *
 * Defense-in-depth:
 *   Each API route still calls requireAuth() / requireAdmin() independently.
 *   This middleware is the first line of defense, not the only one.
 */

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Pages that only hr_admin may visit. Employees are silently redirected to /portal.
const ADMIN_ONLY_PREFIXES = [
  '/dashboard',
  '/employees',
  '/attendance',
  '/payroll',
  '/recruitment',
  '/settings',
  '/billing',
  '/analytics',
  '/onboarding',
  '/system-map',
]

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    const isAdminOnlyPage = ADMIN_ONLY_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    )

    if (isAdminOnlyPage && token?.role !== 'hr_admin') {
      // Employee tried to access an admin page — send them to their portal.
      return NextResponse.redirect(new URL('/portal', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Return false → middleware redirects to pages.signIn automatically.
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    // ── Protected pages ───────────────────────────────────────────────────
    '/dashboard/:path*',
    '/employees/:path*',
    '/attendance/:path*',
    '/payroll/:path*',
    '/payslip/:path*',
    '/portal/:path*',
    '/recruitment/:path*',
    '/reimbursements/:path*',
    '/requests/:path*',
    '/settings/:path*',
    '/billing/:path*',
    '/analytics/:path*',
    '/onboarding/:path*',
    '/leave/:path*',
    '/system-map/:path*',

    // ── Protected API routes (session-authenticated) ───────────────────
    // Excludes: /api/auth, /api/iclock, /api/billing/webhook, /api/cron, /api/dev
    '/api/employees/:path*',
    '/api/attendance/:path*',
    '/api/devices/:path*',
    '/api/leave/:path*',
    '/api/payroll/:path*',
    '/api/notifications/:path*',
    '/api/org/:path*',
    '/api/upload/:path*',
    '/api/recruitment/:path*',
    '/api/reimbursements/:path*',
    '/api/requests/:path*',
  ],
}
