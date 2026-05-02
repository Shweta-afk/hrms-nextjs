import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { status, rejection_reason } = body

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    if (status === 'rejected' && !rejection_reason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: { id: params.id, org_id: session.user.org_id },
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

    const updated = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: {
        status,
        ...(status === 'approved' && {
          approved_by: session.user.id,
          approved_at: new Date(),
        }),
        ...(status === 'rejected' && { rejection_reason }),
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
          ? `Your ${leaveRequest.leave_type.name} request for ${leaveRequest.total_days} day(s) has been approved.`
          : status === 'rejected'
          ? `Your ${leaveRequest.leave_type.name} request was rejected. Reason: ${rejection_reason}`
          : `Your leave request status has been updated to ${status}.`,
        type: status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'info',
        link: '/leave',
      })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Leave PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update leave request' }, { status: 500 })
  }
}