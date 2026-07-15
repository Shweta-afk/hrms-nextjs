import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * PATCH /api/payroll/payslips/[id]/edit
 *
 * Per-payslip line-item editor. Built because the Excel-based Upload
 * Adjustments flow can only realistically change the net (the export
 * template doesn't carry separate Basic / HRA / PF / ESI / PT / TDS
 * columns), and the system was reconciling by silently appending a
 * single "Adjustment" line — leaving the breakdown looking unchanged
 * even though net moved. This endpoint lets HR overwrite any earning or
 * deduction line item directly, so both the payslip view and the payroll
 * row reflect the new values truthfully.
 *
 * Body:
 *   {
 *     earnings:   { [label: string]: number },
 *     deductions: { [label: string]: number },
 *     reason:     string  // required, ≥10 chars — stored on adjustment_note
 *   }
 *
 * Behaviour:
 *   - Refuses payslips already HR-approved. HR must unapprove first.
 *     This is consistent with /import-adjustments — once a payslip is
 *     approved + emailed it is locked.
 *   - Snapshots original_earnings / original_deductions / original_net_salary
 *     on the first edit (so the line-through "original ₹X → ₹Y" comparison
 *     in the Payroll page shows the *pre-edit* baseline, not the most-
 *     recent intermediate value if HR opens-saves-opens-saves).
 *   - Recomputes gross_salary, total_deductions, net_salary from the
 *     submitted line items. The client sends only the breakdown — derived
 *     totals belong to the server so the math is canonical.
 *   - Strips zero-valued lines before storing — keeps the payslip
 *     breakdown clean (a deduction of ₹0 is just noise) without forcing
 *     HR to delete each one from the form.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json().catch(() => ({})) as {
      earnings?:   Record<string, number>
      deductions?: Record<string, number>
      reason?:     string
    }

    const reason = (body.reason ?? '').trim()
    if (reason.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Reason is required (at least 10 characters)' },
        { status: 400 }
      )
    }
    if (!body.earnings || typeof body.earnings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'earnings object is required' },
        { status: 400 }
      )
    }
    if (!body.deductions || typeof body.deductions !== 'object') {
      return NextResponse.json(
        { success: false, error: 'deductions object is required' },
        { status: 400 }
      )
    }

    const payslip = await prisma.payslip.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!payslip) {
      return NextResponse.json({ success: false, error: 'Payslip not found' }, { status: 404 })
    }

    if (payslip.hr_approved_at) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payslip is HR-approved. Unapprove it from the payroll page before editing line items.',
        },
        { status: 409 }
      )
    }

    // Normalize each map: coerce values to integer rupees, drop NaN / negative
    // / zero entries. Negative values on a line item rarely make sense (a
    // negative deduction would be an earning, etc.) — HR can add a separate
    // "Adjustment" line instead.
    const normalize = (raw: Record<string, unknown>): Record<string, number> => {
      const out: Record<string, number> = {}
      for (const [key, value] of Object.entries(raw)) {
        const label = String(key).trim()
        if (!label) continue
        const n = Math.round(Number(value))
        if (!Number.isFinite(n) || n <= 0) continue
        out[label] = n
      }
      return out
    }

    const newEarnings   = normalize(body.earnings)
    const newDeductions = normalize(body.deductions)

    const sum = (obj: Record<string, number>) =>
      Object.values(obj).reduce((a, b) => a + b, 0)
    const newGross    = sum(newEarnings)
    const newTotalDed = sum(newDeductions)
    const newNet      = newGross - newTotalDed

    // Snapshot pre-edit values on the FIRST edit only — re-editing should not
    // overwrite the snapshot, otherwise the "original" reference disappears
    // after the second save. is_manually_adjusted is the canonical flag.
    const isFirstEdit = !payslip.is_manually_adjusted
    const origEarnings   = isFirstEdit ? payslip.earnings        : payslip.original_earnings
    const origDeductions = isFirstEdit ? payslip.deductions      : payslip.original_deductions
    const origNet        = isFirstEdit ? Number(payslip.net_salary) : payslip.original_net_salary

    const updated = await prisma.payslip.update({
      where: { id },
      data: {
        earnings:          newEarnings,
        deductions:        newDeductions,
        gross_salary:      newGross,
        total_deductions:  newTotalDed,
        net_salary:        newNet,
        is_manually_adjusted: true,
        // Prisma's JSON column wants InputJsonValue | DbNull. Cast the
        // Prisma JsonValue from the original snapshot through the same
        // type — they're structurally compatible at runtime but the
        // declared types differ.
        original_earnings:    (origEarnings   ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
        original_deductions:  (origDeductions ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
        original_net_salary:  origNet,
        adjustment_note:      reason,
      },
    })

    // Recalculate PayrollRun totals so the "Net Payout" header stays accurate
    const totals = await prisma.payslip.aggregate({
      where: { org_id: session.user.org_id, payroll_run_id: payslip.payroll_run_id },
      _sum: { gross_salary: true, total_deductions: true, net_salary: true },
    })
    await prisma.payrollRun.update({
      where: { id: payslip.payroll_run_id },
      data: {
        total_gross:       Number(totals._sum.gross_salary      ?? 0),
        total_deductions:  Number(totals._sum.total_deductions  ?? 0),
        total_net:         Number(totals._sum.net_salary        ?? 0),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Payslip edit error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update payslip' },
      { status: 500 }
    )
  }
}
