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

    const departments = await prisma.department.findMany({
      where: { org_id: session.user.org_id },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ success: true, data: departments })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch departments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { name, code } = await req.json()

    const department = await prisma.department.create({
      data: { org_id: session.user.org_id, name, code },
    })

    return NextResponse.json({ success: true, data: department }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create department' }, { status: 500 })
  }
}