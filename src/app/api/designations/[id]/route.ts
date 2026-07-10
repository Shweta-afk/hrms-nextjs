import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — rename/relevel designation
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const existing = await prisma.designation.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Designation not found' }, { status: 404 })

    const { name, level } = await req.json()
    const updated = await prisma.designation.update({
      where: { id },
      data: {
        ...(name?.trim() && { name: name.trim() }),
        ...(level !== undefined && { level: Number(level) }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update designation' }, { status: 500 })
  }
}

// DELETE — remove designation (blocked if employees are assigned)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const existing = await prisma.designation.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Designation not found' }, { status: 404 })

    const inUse = await prisma.employee.count({ where: { designation_id: id } })
    if (inUse > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete — ${inUse} employee${inUse > 1 ? 's are' : ' is'} assigned to this designation`,
      }, { status: 409 })
    }

    await prisma.designation.delete({ where: { id } })
    return NextResponse.json({ success: true, data: { message: 'Designation deleted' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete designation' }, { status: 500 })
  }
}
