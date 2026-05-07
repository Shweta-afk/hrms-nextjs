import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payslip = await prisma.payslip.findFirst({
      where: {
        id: id,
        org_id: session.user.org_id,
        // Employees can only see their own published payslips
        ...(session.user.role === 'employee' && { is_published: true }),
      },
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            emp_code: true,
            email: true,
            date_of_joining: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
        payroll_run: {
          select: { id: true, month: true, year: true, status: true },
        },
      },
    })

    if (!payslip) {
      return NextResponse.json({ success: false, error: 'Payslip not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: payslip })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch payslip' }, { status: 500 })
  }
}