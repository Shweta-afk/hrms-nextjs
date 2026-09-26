import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { normalizeOffDayRules } from '@/lib/payroll/shift-schedule'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { name, off_day_rules } = await req.json()
    const rules = off_day_rules !== undefined ? normalizeOffDayRules(off_day_rules) : undefined
    if (off_day_rules !== undefined && !rules) {
      return NextResponse.json({ success: false, error: 'At least one off day is required' }, { status: 400 })
    }
    const weekly_offs = rules ? rules.filter(r => r.occurrences === 'all').map(r => r.weekday) : undefined

    const group = await prisma.shiftGroup.update({
      where: { id, org_id: session.user.org_id },
      data: {
        ...(name && { name: name.trim() }),
        ...(rules && { off_day_rules: rules as unknown as Prisma.InputJsonValue, weekly_offs }),
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
