import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed']

// PATCH — HR replies to / updates status of a request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const existing = await prisma.hRRequest.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })

    const body = await req.json()
    const { status, reply } = body

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    const updated = await prisma.hRRequest.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(reply  !== undefined && {
          reply,
          replied_by: session.user.id,
          replied_at: new Date(),
        }),
      },
      include: {
        employee: {
          select: { id: true, first_name: true, last_name: true, emp_code: true },
        },
      },
    })

    // Notify the employee that HR replied
    if (reply !== undefined && existing.employee_id) {
      const empUser = await prisma.user.findFirst({
        where: { employee_id: existing.employee_id, org_id: session.user.org_id },
      })
      if (empUser) {
        await prisma.notification.create({
          data: {
            org_id:  session.user.org_id,
            user_id: empUser.id,
            title:   'HR responded to your request',
            message: `Your request "${existing.subject}" has been updated.`,
            type:    'info',
          },
        })
      }
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update request' }, { status: 500 })
  }
}
