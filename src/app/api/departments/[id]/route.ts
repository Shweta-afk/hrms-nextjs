import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — rename department
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const existing = await prisma.department.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 })

    const { name, code } = await req.json()
    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(code && { code: code.trim().toUpperCase() }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update department' }, { status: 500 })
  }
}

// DELETE — remove department (blocked if employees are assigned)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const existing = await prisma.department.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Department not found' }, { status: 404 })

    const inUse = await prisma.employee.count({ where: { department_id: id } })
    if (inUse > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete — ${inUse} employee${inUse > 1 ? 's are' : ' is'} assigned to this department`,
      }, { status: 409 })
    }

    await prisma.department.delete({ where: { id } })
    return NextResponse.json({ success: true, data: { message: 'Department deleted' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete department' }, { status: 500 })
  }
}
