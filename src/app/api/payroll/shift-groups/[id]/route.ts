import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { name, weekly_offs } = await req.json()
    const group = await prisma.shiftGroup.update({
      where: { id, org_id: session.user.org_id },
      data: {
        ...(name && { name: name.trim() }),
        ...(weekly_offs && { weekly_offs }),
      },
    })
    return NextResponse.json({ success: true, data: group })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    // Unlink employees before deleting
    await prisma.employee.updateMany({
      where: { org_id: session.user.org_id, shift_group_id: id },
      data: { shift_group_id: null },
    })
    await prisma.shiftGroup.delete({ where: { id, org_id: session.user.org_id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 })
  }
}
