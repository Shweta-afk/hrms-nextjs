import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { normalizeOffDayRules } from '@/lib/payroll/shift-schedule'

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

    const { name, off_day_rules } = await req.json()
    if (!name?.trim()) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    const rules = normalizeOffDayRules(off_day_rules)
    if (!rules) {
      return NextResponse.json({ success: false, error: 'At least one off day is required' }, { status: 400 })
    }
    // weekly_offs is kept as a derived legacy mirror (weekdays off every
    // single week) for any code that only reads the old flat list.
    const weekly_offs = rules.filter(r => r.occurrences === 'all').map(r => r.weekday)

    const group = await prisma.shiftGroup.create({
      data: {
        org_id: session.user.org_id,
        name: name.trim(),
        weekly_offs,
        off_day_rules: rules as unknown as Prisma.InputJsonValue,
      },
    })
    return NextResponse.json({ success: true, data: group })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create shift group' }, { status: 500 })
  }
}
