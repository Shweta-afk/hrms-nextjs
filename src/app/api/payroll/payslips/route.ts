import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const employee_id = searchParams.get('employee_id')
    const payroll_run_id = searchParams.get('payroll_run_id')

    const where: any = {
      org_id: session.user.org_id,
      ...(month && { month: parseInt(month) }),
      ...(year && { year: parseInt(year) }),
      ...(employee_id && { employee_id }),
      ...(payroll_run_id && { payroll_run_id }),
      // Employees only see published payslips
      ...(session.user.role === 'employee' && { is_published: true }),
    }

    const payslips = await prisma.payslip.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            emp_code: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return NextResponse.json({ success: true, data: payslips })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch payslips' }, { status: 500 })
  }
}