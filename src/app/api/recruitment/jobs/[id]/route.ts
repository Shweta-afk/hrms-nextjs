import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    const job = await prisma.jobPosting.updateMany({
      where: { id: id, org_id: session.user.org_id },
      data: body,
    })

    return NextResponse.json({ success: true, data: job })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update job' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.jobPosting.updateMany({
      where: { id: id, org_id: session.user.org_id },
      data: { status: 'closed' },
    })

    return NextResponse.json({ success: true, data: { message: 'Job closed' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to close job' }, { status: 500 })
  }
}