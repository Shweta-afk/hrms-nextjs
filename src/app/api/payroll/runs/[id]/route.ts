import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { status } = await req.json()

    if (!['approved', 'paid', 'locked'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    const run = await prisma.payrollRun.findFirst({
      where: { id: params.id, org_id: session.user.org_id },
    })

    if (!run) {
      return NextResponse.json({ success: false, error: 'Payroll run not found' }, { status: 404 })
    }

    const updated = await prisma.payrollRun.update({
      where: { id: params.id },
      data: {
        status,
        ...(status === 'approved' && { approved_by: session.user.id }),
        ...(status === 'paid' && { paid_at: new Date() }),
      },
    })

    // Publish payslips when approved
    if (status === 'approved') {
      await prisma.payslip.updateMany({
        where: {
          org_id: session.user.org_id,
          payroll_run_id: params.id,
        },
        data: { is_published: true },
      })

      const { notifyHRAdmins } = await import('@/lib/notifications')
      await notifyHRAdmins(
        session.user.org_id,
        'Payroll Approved',
        `Payroll for ${run.month}/${run.year} has been approved. Payslips are now visible to employees.`,
        'success'
      )
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update payroll run' }, { status: 500 })
  }
}