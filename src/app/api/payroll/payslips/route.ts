import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { safeDecrypt } from '@/lib/encryption'

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

    const isEmployee = session.user.role === 'employee'

    const where: any = {
      org_id: session.user.org_id,
      ...(month && { month: parseInt(month) }),
      ...(year && { year: parseInt(year) }),
      // Employees can only see their own published + hr-approved payslips
      ...(isEmployee
        ? { employee_id: session.user.employee_id, is_published: true, hr_approved_at: { not: null } }
        : employee_id && { employee_id }),
      ...(payroll_run_id && { payroll_run_id }),
    }

    const payslips = await prisma.payslip.findMany({
      where: {
        ...where,
        employee: { exclude_from_payroll: false },
      },
      select: {
        id: true,
        month: true,
        year: true,
        working_days: true,
        present_days: true,
        earnings: true,
        deductions: true,
        gross_salary: true,
        total_deductions: true,
        net_salary: true,
        is_published: true,
        hr_approved_at: true,
        hr_approved_by: true,
        is_manually_adjusted: true,
        original_earnings: true,
        original_deductions: true,
        payroll_run_id: true,
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            emp_code: true,
            date_of_joining: true,
            bank_details: true,
            statutory_info: true,
            department:  { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    // Decrypt bank_details and statutory_info for each payslip (safe — null on failure)
    const data = payslips.map(p => ({
      ...p,
      hr_approved_at: p.hr_approved_at,
      hr_approved_by: p.hr_approved_by,
      is_published: p.is_published,
      employee: {
        ...p.employee,
        bank_details:             safeDecrypt(p.employee.bank_details),
        statutory_info:           undefined,
        statutory_info_decrypted: safeDecrypt(p.employee.statutory_info) as {
          pan_number?: string; uan_number?: string; pf_number?: string; aadhar_number?: string
        } | null,
      },
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch payslips' }, { status: 500 })
  }
}