import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/employees/[id]/terminate
 * Body: { exit_type?: 'terminated'|'resigned', reason?: string, last_working_day?: string }
 *
 * Sets employee status → 'terminated' or 'resigned', deactivates device
 * enrollments, cancels pending leaves, and records the exit metadata.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Only HR admins can archive employees' }, { status: 403 })
    }

    const { id } = await params
    const org_id = session.user.org_id

    const employee = await prisma.employee.findFirst({
      where: { id, org_id },
      select: { id: true, status: true, first_name: true, last_name: true, personal_info: true },
    })

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }
    if (employee.status === 'terminated' || employee.status === 'resigned') {
      return NextResponse.json({ success: false, error: 'Employee is already archived' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const exit_type: 'terminated' | 'resigned' = body.exit_type === 'resigned' ? 'resigned' : 'terminated'
    const reason: string | null = body.reason ?? null
    const last_working_day: string | null = body.last_working_day ?? null

    // Atomic: update status + deactivate enrollments + cancel pending leaves
    await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: { status: exit_type },
      }),
      prisma.deviceEnrollment.updateMany({
        where: { employee_id: id, org_id },
        data: { status: 'failed' },
      }),
      prisma.leaveRequest.updateMany({
        where: { employee_id: id, org_id, status: 'pending' },
        data: { status: 'rejected' },
      }),
    ])

    // Store exit metadata in personal_info (separate update to safely merge JSON)
    const existing = (employee.personal_info ?? {}) as Record<string, unknown>
    await prisma.employee.update({
      where: { id },
      data: {
        personal_info: {
          ...existing,
          exit_type,
          ...(reason         && { [exit_type === 'resigned' ? 'resignation_reason' : 'termination_reason']: reason }),
          ...(last_working_day && { last_working_day }),
          exit_at: new Date().toISOString(),
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        employee_id: id,
        name: `${employee.first_name} ${employee.last_name}`,
        status: exit_type,
      },
    })
  } catch (error) {
    console.error('POST /api/employees/[id]/terminate error:', error)
    return NextResponse.json({ success: false, error: 'Failed to archive employee' }, { status: 500 })
  }
}

/**
 * DELETE /api/employees/[id]/terminate
 * Restores a terminated/resigned employee back to active.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const org_id = session.user.org_id

    const employee = await prisma.employee.findFirst({
      where: { id, org_id },
      select: { id: true, status: true, personal_info: true },
    })
    if (!employee) return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })

    // Clear exit metadata when restoring
    const existing = (employee.personal_info ?? {}) as Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { exit_type: _et, termination_reason: _tr, resignation_reason: _rr, last_working_day: _lwd, exit_at: _ea, ...cleanInfo } = existing

    await prisma.employee.update({
      where: { id },
      data: {
        status: 'active',
        personal_info: cleanInfo as Record<string, string>,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/employees/[id]/terminate error:', error)
    return NextResponse.json({ success: false, error: 'Failed to restore employee' }, { status: 500 })
  }
}
