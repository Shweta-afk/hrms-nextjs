import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json()
    const { action, rejection_reason } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    const reimbursement = await prisma.reimbursement.findFirst({
      where: { id, org_id: session.user.org_id },
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            user: { select: { id: true } },
          },
        },
      },
    })

    if (!reimbursement) {
      return NextResponse.json({ success: false, error: 'Reimbursement not found' }, { status: 404 })
    }

    if (reimbursement.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Only pending reimbursements can be approved or rejected' },
        { status: 400 }
      )
    }

    const updateData: any =
      action === 'approve'
        ? {
            status: 'approved',
            approved_by: session.user.id,
            approved_at: new Date(),
            rejection_reason: null,
          }
        : {
            status: 'rejected',
            rejection_reason: rejection_reason ?? null,
            approved_by: null,
            approved_at: null,
          }

    const updated = await prisma.reimbursement.update({
      where: { id },
      data: updateData,
    })

    // Notify the employee if they have a linked user account
    const employeeUser = reimbursement.employee.user
    if (employeeUser) {
      const empName = `${reimbursement.employee.first_name} ${reimbursement.employee.last_name}`
      if (action === 'approve') {
        await createNotification({
          org_id: session.user.org_id,
          user_id: employeeUser.id,
          title: 'Reimbursement Approved',
          message: `Your reimbursement request "${reimbursement.title}" for ₹${Number(reimbursement.amount).toLocaleString('en-IN')} has been approved.`,
          type: 'success',
          link: '/portal',
        })
      } else {
        await createNotification({
          org_id: session.user.org_id,
          user_id: employeeUser.id,
          title: 'Reimbursement Rejected',
          message: `Your reimbursement request "${reimbursement.title}" has been rejected.${rejection_reason ? ` Reason: ${rejection_reason}` : ''}`,
          type: 'error',
          link: '/portal',
        })
      }
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update reimbursement' }, { status: 500 })
  }
}
