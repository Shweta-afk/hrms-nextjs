import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const groups = await prisma.shiftGroup.findMany({
      where: { org_id: session.user.org_id },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ success: true, data: groups })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch shift groups' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { name, weekly_offs } = await req.json()
    if (!name?.trim()) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    if (!Array.isArray(weekly_offs) || weekly_offs.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one weekly-off day is required' }, { status: 400 })
    }

    const group = await prisma.shiftGroup.create({
      data: {
        org_id: session.user.org_id,
        name: name.trim(),
        weekly_offs,
      },
    })
    return NextResponse.json({ success: true, data: group })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create shift group' }, { status: 500 })
  }
}
