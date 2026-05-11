import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    if (body.is_default) {
      await prisma.salaryStructure.updateMany({
        where: { org_id: session.user.org_id, is_default: true },
        data: { is_default: false },
      })
    }

    const structure = await prisma.salaryStructure.update({
      where: { id, org_id: session.user.org_id } as any,
      data: body,
    })

    return NextResponse.json({ success: true, data: structure })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update structure' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.salaryStructure.delete({
      where: { id } as any,
    })

    return NextResponse.json({ success: true, data: { message: 'Structure deleted' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete structure' }, { status: 500 })
  }
}