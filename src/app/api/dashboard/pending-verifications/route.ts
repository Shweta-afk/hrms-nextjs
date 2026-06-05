import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/dashboard/pending-verifications
 *
 * Powers the "Pending Document Verification" panel on the HR dashboard.
 *
 * Aggregates unverified EmployeeDocument rows by employee so HR sees one
 * row per person ("Asha S. — 3 docs pending, oldest 4 days ago") rather
 * than a long flat list with the same employee repeated.
 *
 * Returned shape is what the panel renders directly — no client-side
 * grouping or sorting.
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const { org_id } = guard.user

    // Cap the list so an org with hundreds of pending docs doesn't blow up
    // the dashboard payload. The panel shows the most overdue first, with
    // a "+N more" footer if we truncated.
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit')) || 8, 25)

    // Step 1: aggregate by employee. We want the count and the earliest
    // upload date (= "oldest waiting") per employee.
    const grouped = await prisma.employeeDocument.groupBy({
      by: ['employee_id'],
      where: { org_id, is_verified: false },
      _count: { _all: true },
      _min: { created_at: true },
    })

    const totalPendingDocs = grouped.reduce((sum, g) => sum + g._count._all, 0)
    const totalEmployees = grouped.length

    // Sort by oldest-pending first (most overdue at the top), then truncate.
    grouped.sort((a, b) => {
      const aTs = a._min.created_at?.getTime() ?? 0
      const bTs = b._min.created_at?.getTime() ?? 0
      return aTs - bTs
    })
    const top = grouped.slice(0, limit)

    // Step 2: fetch employee display info for just the top N.
    // Kept as a separate query (rather than `include` in groupBy, which
    // Prisma doesn't support) so the aggregate scan stays index-only.
    const employees = top.length
      ? await prisma.employee.findMany({
          where: { id: { in: top.map(g => g.employee_id) } },
          select: {
            id: true,
            emp_code: true,
            first_name: true,
            last_name: true,
            department: { select: { name: true } },
          },
        })
      : []
    const empById = new Map(employees.map(e => [e.id, e]))

    const items = top
      .map(g => {
        const e = empById.get(g.employee_id)
        if (!e) return null // employee deleted; skip
        return {
          employee_id:    e.id,
          emp_code:       e.emp_code,
          name:           `${e.first_name} ${e.last_name}`.trim(),
          department:     e.department?.name ?? null,
          pending_count:  g._count._all,
          // ISO string is what the client formats — keeps payload JSON-safe
          // and lets the panel do "x days ago" via a single util.
          oldest_uploaded_at: g._min.created_at?.toISOString() ?? null,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    return NextResponse.json({
      success: true,
      data: {
        items,
        total_employees:    totalEmployees,
        total_pending_docs: totalPendingDocs,
        truncated:          totalEmployees > items.length,
      },
    })
  } catch (error) {
    console.error('Pending verifications error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load pending verifications' },
      { status: 500 }
    )
  }
}
