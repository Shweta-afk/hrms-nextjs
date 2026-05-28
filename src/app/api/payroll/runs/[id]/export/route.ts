import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// XLSX loaded lazily inside handler — keeps cold-start lean

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const XLSX = await import('xlsx')
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const run = await prisma.payrollRun.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!run) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const payslips = await prisma.payslip.findMany({
      where: { org_id: session.user.org_id, payroll_run_id: id },
      include: {
        employee: {
          select: {
            first_name: true, last_name: true, emp_code: true,
            department:  { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { emp_code: 'asc' } },
    })

    // Collect all unique earning / deduction column names across payslips
    const earningKeys = new Set<string>()
    const deductionKeys = new Set<string>()
    for (const p of payslips) {
      Object.keys(p.earnings as Record<string, number>).forEach(k => earningKeys.add(k))
      Object.keys(p.deductions as Record<string, number>).forEach(k => deductionKeys.add(k))
    }
    const earnCols = Array.from(earningKeys)
    const deductCols = Array.from(deductionKeys)

    const headers = [
      'Emp Code', 'Employee Name', 'Department', 'Designation',
      'Working Days', 'Present Days', 'LOP Days',
      ...earnCols,
      'Gross Salary',
      ...deductCols,
      'Total Deductions', 'Net Salary',
      'Manual Adjustment', 'Adjustment Note',
    ]

    const rows = payslips.map(p => {
      const earnings   = p.earnings   as Record<string, number>
      const deductions = p.deductions as Record<string, number>
      const lopDays = Math.max(0, p.working_days - Number(p.present_days))
      return [
        p.employee.emp_code,
        `${p.employee.first_name} ${p.employee.last_name}`,
        p.employee.department?.name  ?? '',
        p.employee.designation?.name ?? '',
        p.working_days,
        Number(p.present_days),
        lopDays,
        ...earnCols.map(k => earnings[k] ?? 0),
        Number(p.gross_salary),
        ...deductCols.map(k => deductions[k] ?? 0),
        Number(p.total_deductions),
        Number(p.net_salary),
        p.is_manually_adjusted ? 'Yes' : 'No',
        p.adjustment_note ?? '',
      ]
    })

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

    // Column widths
    ws['!cols'] = headers.map((h, i) =>
      ({ wch: i <= 1 ? 24 : i <= 3 ? 18 : 12 })
    )

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll')

    const filename = `payroll-${MONTH_NAMES[run.month - 1]}-${run.year}-review.xlsx`
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Payroll export error:', error)
    return NextResponse.json({ success: false, error: 'Export failed' }, { status: 500 })
  }
}
