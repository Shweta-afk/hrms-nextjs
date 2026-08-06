import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getWorkingDays(from: Date, to: Date): number {
  let count = 0
  const cur = new Date(from)
  while (cur <= to) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  try {
    // Only HR admins can approve/reject/cancel leave requests.
    // (Previously: any authenticated employee could approve their own leave.)
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json()
    const { status, rejection_reason, leave_type_id, from_date, to_date } = body

    // Load the request first (org-scoped) so both the type-change and the
    // status-change paths can use it.
    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: { id: id, org_id: session.user.org_id },
      include: {
        employee: {
          select: {
            first_name: true,
            last_name: true,
            user: { select: { id: true } },
          },
        },
        leave_type: true,
      },
    })

    if (!leaveRequest) {
      return NextResponse.json({ success: false, error: 'Leave request not found' }, { status: 404 })
    }

    // ── Change leave type (HR reclassification) ──
    // A separate action from approve/reject: HR can correct the leave type.
    if (leave_type_id !== undefined) {
      if (leave_type_id === leaveRequest.leave_type_id) {
        return NextResponse.json({ success: true, data: leaveRequest })
      }
      const newType = await prisma.leaveType.findFirst({
        where: { id: leave_type_id, org_id: session.user.org_id },
      })
      if (!newType) {
        return NextResponse.json({ success: false, error: 'Invalid leave type' }, { status: 400 })
      }

      const reclassified = await prisma.leaveRequest.update({
        where: { id: id },
        data: { leave_type_id },
        include: {
          employee: {
            select: {
              first_name: true, last_name: true, emp_code: true,
              department: { select: { name: true } },
            },
          },
          leave_type: { select: { id: true, name: true, code: true } },
        },
      })

      // Let the employee know their leave was reclassified.
      const { createNotification } = await import('@/lib/notifications')
      if (leaveRequest.employee.user?.id) {
        await createNotification({
          org_id: session.user.org_id,
          user_id: leaveRequest.employee.user.id,
          title: 'Leave type updated',
          message: `HR changed your leave request from ${leaveRequest.leave_type.name} to ${newType.name}.`,
          type: 'info',
          link: '/portal/leave',
        })
      }

      return NextResponse.json({ success: true, data: reclassified })
    }

    // ── Approve / reject / cancel ──
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    if (status === 'rejected' && !rejection_reason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // HR can adjust the leave dates while approving (e.g. correcting a typo
    // in the employee's original request). Only honoured on approval, and
    // only if the dates actually differ from what's stored.
    let dateOverride: { from_date: Date; to_date: Date; total_days: number } | null = null
    if (status === 'approved' && (from_date || to_date)) {
      const newFrom = from_date ? new Date(from_date) : new Date(leaveRequest.from_date)
      const newTo = to_date ? new Date(to_date) : new Date(leaveRequest.to_date)
      if (isNaN(newFrom.getTime()) || isNaN(newTo.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid date' }, { status: 400 })
      }
      if (newFrom > newTo) {
        return NextResponse.json(
          { success: false, error: 'From date cannot be after to date' },
          { status: 400 }
        )
      }
      if (newFrom.getTime() !== new Date(leaveRequest.from_date).getTime() ||
          newTo.getTime() !== new Date(leaveRequest.to_date).getTime()) {
        dateOverride = { from_date: newFrom, to_date: newTo, total_days: getWorkingDays(newFrom, newTo) }
      }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: id },
      data: {
        status,
        ...(status === 'approved' && {
          approved_by: session.user.id,
          approved_at: new Date(),
        }),
        ...(status === 'rejected' && { rejection_reason }),
        ...(dateOverride && dateOverride),
      },
    })

    // Notify the employee
    const { createNotification } = await import('@/lib/notifications')
    if (leaveRequest.employee.user?.id) {
      await createNotification({
        org_id: session.user.org_id,
        user_id: leaveRequest.employee.user.id,
        title: `Leave ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'}`,
        message: status === 'approved'
          ? `Your ${leaveRequest.leave_type.name} request for ${updated.total_days} day(s)${dateOverride ? ' (dates adjusted by HR)' : ''} has been approved.`
          : status === 'rejected'
          ? `Your ${leaveRequest.leave_type.name} request was rejected. Reason: ${rejection_reason}`
          : `Your leave request status has been updated to ${status}.`,
        type: status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'info',
        link: '/leave',
      })
    }

    // Send email to employee
    try {
      const { sendLeaveStatusEmail } = await import('@/lib/email')
      const org = await prisma.organisation.findUnique({ where: { id: session.user.org_id } })
      if (leaveRequest.employee.user?.id) {
        const empUser = await prisma.user.findUnique({
          where: { id: leaveRequest.employee.user.id },
          select: { email: true }
        })
        if (empUser) {
          await sendLeaveStatusEmail({
            to: empUser.email,
            name: `${leaveRequest.employee.first_name} ${leaveRequest.employee.last_name}`,
            status: status as 'approved' | 'rejected',
            leaveType: leaveRequest.leave_type.name,
            fromDate: new Date(updated.from_date).toLocaleDateString('en-IN'),
            toDate: new Date(updated.to_date).toLocaleDateString('en-IN'),
            days: Number(updated.total_days),
            reason: rejection_reason,
            company: org?.name ?? 'Your Company',
          })
        }
      }
    } catch (emailErr) {
      console.error('Failed to send leave email:', emailErr)
    }


    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Leave PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update leave request' }, { status: 500 })
  }
}