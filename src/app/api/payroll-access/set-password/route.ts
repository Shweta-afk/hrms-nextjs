import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getPayrollPasswordHash, setPayrollPasswordHash, verifyPayrollPassword } from '@/lib/payroll-lock'

// POST { currentPassword?, newPassword } — set (first time) or change the org's payroll password.
// If one is already set, the current one must be supplied to change it — this prevents
// whoever is locked out from simply resetting the gate to unlock it themselves.
export async function POST(req: NextRequest) {
  const guard = await requireRole(['hr_admin'])
  if (guard instanceof NextResponse) return guard
  const session = guard

  const body = await req.json().catch(() => null)
  const currentPassword = body?.currentPassword
  const newPassword = body?.newPassword

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ success: false, error: 'New password must be at least 8 characters' }, { status: 400 })
  }

  const existingHash = await getPayrollPasswordHash(session.user.org_id)
  if (existingHash) {
    if (!currentPassword || typeof currentPassword !== 'string' ||
        !(await verifyPayrollPassword(session.user.org_id, currentPassword))) {
      return NextResponse.json({ success: false, error: 'Current payroll password is incorrect' }, { status: 401 })
    }
  }

  await setPayrollPasswordHash(session.user.org_id, newPassword)
  return NextResponse.json({ success: true })
}
