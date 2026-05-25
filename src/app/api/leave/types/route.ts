import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const leaveTypes = await prisma.leaveType.findMany({
      where: { org_id: session.user.org_id },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ success: true, data: leaveTypes })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch leave types' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json()

    const leaveType = await prisma.leaveType.create({
      data: {
        org_id: session.user.org_id,
        name: body.name,
        code: body.code,
        days_per_year: body.days_per_year,
        carry_forward_limit: body.carry_forward_limit ?? 0,
        is_paid: body.is_paid ?? true,
        min_notice_days: body.min_notice_days ?? 0,
      },
    })

    return NextResponse.json({ success: true, data: leaveType }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create leave type' }, { status: 500 })
  }
}