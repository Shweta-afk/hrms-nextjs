import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — HR verifies / adds notes to a document
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json()
    const { is_verified, notes } = body

    const existing = await prisma.employeeDocument.findFirst({
      where: { id: docId, employee_id: id, org_id: session.user.org_id },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })

    const updated = await prisma.employeeDocument.update({
      where: { id: docId },
      data: {
        ...(is_verified !== undefined && {
          is_verified,
          verified_by: is_verified ? session.user.id : null,
          verified_at: is_verified ? new Date() : null,
        }),
        ...(notes !== undefined && { notes }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update document' }, { status: 500 })
  }
}

// DELETE — remove a document
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const existing = await prisma.employeeDocument.findFirst({
      where: { id: docId, employee_id: id, org_id: session.user.org_id },
    })
    if (!existing) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })

    await prisma.employeeDocument.delete({ where: { id: docId } })
    return NextResponse.json({ success: true, data: { message: 'Document deleted' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete document' }, { status: 500 })
  }
}
