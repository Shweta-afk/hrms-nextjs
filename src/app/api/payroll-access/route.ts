import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  PAYROLL_UNLOCK_COOKIE,
  createUnlockToken,
  isPayrollUnlocked,
  getPayrollPasswordHash,
  verifyPayrollPassword,
} from '@/lib/payroll-lock'

// GET — current payroll-lock status for the caller's org
export async function GET(req: NextRequest) {
  const guard = await requireRole(['hr_admin'])
  if (guard instanceof NextResponse) return guard
  const session = guard

  const hash = await getPayrollPasswordHash(session.user.org_id)
  return NextResponse.json({
    success: true,
    data: { isSet: !!hash, unlocked: isPayrollUnlocked(req, session.user.org_id, session.user.login_id) },
  })
}

// POST { password } — verify the payroll password and unlock salary views for this browser
export async function POST(req: NextRequest) {
  const guard = await requireRole(['hr_admin'])
  if (guard instanceof NextResponse) return guard
  const session = guard

  const body = await req.json().catch(() => null)
  const password = body?.password
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 })
  }

  const ok = await verifyPayrollPassword(session.user.org_id, password)
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Incorrect payroll password' }, { status: 401 })
  }

  const { token, maxAgeSec } = createUnlockToken(session.user.org_id, session.user.login_id)
  const res = NextResponse.json({ success: true })
  res.cookies.set(PAYROLL_UNLOCK_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeSec,
    path: '/',
  })
  return res
}

// DELETE — lock again immediately (manual "Lock" action)
export async function DELETE() {
  const guard = await requireRole(['hr_admin'])
  if (guard instanceof NextResponse) return guard

  const res = NextResponse.json({ success: true })
  res.cookies.set(PAYROLL_UNLOCK_COOKIE, '', { maxAge: 0, path: '/' })
  return res
}
