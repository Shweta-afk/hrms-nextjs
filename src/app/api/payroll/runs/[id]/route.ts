import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { status } = await req.json()

    if (!['approved', 'paid', 'locked'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    const run = await prisma.payrollRun.findFirst({
      where: { id: id, org_id: session.user.org_id },
    })

    if (!run) {
      return NextResponse.json({ success: false, error: 'Payroll run not found' }, { status: 404 })
    }

    const updated = await prisma.payrollRun.update({
      where: { id: id },
      data: {
        status,
        ...(status === 'approved' && { approved_by: session.user.id }),
        ...(status === 'paid' && { paid_at: new Date() }),
      },
    })

    // Publish payslips when approved.
    // We also stamp hr_approved_at / hr_approved_by here — without it,
    // the employee-facing /api/payroll/payslips filter (which requires
    // hr_approved_at IS NOT NULL) would hide payslips even after a
    // whole-run approval. The bulk-approve path also sets these, so
    // both code paths leave payslips in the same observable state.
    if (status === 'approved') {
      await prisma.payslip.updateMany({
        where: {
          org_id: session.user.org_id,
          payroll_run_id: id,
          hr_approved_at: null, // don't overwrite per-payslip approvals
        },
        data: {
          is_published:   true,
          hr_approved_at: new Date(),
          hr_approved_by: session.user.id,
        },
      })

      const { notifyHRAdmins } = await import('@/lib/notifications')
      await notifyHRAdmins(
        session.user.org_id,
        'Payroll Approved',
        `Payroll for ${run.month}/${run.year} has been approved. Payslips are now visible to employees.`,
        'success'
      )
    }

    // Send payslip emails only when approving — not on paid/locked transitions
    if (status !== 'approved') {
      return NextResponse.json({ success: true, data: updated })
    }

    try {
      const { sendPayslipEmail } = await import('@/lib/email')
      const org = await prisma.organisation.findUnique({ where: { id: session.user.org_id } })
      const payslips = await prisma.payslip.findMany({
        where: { payroll_run_id: id, org_id: session.user.org_id },
        include: {
          employee: {
            select: { first_name: true, last_name: true, email: true }
          }
        }
      })

      const monthNames = ['January','February','March','April','May','June',
        'July','August','September','October','November','December']

      for (const payslip of payslips) {
        await sendPayslipEmail({
          to: payslip.employee.email,
          name: `${payslip.employee.first_name} ${payslip.employee.last_name}`,
          month: monthNames[payslip.month - 1],
          year: payslip.year,
          netSalary: Number(payslip.net_salary),
          company: org?.name ?? 'Your Company',
        })
      }
    } catch (emailErr) {
      console.error('Failed to send payslip emails:', emailErr)
    }

    return NextResponse.json({ success: true, data: updated })

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update payroll run' }, { status: 500 })
  }
}