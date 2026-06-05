import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeUpcomingBirthdays } from '@/lib/birthdays'

/**
 * GET /api/birthdays/upcoming?days=14
 *
 * Returns the upcoming-birthday list for the caller's org. Used by:
 *   - HR dashboard (BirthdaysPanel) — sees everyone
 *   - Employee portal — sees coworkers (excludes self)
 *
 * Auth: any authenticated user. Birthdays are coworker-visible info; we
 * deliberately omit the year of birth (only Month + Day are returned).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { org_id, role, employee_id } = session.user

    const url = new URL(req.url)
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 14, 1), 60)

    // Pull every active employee + their personal_info JSON. We could
    // SQL-filter on a JSON path here, but Postgres JSON ops won't help us
    // compute "days until next birthday" anyway — that's a JS-side
    // calculation regardless. Pulling all rows once and filtering in memory
    // is the right shape for org sizes we care about (≤ a few thousand).
    const employees = await prisma.employee.findMany({
      where: { org_id, status: 'active' },
      select: {
        id:            true,
        emp_code:      true,
        first_name:    true,
        last_name:     true,
        personal_info: true,
        department:    { select: { name: true } },
      },
    })

    const items = computeUpcomingBirthdays(employees, {
      windowDays:        days,
      // Employees see coworkers, not themselves. HR sees everyone (their
      // employee_id is typically null, so this is a no-op for them).
      excludeEmployeeId: role === 'employee' ? employee_id ?? null : null,
    })

    return NextResponse.json({
      success: true,
      data: {
        items,
        window_days: days,
      },
    })
  } catch (error) {
    console.error('Upcoming birthdays error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load upcoming birthdays' },
      { status: 500 }
    )
  }
}
