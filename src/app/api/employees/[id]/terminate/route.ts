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
      select: { id: true, status: true, first_name: true, last_name: true, email: true, personal_info: true },
    })

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }
    if (['terminated', 'resigned', 'absconding'].includes(employee.status)) {
      return NextResponse.json({ success: false, error: 'Employee is already archived' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const exit_type: 'terminated' | 'resigned' | 'absconding' =
      ['resigned', 'absconding'].includes(body.exit_type) ? body.exit_type : 'terminated'
    const reasonKey =
      exit_type === 'resigned' ? 'resignation_reason'
      : exit_type === 'absconding' ? 'absconding_reason'
      : 'termination_reason'
    const reason: string | null = body.reason ?? null
    const last_working_day: string | null = body.last_working_day ?? null

    // Atomic: update status + revoke portal login + deactivate enrollments + cancel pending leaves
    await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: { status: exit_type },
      }),
      // Revoke employee-portal access: authorize() refuses login for inactive users.
      prisma.user.updateMany({
        where: { employee_id: id, org_id },
        data: { is_active: false },
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
          ...(reason         && { [reasonKey]: reason }),
          ...(last_working_day && { last_working_day }),
          exit_at: new Date().toISOString(),
        },
      },
    })

    // Send the employee an automated exit notice (termination / resignation / absconding).
    if (employee.email) {
      try {
        const { sendExitNotice } = await import('@/lib/email')
        const org = await prisma.organisation.findUnique({
          where: { id: org_id },
          select: { name: true },
        })
        const lastDay = last_working_day
          ? new Date(last_working_day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : null
        await sendExitNotice({
          kind: exit_type,
          to: employee.email,
          name: `${employee.first_name} ${employee.last_name}`,
          company: org?.name ?? 'the company',
          lastDay,
          reason,
          // HR may have edited the notice in the UI.
          customSubject: typeof body.email_subject === 'string' ? body.email_subject : null,
          customBody: typeof body.email_body === 'string' ? body.email_body : null,
        })
      } catch (emailErr) {
        console.error('Failed to send exit notice:', emailErr)
      }
    }

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
    const { exit_type: _et, termination_reason: _tr, resignation_reason: _rr, absconding_reason: _ar, last_working_day: _lwd, exit_at: _ea, ...cleanInfo } = existing

    await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: {
          status: 'active',
          personal_info: cleanInfo as Record<string, string>,
        },
      }),
      // Restore employee-portal access.
      prisma.user.updateMany({
        where: { employee_id: id, org_id },
        data: { is_active: true },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/employees/[id]/terminate error:', error)
    return NextResponse.json({ success: false, error: 'Failed to restore employee' }, { status: 500 })
  }
}
