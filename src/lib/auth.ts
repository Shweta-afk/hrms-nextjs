import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'

/**
 * bcrypt cost factor used everywhere we hash passwords.
 * 10 ≈ 65ms on modern hardware — good balance of security and speed for serverless.
 * If you change this, ALL three hashing sites (signup, reset, invite) must use the new constant.
 * Note: existing hashes store their own cost factor so compare() still works after a change.
 */
export const BCRYPT_COST = 10

export type Role = 'hr_admin' | 'employee'

type Session = Awaited<ReturnType<typeof auth>>
export type AuthenticatedSession = NonNullable<Session>

/**
 * Authorization helpers for API routes.
 *
 * Usage pattern — the result is either a NextResponse (early return) or a session.
 * `instanceof NextResponse` narrows the union, so downstream code gets the session typed.
 *
 *   const guard = await requireRole(['hr_admin'])
 *   if (guard instanceof NextResponse) return guard
 *   const session = guard
 *   // session.user.id / .org_id / .role / .employee_id are all available
 */

/**
 * Requires the caller to be authenticated AND have one of the allowed roles.
 * Returns 401 if unauthenticated, 403 if authenticated but role mismatch.
 */
export async function requireRole(
  allowed: Role[]
): Promise<AuthenticatedSession | NextResponse> {
  const session = await auth()
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }
  if (!allowed.includes(session.user.role as Role)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    )
  }
  return session
}

/**
 * Requires the caller to be authenticated, regardless of role.
 * Use for endpoints where any logged-in user can act (employee self-service).
 */
export async function requireAuth(): Promise<AuthenticatedSession | NextResponse> {
  const session = await auth()
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }
  return session
}

/**
 * Convenience: hr_admin only.
 */
export async function requireAdmin(): Promise<AuthenticatedSession | NextResponse> {
  return requireRole(['hr_admin'])
}
