import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { calculatePF, calculateESI, calculatePT, calculateTDS } from '@/lib/payroll/compliance'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { payroll_run_id } = await req.json()

    const run = await prisma.payrollRun.findFirst({
      where: { id: payroll_run_id, org_id: session.user.org_id },
    })

    if (!run) {
      return NextResponse.json({ success: false, error: 'Payroll run not found' }, { status: 404 })
    }

    if (run.status === 'approved') {
      return NextResponse.json({ success: false, error: 'Payroll already approved' }, { status: 400 })
    }

    const employees = await prisma.employee.findMany({
      where: { org_id: session.user.org_id, status: 'active' },
      select: { id: true, first_name: true, ctc_annual: true },
    })

    const workingDays = getWorkingDays(run.year, run.month)

    // Use these to accumulate totals — distinct names to avoid shadowing
    let runTotalGross = 0
    let runTotalDeductions = 0
    let runTotalNet = 0

    for (const employee of employees) {
      // Timezone-safe date range for the month
      const fromDate = new Date(Date.UTC(run.year, run.month - 1, 1))
      const toDate = new Date(Date.UTC(run.year, run.month, 0, 23, 59, 59))

      const attendance = await prisma.attendanceRecord.findMany({
        where: {
          org_id: session.user.org_id,
          employee_id: employee.id,
          date: { gte: fromDate, lte: toDate },
        },
      })

      const presentDays = attendance.filter(a =>
        a.status === 'present' || a.status === 'late'
      ).length

      // No attendance records = assume full attendance (benefit of doubt)
      const lopDays = attendance.length === 0
        ? 0
        : Math.max(0, workingDays - presentDays)

      // Salary calculation
      const ctcAnnual = employee.ctc_annual ? Number(employee.ctc_annual) : 600000
      const ctcMonthly = ctcAnnual / 12

      const basic = Math.round(ctcMonthly * 0.40)
      const hra = Math.round(basic * 0.50)
      const special = Math.round(ctcMonthly - basic - hra)
      const grossSalary = basic + hra + special

      // LOP
      const lopAmount = lopDays > 0
        ? Math.round((grossSalary / workingDays) * lopDays)
        : 0

      // Statutory
      const pf = calculatePF(basic)
      const esi = calculateESI(grossSalary)
      const pt = calculatePT(grossSalary, 'maharashtra', run.month - 1)
      const tds = calculateTDS(grossSalary * 12, 'new')

      const earnings = {
        Basic: basic,
        HRA: hra,
        'Special Allowance': special,
      }

      const empDeductions: Record<string, number> = {}
      if (lopAmount > 0) empDeductions['Loss of Pay'] = lopAmount
      if (pf.employee > 0) empDeductions['PF Employee'] = pf.employee
      if (esi.applicable) empDeductions['ESI Employee'] = esi.employee
      if (pt > 0) empDeductions['Professional Tax'] = pt
      if (tds > 0) empDeductions['TDS'] = tds

      const empTotalDeductions = Object.values(empDeductions).reduce((a, b) => a + b, 0)
      const netSalary = Math.max(0, grossSalary - empTotalDeductions)

      await prisma.payslip.upsert({
        where: {
          org_id_employee_id_month_year: {
            org_id: session.user.org_id,
            employee_id: employee.id,
            month: run.month,
            year: run.year,
          },
        },
        update: {
          working_days: workingDays,
          present_days: presentDays,
          earnings,
          deductions: empDeductions,
          gross_salary: grossSalary,
          total_deductions: empTotalDeductions,
          net_salary: netSalary,
        },
        create: {
          org_id: session.user.org_id,
          employee_id: employee.id,
          payroll_run_id: run.id,
          month: run.month,
          year: run.year,
          working_days: workingDays,
          present_days: presentDays,
          earnings,
          deductions: empDeductions,
          gross_salary: grossSalary,
          total_deductions: empTotalDeductions,
          net_salary: netSalary,
        },
      })

      runTotalGross += grossSalary
      runTotalDeductions += empTotalDeductions
      runTotalNet += netSalary
    }

    const updatedRun = await prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        status: 'processing',
        total_gross: runTotalGross,
        total_deductions: runTotalDeductions,
        total_net: runTotalNet,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        run: updatedRun,
        employees_processed: employees.length,
        total_gross: runTotalGross,
        total_net: runTotalNet,
      },
    })
  } catch (error) {
    console.error('Payroll run error:', error)
    return NextResponse.json({ success: false, error: 'Payroll processing failed' }, { status: 500 })
  }
}

function getWorkingDays(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}