import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Employee <-> shift group assignment lives only here, reached only from the
// Shift Groups settings page — not from the employee create/edit forms.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const group = await prisma.shiftGroup.findFirst({ where: { id, org_id: session.user.org_id } })
    if (!group) return NextResponse.json({ success: false, error: 'Shift group not found' }, { status: 404 })

    const employees = await prisma.employee.findMany({
      where: { org_id: session.user.org_id, status: 'active' },
      select: {
        id: true, emp_code: true, first_name: true, last_name: true,
        shift_group_id: true,
        department: { select: { name: true } },
      },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    })
    return NextResponse.json({ success: true, data: employees })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch employees' }, { status: 500 })
  }
}

// Body: { employee_ids: string[] } — the FULL desired membership of this
// group. Employees in the list get shift_group_id = this group; existing
// members not in the list get unassigned (shift_group_id = null).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { employee_ids } = await req.json()
    if (!Array.isArray(employee_ids)) {
      return NextResponse.json({ success: false, error: 'employee_ids must be an array' }, { status: 400 })
    }

    const group = await prisma.shiftGroup.findFirst({ where: { id, org_id: session.user.org_id } })
    if (!group) return NextResponse.json({ success: false, error: 'Shift group not found' }, { status: 404 })

    const desired = new Set(employee_ids.filter((v: unknown) => typeof v === 'string'))

    await prisma.$transaction([
      // Unassign current members who were dropped from the list
      prisma.employee.updateMany({
        where: {
          org_id: session.user.org_id,
          shift_group_id: id,
          id: { notIn: Array.from(desired) },
        },
        data: { shift_group_id: null },
      }),
      // Assign the (validated) employees in the list — scoped to this org so
      // a stray id from another org can't be assigned.
      ...(desired.size > 0
        ? [prisma.employee.updateMany({
            where: { org_id: session.user.org_id, id: { in: Array.from(desired) } },
            data: { shift_group_id: id },
          })]
        : []),
    ])

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update shift group members' }, { status: 500 })
  }
}
