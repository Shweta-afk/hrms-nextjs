import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/employees/[id]/terminate
 * Body: { reason?: string, last_working_day?: string (YYYY-MM-DD) }
 *
 * Atomically:
 *  1. Sets employee status → 'terminated'
 *  2. Deactivates all DeviceEnrollment records (so they stop getting sync'd)
 *  3. Cancels any pending leave requests
 *  4. Employee data is preserved in DB — accessible via ?status=terminated (archive)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Only HR admins can terminate employees' }, { status: 403 })
    }

    const { id } = await params
    const org_id = session.user.org_id

    const employee = await prisma.employee.findFirst({
      where: { id, org_id },
      select: { id: true, status: true, first_name: true, last_name: true },
    })

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }
    if (employee.status === 'terminated') {
      return NextResponse.json({ success: false, error: 'Employee is already terminated' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const reason: string | null = body.reason ?? null
    const lastWorkingDay: string | null = body.last_working_day ?? null

    // Atomic: run all in a transaction
    await prisma.$transaction([
      // 1. Mark employee terminated
      prisma.employee.update({
        where: { id },
        data: {
          status: 'terminated',
          // Store reason + last_working_day in personal_info JSON
          personal_info: {
            set: undefined, // prisma doesn't support merge in $transaction easily
          },
        },
      }),

      // 2. Deactivate all device enrollments
      prisma.deviceEnrollment.updateMany({
        where: { employee_id: id, org_id },
        data: { status: 'failed' },   // 'failed' = inactive / won't sync
      }),

      // 3. Cancel pending leave requests
      prisma.leaveRequest.updateMany({
        where: { employee_id: id, org_id, status: 'pending' },
        data: { status: 'rejected' },
      }),
    ])

    // Update reason + last_working_day in a separate update (JSON merge)
    if (reason || lastWorkingDay) {
      const emp = await prisma.employee.findUnique({ where: { id }, select: { personal_info: true } })
      const existing = (emp?.personal_info ?? {}) as Record<string, unknown>
      await prisma.employee.update({
        where: { id },
        data: {
          personal_info: {
            ...existing,
            ...(reason && { termination_reason: reason }),
            ...(lastWorkingDay && { last_working_day: lastWorkingDay }),
            terminated_at: new Date().toISOString(),
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        employee_id: id,
        name: `${employee.first_name} ${employee.last_name}`,
        status: 'terminated',
      },
    })
  } catch (error) {
    console.error('POST /api/employees/[id]/terminate error:', error)
    return NextResponse.json({ success: false, error: 'Failed to terminate employee' }, { status: 500 })
  }
}

/**
 * DELETE /api/employees/[id]/terminate  (re-activate)
 * Restores a terminated employee back to active.
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

    const employee = await prisma.employee.findFirst({ where: { id, org_id } })
    if (!employee) return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })

    await prisma.employee.update({
      where: { id },
      data: { status: 'active' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/employees/[id]/terminate error:', error)
    return NextResponse.json({ success: false, error: 'Failed to re-activate employee' }, { status: 500 })
  }
}
