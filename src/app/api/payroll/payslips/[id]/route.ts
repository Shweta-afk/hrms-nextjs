import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { safeDecrypt } from '@/lib/encryption'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Employees can only see their OWN published payslips — must scope by employee_id,
    // not just org_id, otherwise any employee can read any colleague's payslip by guessing UUIDs.
    const isEmployee = session.user.role === 'employee'
    if (isEmployee && !session.user.employee_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const payslip = await prisma.payslip.findFirst({
      where: {
        id: id,
        org_id: session.user.org_id,
        ...(isEmployee && {
          employee_id: session.user.employee_id,
          is_published: true,
          // Employees can only view payslips that have been HR approved
          hr_approved_at: { not: null },
        }),
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
            bank_details: true,
            statutory_info: true,
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

    // Decrypt bank_details and statutory_info server-side
    const bankDetailsDecrypted = safeDecrypt(payslip.employee.bank_details) as {
      bank_name?: string; account_number?: string; ifsc_code?: string; branch?: string
    } | null
    const statutoryInfoDecrypted = safeDecrypt(payslip.employee.statutory_info) as {
      pan_number?: string; uan_number?: string; pf_number?: string; aadhar_number?: string
    } | null

    const data = {
      ...payslip,
      hr_approved_by: payslip.hr_approved_by,
      hr_approved_at: payslip.hr_approved_at,
      employee: {
        ...payslip.employee,
        bank_details: undefined,
        statutory_info: undefined,
        bank_details_decrypted: bankDetailsDecrypted,
        statutory_info_decrypted: statutoryInfoDecrypted,
      },
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch payslip' }, { status: 500 })
  }
}