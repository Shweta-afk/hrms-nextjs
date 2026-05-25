import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePF, calculateESI, calculatePT, calculateTDS } from '@/lib/payroll/compliance'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { payroll_run_id, ot_rate_per_hour = 0 } = await req.json()

    const run = await prisma.payrollRun.findFirst({
      where: { id: payroll_run_id, org_id: session.user.org_id },
    })

    if (!run) {
      return NextResponse.json({ success: false, error: 'Payroll run not found' }, { status: 404 })
    }

    if (run.status === 'approved') {
      return NextResponse.json({ success: false, error: 'Payroll already approved' }, { status: 400 })
    }

    // Pull org settings to drive work-week, PT state, TDS regime.
    const org = await prisma.organisation.findUnique({
      where: { id: session.user.org_id },
      select: { settings: true },
    })
    const settings = (org?.settings ?? {}) as Record<string, unknown>

    // Working days: configurable per-org. 'work_week_days' = number of working days
    // per week (5 by default; many factories/shops use 6). 'weekly_offs' (optional)
    // lets you specify a different set of off days — defaults to Sunday only when
    // work_week_days=6, Saturday+Sunday when work_week_days=5.
    const workWeekDays = (settings.work_week_days as number) ?? 5
    const weeklyOffs: number[] =
      Array.isArray(settings.weekly_offs)
        ? (settings.weekly_offs as number[])
        : workWeekDays >= 6
          ? [0]      // Sunday only
          : [0, 6]   // Sun + Sat
    const ptState   = (settings.pt_state as string) ?? 'maharashtra'
    const tdsRegime: 'old' | 'new' = (settings.tds_regime as 'old' | 'new') ?? 'new'

    // Holidays falling inside this payroll month — subtract from working days.
    const monthStart = new Date(Date.UTC(run.year, run.month - 1, 1))
    const monthEnd   = new Date(Date.UTC(run.year, run.month, 0, 23, 59, 59))
    const holidays = await prisma.holiday.findMany({
      where: {
        org_id: session.user.org_id,
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { date: true, type: true },
    })
    // Only count holidays that fall on what would otherwise be a working day —
    // a holiday on Sunday shouldn't subtract a working day.
    const holidayDatesOnWorkingDays = holidays
      .map(h => new Date(h.date))
      .filter(d => !weeklyOffs.includes(d.getUTCDay()))

    const workingDays = getWorkingDays(run.year, run.month, weeklyOffs, holidayDatesOnWorkingDays.length)

    const employees = await prisma.employee.findMany({
      where: { org_id: session.user.org_id, status: 'active' },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        emp_code: true,
        ctc_annual: true,
        salary_structure_id: true,
        salary_structure: true,
      },
    })

    const defaultStructure = await prisma.salaryStructure.findFirst({
      where: { org_id: session.user.org_id, is_default: true },
    })

    let runTotalGross = 0
    let runTotalDeductions = 0
    let runTotalNet = 0
    const zeroAttendanceEmployees: Array<{ emp_code?: string | null; first_name: string; id: string }> = []

    for (const employee of employees) {
      const attendance = await prisma.attendanceRecord.findMany({
        where: {
          org_id: session.user.org_id,
          employee_id: employee.id,
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { status: true, overtime_hours: true },
      })

      // BUG-FIX: previously, "no attendance records = assume full attendance"
      // silently paid employees whose biometric never synced. New behaviour:
      // if zero records exist for the entire month, treat the employee as
      // absent for the whole period and let HR explicitly mark presence
      // (manual correction) or absent (LOP). Net result is zero pay for the
      // month until the issue is resolved — safer than overpaying.
      const presentDays = attendance.filter(
        a => a.status === 'present' || a.status === 'late'
      ).length
      const lopDays = Math.max(0, workingDays - presentDays)

      // Flag employees with zero attendance — likely a biometric sync issue,
      // not a deliberate absence. Surfaced in the response so the UI can warn.
      if (attendance.length === 0) {
        zeroAttendanceEmployees.push({
          id: employee.id,
          first_name: employee.first_name,
          emp_code: employee.emp_code,
        })
      }

      const totalOtHours = attendance.reduce(
        (sum, a) => sum + (a.overtime_hours ? Number(a.overtime_hours) : 0),
        0
      )
      const otPay = ot_rate_per_hour > 0 ? Math.round(totalOtHours * ot_rate_per_hour) : 0

      const ctcAnnual = employee.ctc_annual ? Number(employee.ctc_annual) : 300_000
      const ctcMonthly = ctcAnnual / 12

      const structure = (employee.salary_structure ?? defaultStructure) as any
      const components = (structure?.components as any[]) ?? null

      let basic: number, hra: number, special: number

      if (components && Array.isArray(components)) {
        basic = 0; hra = 0; let otherEarnings = 0
        for (const comp of components) {
          if (comp.type !== 'earning') continue
          let amount = 0
          if (comp.calc_type === 'percentage_of_ctc') amount = Math.round(ctcMonthly * comp.value / 100)
          else if (comp.calc_type === 'percentage_of_basic') amount = Math.round(basic * comp.value / 100)
          else if (comp.calc_type === 'fixed') amount = comp.value
          else if (comp.calc_type === 'remainder') amount = Math.round(ctcMonthly - basic - hra - otherEarnings)

          if (comp.name === 'Basic') basic = amount
          else if (comp.name === 'HRA') hra = amount
          else otherEarnings += amount
        }
        special = Math.round(ctcMonthly - basic - hra - otherEarnings)
      } else {
        basic = Math.round(ctcMonthly * 0.40)
        hra = Math.round(basic * 0.50)
        special = Math.round(ctcMonthly - basic - hra)
      }

      const grossSalary = basic + hra + special + otPay
      const baseSalary  = basic + hra + special
      const lopAmount   = lopDays > 0
        ? Math.round((baseSalary / workingDays) * lopDays)
        : 0

      // Statutory deductions — now use org settings.
      const pf  = calculatePF(basic)
      const esi = calculateESI(grossSalary)
      const pt  = calculatePT(grossSalary, ptState, run.month - 1)
      const tds = calculateTDS(grossSalary * 12, tdsRegime)

      const earnings: Record<string, number> = {
        Basic: basic,
        HRA: hra,
        'Special Allowance': special,
        ...(otPay > 0 ? { [`Overtime Pay (${totalOtHours.toFixed(1)}h)`]: otPay } : {}),
      }

      const empDeductions: Record<string, number> = {}
      if (lopAmount > 0)    empDeductions['Loss of Pay']      = lopAmount
      if (pf.employee > 0)  empDeductions['PF Employee']       = pf.employee
      if (esi.applicable)   empDeductions['ESI Employee']      = esi.employee
      if (pt > 0)           empDeductions['Professional Tax']  = pt
      if (tds > 0)          empDeductions['TDS']               = tds

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

    const warnings: string[] = []
    if (zeroAttendanceEmployees.length > 0) {
      warnings.push(
        `${zeroAttendanceEmployees.length} employee${zeroAttendanceEmployees.length === 1 ? '' : 's'} ` +
        `had no attendance records this month — full month treated as LOP. ` +
        `Likely cause: biometric sync issue, or attendance hasn't been imported yet. ` +
        `Add manual attendance corrections (or import the device data) before approving payroll.`
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        run: updatedRun,
        employees_processed: employees.length,
        total_gross: runTotalGross,
        total_net: runTotalNet,
        working_days: workingDays,
        holidays_in_month: holidayDatesOnWorkingDays.length,
        warnings,
        zero_attendance_employees: zeroAttendanceEmployees,
      },
    })
  } catch (error) {
    logger.error('payroll_run_failed', error)
    return NextResponse.json({ success: false, error: 'Payroll processing failed' }, { status: 500 })
  }
}

/**
 * Compute working days for a month, given the configured weekly offs and the
 * number of holidays already known to fall on otherwise-working days.
 */
function getWorkingDays(
  year: number,
  month: number,
  weeklyOffs: number[],
  workingDayHolidays: number,
): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (!weeklyOffs.includes(day)) count++
  }
  return Math.max(0, count - workingDayHolidays)
}
