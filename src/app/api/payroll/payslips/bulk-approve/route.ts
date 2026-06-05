import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/payroll/payslips/bulk-approve
 *
 * Approve a *subset* of payslips in one round-trip. Powers the dashboard's
 * "Approve Selected" action when HR wants to release some employees' payslips
 * (e.g. finalize the engineering team) while still iterating on others.
 *
 * Body: { payslip_ids: string[] }
 *
 * Side effects per approved payslip:
 *   - is_published = true
 *   - hr_approved_at, hr_approved_by stamped
 *   - payslip email sent to the employee
 *
 * Run-level side effects (once per call):
 *   - If approving these payslips means every payslip in the run is now
 *     approved, flip the run status to 'approved' and notify HR admins —
 *     matches the behaviour of the whole-run approve endpoint.
 *
 * Already-approved payslips in the input are silently ignored (idempotent).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { org_id } = session.user

    const body = await req.json().catch(() => ({}))
    const payslipIds: unknown = body?.payslip_ids
    if (!Array.isArray(payslipIds) || payslipIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'payslip_ids must be a non-empty array' },
        { status: 400 }
      )
    }
    // Sanity-cap so a runaway client (e.g. "select 10k") doesn't blow up.
    if (payslipIds.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Too many payslips in one request (max 5000)' },
        { status: 400 }
      )
    }
    const ids = payslipIds.filter((x): x is string => typeof x === 'string')

    // Fetch all candidate payslips up-front (with employee email + run id) so
    // we can: (a) verify org ownership, (b) skip ones already approved,
    // (c) send emails after the update without a second join.
    const payslips = await prisma.payslip.findMany({
      where: { id: { in: ids }, org_id },
      include: {
        employee: {
          select: { first_name: true, last_name: true, email: true },
        },
      },
    })

    // If any ID was rejected by the org filter, refuse — likely a bug in the
    // client (or worse, an attempt to approve another org's payslips).
    if (payslips.length !== ids.length) {
      return NextResponse.json(
        { success: false, error: 'Some payslip IDs are invalid or belong to another organisation' },
        { status: 403 }
      )
    }

    const toApprove = payslips.filter(p => !p.hr_approved_at)
    if (toApprove.length === 0) {
      return NextResponse.json({
        success: true,
        data: { approved: 0, already_approved: payslips.length, run_finalized: false },
      })
    }

    const now = new Date()
    await prisma.payslip.updateMany({
      where: { id: { in: toApprove.map(p => p.id) } },
      data: {
        hr_approved_by: session.user.id,
        hr_approved_at: now,
        is_published:   true,
      },
    })

    // ── Side effects ──────────────────────────────────────
    // Emails: best-effort, don't fail the request if SMTP hiccups.
    const monthNames = ['January','February','March','April','May','June',
      'July','August','September','October','November','December']
    const org = await prisma.organisation.findUnique({
      where: { id: org_id },
      select: { name: true },
    })

    try {
      const { sendPayslipEmail } = await import('@/lib/email')
      // Fire emails in parallel — SMTP latency dominates, no point serializing.
      await Promise.allSettled(toApprove.map(p =>
        sendPayslipEmail({
          to:        p.employee.email,
          name:      `${p.employee.first_name} ${p.employee.last_name}`,
          month:     monthNames[p.month - 1],
          year:      p.year,
          netSalary: Number(p.net_salary),
          company:   org?.name ?? 'Your Company',
        })
      ))
    } catch (emailErr) {
      console.error('Bulk-approve: payslip email batch failed:', emailErr)
    }

    // Run finalization: if every payslip in each affected run is now approved,
    // promote the run to 'approved' too — keeps reporting accurate without
    // requiring HR to make a separate "finalize" click.
    const affectedRunIds = Array.from(new Set(toApprove.map(p => p.payroll_run_id)))
    let runFinalized = false
    for (const runId of affectedRunIds) {
      const remaining = await prisma.payslip.count({
        where: { payroll_run_id: runId, org_id, hr_approved_at: null },
      })
      if (remaining === 0) {
        const run = await prisma.payrollRun.findUnique({
          where: { id: runId },
          select: { status: true, month: true, year: true },
        })
        if (run && run.status !== 'approved') {
          await prisma.payrollRun.update({
            where: { id: runId },
            data: { status: 'approved', approved_by: session.user.id },
          })
          runFinalized = true
          try {
            const { notifyHRAdmins } = await import('@/lib/notifications')
            await notifyHRAdmins(
              org_id,
              'Payroll Approved',
              `Payroll for ${run.month}/${run.year} has been fully approved. All payslips are now visible to employees.`,
              'success'
            )
          } catch (notifyErr) {
            console.error('Bulk-approve: HR notify failed:', notifyErr)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        approved:         toApprove.length,
        already_approved: payslips.length - toApprove.length,
        run_finalized:    runFinalized,
      },
    })
  } catch (error) {
    console.error('Bulk-approve error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to approve payslips' },
      { status: 500 }
    )
  }
}
