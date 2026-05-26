import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateLeaveTypeSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(10).optional(),
  days_per_year: z.number().min(0).optional(),
  carry_forward_limit: z.number().min(0).optional(),
  is_paid: z.boolean().optional(),
  applicable_gender: z.enum(['all', 'male', 'female']).optional(),
  min_notice_days: z.number().min(0).optional(),
})

// PATCH — update a leave type
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
    const data = UpdateLeaveTypeSchema.parse(body)

    const existing = await prisma.leaveType.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Leave type not found' }, { status: 404 })
    }

    const updated = await prisma.leaveType.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update leave type' }, { status: 500 })
  }
}

// DELETE — remove a leave type
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const existing = await prisma.leaveType.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Leave type not found' }, { status: 404 })
    }

    // Check if any leave requests reference this type
    const inUse = await prisma.leaveRequest.count({ where: { leave_type_id: id } })
    if (inUse > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete — ${inUse} leave request(s) reference this type. Archive it instead.` },
        { status: 409 }
      )
    }

    await prisma.leaveType.delete({ where: { id } })
    return NextResponse.json({ success: true, data: { message: 'Leave type deleted' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete leave type' }, { status: 500 })
  }
}
