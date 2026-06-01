import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculatePF, calculateESI, calculatePT, calculateTDS } from '@/lib/payroll/compliance'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { payroll_run_id, ot_rate_per_hour = 0, period_from, period_to } = await req.json()

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

    // Salary period — HR can override the default full-month range.
    const monthStart = period_from
      ? new Date(period_from)
      : new Date(Date.UTC(run.year, run.month - 1, 1))
    const monthEnd = period_to
      ? new Date(period_to + 'T23:59:59Z')
      : new Date(Date.UTC(run.year, run.month, 0, 23, 59, 59))

    // Persist period on the run so it's visible later
    if (period_from || period_to) {
      await prisma.payrollRun.update({
        where: { id: run.id },
        data: {
          ...(period_from && { period_from: new Date(period_from) }),
          ...(period_to   && { period_to:   new Date(period_to + 'T23:59:59Z') }),
        },
      })
    }
    const holidays = await prisma.holiday.findMany({
      where: {
        org_id: session.user.org_id,
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { date: true, type: true },
    })
    // 'working_day' holidays = Sundays/holidays that HR marked as working days
    const workingDayOverrides = holidays
      .filter(h => h.type === 'working_day')
      .map(h => new Date(h.date).toISOString().slice(0, 10))

    // org-level working days (used as fallback for employees without a shift group)
    const orgWorkingDays = getWorkingDaysInPeriod(monthStart, monthEnd, weeklyOffs, holidays, workingDayOverrides)

    // Calendar days in the actual payroll period (e.g. 21 Apr–20 May = 30)
    const periodCalendarDays = Math.round((monthEnd.getTime() - monthStart.getTime()) / 86_400_000)

    // ── Statutory toggle flags — opt-in only (not applied unless HR enables them) ──
    const pfApplicable  = settings.pf_applicable  === true
    const esiApplicable = settings.esi_applicable === true
    const ptApplicable  = settings.pt_applicable  === true
    const tdsApplicable = settings.tds_applicable === true

    // ── Late penalty tiers ──────────────────────────────────────────────────
    // Format: [{ from_min, to_min, deduction_pct, is_half_day }]
    type LateTier = { from_min: number; to_min: number | null; deduction_pct?: number; is_half_day?: boolean }
    const latePenaltyConfig = settings.late_penalty as { enabled?: boolean; tiers?: LateTier[] } | undefined
    const latePenaltyEnabled = latePenaltyConfig?.enabled === true
    const lateTiers: LateTier[] = latePenaltyConfig?.tiers ?? []

    // ── Half-day early-departure cutoff ────────────────────────────────────
    const halfDayCutoffStr = (settings.half_day_cutoff as string | undefined) ?? '14:00'
    const [hCut, mCut] = halfDayCutoffStr.split(':').map(Number)

    // Remove stale payslips for employees who are now excluded or no longer active
    await prisma.payslip.deleteMany({
      where: {
        org_id: session.user.org_id,
        payroll_run_id: run.id,
        employee: { OR: [{ exclude_from_payroll: true }, { status: { not: 'active' } }] },
      },
    })

    const employees = await prisma.employee.findMany({
      where: { org_id: session.user.org_id, status: 'active', exclude_from_payroll: false },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        emp_code: true,
        ctc_annual: true,
        monthly_incentive: true,
        salary_structure_id: true,
        salary_structure: { select: { id: true, name: true, components: true, is_default: true } },
        shift_group_id: true,
        shift_group: { select: { weekly_offs: true } },
        date_of_joining: true,
        bank_details: true,
      },
    })

    // Prefer the structure marked as default; fall back to the first one if none is set
    const defaultStructure =
      await prisma.salaryStructure.findFirst({ where: { org_id: session.user.org_id, is_default: true } }) ??
      await prisma.salaryStructure.findFirst({ where: { org_id: session.user.org_id }, orderBy: { created_at: 'asc' } })

    logger.info('payroll_structure_resolved', {
      org_id: session.user.org_id,
      structure_id: defaultStructure?.id ?? null,
      structure_name: defaultStructure?.name ?? null,
      components_count: Array.isArray(defaultStructure?.components) ? (defaultStructure.components as any[]).length : 0,
    })

    const allAttendance = await prisma.attendanceRecord.findMany({
      where: {
        org_id: session.user.org_id,
        employee_id: { in: employees.map(e => e.id) },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { employee_id: true, status: true, overtime_hours: true, is_late: true, late_by_minutes: true, last_out: true },
    })

    // Group attendance by employee_id for O(1) lookup
    const attendanceByEmp = new Map<string, typeof allAttendance>()
    for (const rec of allAttendance) {
      const list = attendanceByEmp.get(rec.employee_id) ?? []
      list.push(rec)
      attendanceByEmp.set(rec.employee_id, list)
    }

    let runTotalGross = 0
    let runTotalDeductions = 0
    let runTotalNet = 0
    const zeroAttendanceEmployees: Array<{ emp_code?: string | null; first_name: string; id: string }> = []

    for (const employee of employees) {
      const attendance = attendanceByEmp.get(employee.id) ?? []

      if (attendance.length === 0) {
        zeroAttendanceEmployees.push({
          id: employee.id,
          first_name: employee.first_name,
          emp_code: employee.emp_code,
        })
      }

      // ── Working days in the period for this employee (LOP calculation only) ──
      const empWeeklyOffs = (employee.shift_group as any)?.weekly_offs as number[] | null
      const workingDays = empWeeklyOffs
        ? getWorkingDaysInPeriod(monthStart, monthEnd, empWeeklyOffs, holidays, workingDayOverrides)
        : orgWorkingDays

      // ── Attendance counts ──
      // wfh = weekend/holiday half-day working (HD in SmartOffice) = full salary day
      const fullPresentDays = attendance.filter(
        a => a.status === 'present' || a.status === 'late' || a.status === 'pending_review' || a.status === 'wfh'
      ).length
      const halfDayCount = attendance.filter(a => a.status === 'half_day').length
      const effectivePresentDays = fullPresentDays + halfDayCount * 0.5
      const lopDays = Math.max(0, workingDays - effectivePresentDays)

      const totalOtHours = attendance.reduce(
        (sum, a) => sum + (a.overtime_hours ? Number(a.overtime_hours) : 0),
        0
      )
      const otPay = ot_rate_per_hour > 0 ? Math.round(totalOtHours * ot_rate_per_hour) : 0

      const ctcAnnual = employee.ctc_annual ? Number(employee.ctc_annual) : 300_000
      const ctcMonthly = ctcAnnual / 12
      // Per-day rate = monthly CTC / actual calendar days in payroll period
      const dailySalary = ctcMonthly / periodCalendarDays

      const structure = (employee.salary_structure ?? defaultStructure) as any
      const components = (structure?.components as any[]) ?? null

      let basic = 0, hra = 0
      // structureEarnings holds the per-component breakdown actually stored in the payslip
      let structureEarnings: Record<string, number> | null = null

      if (components && Array.isArray(components)) {
        structureEarnings = {}
        for (const comp of components) {
          if (comp.type !== 'earning') continue
          let amount = 0
          // soFar = sum already allocated to earlier components (for remainder calc)
          const soFar = Object.values(structureEarnings).reduce((a, b) => a + b, 0)
          if (comp.calc_type === 'percentage_of_ctc') amount = Math.round(ctcMonthly * comp.value / 100)
          else if (comp.calc_type === 'percentage_of_basic') amount = Math.round(basic * comp.value / 100)
          else if (comp.calc_type === 'fixed') amount = comp.value
          else if (comp.calc_type === 'remainder') amount = Math.max(0, Math.round(ctcMonthly - soFar))
          if (comp.name === 'Basic') basic = amount
          else if (comp.name === 'HRA') hra = amount
          structureEarnings[comp.name] = amount
        }
        // No implicit components — gross = sum of whatever the structure defines
      } else {
        basic = Math.round(ctcMonthly * 0.40)
        hra = Math.round(basic * 0.50)
        const special = Math.round(ctcMonthly - basic - hra)
        structureEarnings = { Basic: basic, HRA: hra, 'Special Allowance': special }
      }

      const incentiveAmount = employee.monthly_incentive ? Math.round(Number(employee.monthly_incentive)) : 0
      // grossSalary = full monthly CTC — structure is for payslip breakdown display only
      const grossSalary = Math.round(ctcMonthly) + otPay + incentiveAmount

      const lopAmount = lopDays > 0
        ? Math.round((ctcMonthly / periodCalendarDays) * lopDays)
        : 0

      // ── Late penalty calculation ──────────────────────────────────────────
      let latePenaltyAmount = 0
      let latePenaltyHalfDays = 0
      if (latePenaltyEnabled && lateTiers.length > 0) {
        for (const rec of attendance) {
          if (!rec.is_late || rec.late_by_minutes === 0) continue
          const mins = rec.late_by_minutes
          const tier = lateTiers.find(
            t => mins >= t.from_min && (t.to_min === null || mins <= t.to_min)
          )
          if (!tier) continue
          if (tier.is_half_day) {
            latePenaltyHalfDays += 0.5
          } else if (tier.deduction_pct) {
            latePenaltyAmount += Math.round(dailySalary * tier.deduction_pct / 100)
          }
        }
      }
      if (latePenaltyHalfDays > 0) {
        latePenaltyAmount += Math.round(dailySalary * latePenaltyHalfDays)
      }

      // ── Statutory deductions — respect per-org toggles ───────────────────
      const pf  = pfApplicable  ? calculatePF(basic)                            : { employee: 0, applicable: false }
      const esi = esiApplicable ? calculateESI(grossSalary)                     : { applicable: false, employee: 0 }
      const pt  = ptApplicable  ? calculatePT(grossSalary, ptState, run.month - 1) : 0
      const tds = tdsApplicable ? calculateTDS(grossSalary * 12, tdsRegime)     : 0

      const earnings: Record<string, number> = {
        ...structureEarnings!,
        ...(incentiveAmount > 0 ? { Incentive: incentiveAmount } : {}),
        ...(otPay > 0 ? { [`OT Pay (${totalOtHours.toFixed(1)}h)`]: otPay } : {}),
      }

      const empDeductions: Record<string, number> = {}
      if (lopAmount > 0)          empDeductions['Loss of Pay']          = lopAmount
      if (latePenaltyAmount > 0)  empDeductions['Late Penalty']         = latePenaltyAmount
      if ((pf as any).employee > 0) empDeductions['PF (Employee)']      = (pf as any).employee
      if ((esi as any).applicable)  empDeductions['ESI (Employee)']     = (esi as any).employee
      if (pt > 0)                 empDeductions['Professional Tax']     = pt
      if (tds > 0)                empDeductions['TDS']                  = tds

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
          working_days: periodCalendarDays,
          present_days: effectivePresentDays,
          earnings,
          deductions: empDeductions,
          gross_salary: grossSalary,
          total_deductions: empTotalDeductions,
          net_salary: netSalary,
          // Reset manual adjustment flag when re-running payroll
          is_manually_adjusted: false,
          original_earnings: Prisma.DbNull,
          original_deductions: Prisma.DbNull,
          original_net_salary: null,
        },
        create: {
          org_id: session.user.org_id,
          employee_id: employee.id,
          payroll_run_id: run.id,
          month: run.month,
          year: run.year,
          working_days: periodCalendarDays,
          present_days: effectivePresentDays,
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
        working_days: orgWorkingDays,
        holidays_in_month: holidays.filter(h => h.type !== 'working_day').length,
        salary_structure_used: defaultStructure
          ? { id: defaultStructure.id, name: defaultStructure.name, components_count: Array.isArray(defaultStructure.components) ? (defaultStructure.components as any[]).length : 0 }
          : null,
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
 * Compute working days for a month.
 * - weeklyOffs:          day-of-week numbers to treat as off (0=Sun…6=Sat)
 * - holidays:            all holiday records for the month
 * - workingDayOverrides: ISO date strings (YYYY-MM-DD) that HR marked as
 *                        working days — these count even if they fall on a
 *                        weekly off (e.g. a working Sunday)
 */
/** Working days within an arbitrary date range (inclusive both ends). */
function getWorkingDaysInPeriod(
  from: Date,
  to: Date,
  weeklyOffs: number[],
  holidays: { date: Date; type: string }[],
  workingDayOverrides: string[],
): number {
  const overrideSet = new Set(workingDayOverrides)
  const holidaySet = new Set(
    holidays
      .filter(h => h.type !== 'working_day')
      .map(h => new Date(h.date).toISOString().slice(0, 10))
  )

  let count = 0
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))

  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10)
    const dow = cur.getUTCDay()
    if (weeklyOffs.includes(dow)) {
      if (overrideSet.has(iso)) count++ // HR marked this weekly-off as a working day
    } else if (!holidaySet.has(iso)) {
      count++
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}
