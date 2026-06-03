import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeDecrypt } from '@/lib/encryption'

// Convert 0-based column index to Excel column letter (A, B, ..., Z, AA, AB, ...)
function colLetter(idx: number): string {
  let result = ''
  let n = idx + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

const DAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

    // Period boundaries
    const periodStart: Date = run.period_from ?? new Date(Date.UTC(run.year, run.month - 1, 1))
    const periodEnd: Date   = run.period_to   ?? new Date(Date.UTC(run.year, run.month, 0))

    // All dates in period
    const allDates: Date[] = []
    const cur = new Date(periodStart)
    while (cur <= periodEnd) {
      allDates.push(new Date(cur))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    const dateStrings = allDates.map(d => d.toISOString().slice(0, 10))
    // Total days = actual calendar days in the payroll period (e.g. 21 Apr–20 May = 30)
    const totalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000)

    // Daily column headers: "21-Tue", "22-Wed", ...
    const dailyHeaders = allDates.map(d => {
      const dd  = String(d.getUTCDate()).padStart(2, '0')
      const dow = DAY_ABBREV[d.getUTCDay()]
      return `${dd}-${dow}`
    })

    // Payslips + employee data — skip employees excluded from payroll
    const payslips = await prisma.payslip.findMany({
      where: { payroll_run_id: id, org_id: session.user.org_id, employee: { exclude_from_payroll: false } },
      include: {
        employee: {
          select: {
            id: true, emp_code: true, first_name: true, last_name: true,
            bank_details: true,
            designation: { select: { name: true } },
            department:  { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { emp_code: 'asc' } },
    })

    // Org settings — for late penalty policy
    const org = await prisma.organisation.findUnique({
      where: { id: session.user.org_id },
      select: { settings: true },
    })
    const settings = (org?.settings ?? {}) as Record<string, unknown>
    type LateTier = { from_min: number; to_min: number | null; deduction_pct?: number; is_half_day?: boolean }
    const latePenaltyCfg = settings.late_penalty as { enabled?: boolean; tiers?: LateTier[] } | undefined
    const latePenaltyEnabled = latePenaltyCfg?.enabled === true
    const lateTiers: LateTier[] = latePenaltyCfg?.tiers ?? []

    // Load all attendance in one query
    const employeeIds = payslips.map(p => p.employee.id)
    const allAttendance = await prisma.attendanceRecord.findMany({
      where: {
        org_id: session.user.org_id,
        employee_id: { in: employeeIds },
        date: { gte: periodStart, lte: periodEnd },
      },
      select: { employee_id: true, date: true, status: true, is_late: true, late_by_minutes: true },
    })
    const attByEmp = new Map<string, typeof allAttendance>()
    for (const a of allAttendance) {
      const list = attByEmp.get(a.employee_id) ?? []
      list.push(a)
      attByEmp.set(a.employee_id, list)
    }

    // ── Column index map ──────────────────────────────────────────────────────
    const C = {
      SR:          0,
      CODE:        1,
      NAME:        2,
      DESIG:       3,
      DAILY_START: 4,
    } as Record<string, number>
    C.DAILY_END      = C.DAILY_START + dailyHeaders.length - 1
    C.TOT_PRESENT    = C.DAILY_END + 1
    C.TOT_ABSENT     = C.TOT_PRESENT + 1
    C.TOT_HALF_DAY   = C.TOT_ABSENT + 1
    C.TOT_PAID_LEAVE = C.TOT_HALF_DAY + 1
    C.TOT_WFH        = C.TOT_PAID_LEAVE + 1
    C.TOT_HD         = C.TOT_WFH + 1
    C.SALARY_DAYS    = C.TOT_HD + 1
    C.TOTAL_DAYS     = C.SALARY_DAYS + 1
    C.CIRCLE_COUNT   = C.TOTAL_DAYS + 1
    C.LATE_MARK      = C.CIRCLE_COUNT + 1
    C.ACT_SALARY     = C.LATE_MARK + 1
    C.PER_DAY        = C.ACT_SALARY + 1
    C.TOT_SALARY     = C.PER_DAY + 1
    C.ACT_HALF_DAY   = C.TOT_SALARY + 1
    C.HD_LATE_DED    = C.ACT_HALF_DAY + 1
    C.LATE_DED       = C.HD_LATE_DED + 1
    C.NET_SALARY     = C.LATE_DED + 1
    C.DEDUCTIONS     = C.NET_SALARY + 1
    C.SAL_ADVANCE    = C.DEDUCTIONS + 1
    C.PREV_SAL       = C.SAL_ADVANCE + 1
    C.TO_CREDIT      = C.PREV_SAL + 1
    C.TOT_DEDUCTION  = C.TO_CREDIT + 1
    C.ADJUSTMENT     = C.TOT_DEDUCTION + 1
    C.BENE_NAME      = C.ADJUSTMENT + 1
    C.ACCOUNT_NO     = C.BENE_NAME + 1
    C.IFSC           = C.ACCOUNT_NO + 1
    C.FINAL_REMARK   = C.IFSC + 1
    C.REMARK_DETAILS = C.FINAL_REMARK + 1
    const TOTAL_COLS = C.REMARK_DETAILS + 1

    // ── Period label for sheet name and header ─────────────────────────────
    const fmtShort = (d: Date) =>
      d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    const periodLabel = `${fmtShort(periodStart)} - ${fmtShort(periodEnd)}`
    const safeSheetName = periodLabel.slice(0, 31)

    // ── Build worksheet manually for formula support ───────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: any = {}

    // Helper: set cell value
    const setNum = (col: number, row: number, v: number) => {
      ws[`${colLetter(col)}${row}`] = { t: 'n', v }
    }
    const setStr = (col: number, row: number, v: string) => {
      ws[`${colLetter(col)}${row}`] = { t: 's', v }
    }
    const setFormula = (col: number, row: number, f: string) => {
      ws[`${colLetter(col)}${row}`] = { t: 'n', f }
    }

    // ── Header row (row 1) ─────────────────────────────────────────────────
    const headers = [
      'Sr. No',
      'Code',
      `Employee Name (${periodLabel})`,
      'Designation',
      ...dailyHeaders,
      'Total Present', 'Total Absent', 'Total Half Day', 'Total Paid Leave', 'Total WFH', 'Total HD',
      'Salary Days', 'Total Days', 'Circle Count', 'Total Late Mark',
      'Actual Salary', 'Per Day', 'Total Salary',
      'Actual Half Day', 'Half Day for Late Mark', 'Late Mark', 'Net Salary',
      'Deductions if any', 'Salary Advance', 'Previous Salary add',
      'To be Credited', 'Total Deduction', 'Adjustment',
      'Beneficiary Name', 'Account No.', 'IFSC Code', 'Final Remark', 'Remark Details',
    ]
    for (let c = 0; c < headers.length; c++) {
      ws[`${colLetter(c)}1`] = { t: 's', v: headers[c] }
    }

    // ── Data rows ──────────────────────────────────────────────────────────
    payslips.forEach((ps, idx) => {
      const row = idx + 2
      const emp = ps.employee
      const bank = safeDecrypt(emp.bank_details) as {
        account_number?: string; account_holder_name?: string; ifsc_code?: string
      } | null

      // Attendance counts for this employee
      const empAtt = attByEmp.get(emp.id) ?? []
      const attMap = new Map(empAtt.map(a => [new Date(a.date).toISOString().slice(0, 10), a]))

      // Only count as "Late Mark" if it meets the first penalty tier threshold
      const lateMinThreshold = lateTiers.length > 0 ? Math.min(...lateTiers.map(t => t.from_min)) : 1

      let presentCount = 0, absentCount = 0, halfDayCount = 0, paidLeaveCount = 0, wfhCount = 0, lateCount = 0

      const dailyVals = dateStrings.map(ds => {
        const rec = attMap.get(ds)
        if (!rec) {
          const dow = new Date(ds + 'T00:00:00Z').getUTCDay()
          if (dow === 0 || dow === 6) return ''
          absentCount++
          return 'A'
        }
        switch (rec.status) {
          case 'present':
            if (rec.is_late && rec.late_by_minutes >= lateMinThreshold) lateCount++
            presentCount++
            return 'P'
          case 'late':
            if (rec.late_by_minutes >= lateMinThreshold) lateCount++
            presentCount++
            return 'P'
          case 'half_day':
            halfDayCount++
            return 'Half Day'
          case 'wfh':
            wfhCount++
            return 'HD'  // weekend/holiday half-day working — matches HR template
          case 'leave':
            paidLeaveCount++
            return 'L'
          case 'absent':
            absentCount++
            return 'A'
          case 'holiday':
            return 'H'
          case 'weekly_off':
          case 'weekend':
            return ''
          default:
            return rec.status.toUpperCase()
        }
      })

      // Salary days: full present + wfh + paid leave + half days (half days then lose 0.5 via ACT_HALF_DAY deduction)
      const salaryDays = presentCount + wfhCount + paidLeaveCount + halfDayCount

      const actualSalary = Number(ps.gross_salary)
      const perDayApprox = totalDays > 0 ? actualSalary / totalDays : 0

      // Apply late penalty policy from org settings
      let circleCount = 0       // lates that trigger a half-day deduction (is_half_day tiers)
      let lateDirectDed = 0     // direct money deduction from deduction_pct tiers

      if (latePenaltyEnabled && lateTiers.length > 0) {
        for (const rec of empAtt) {
          if (!rec.is_late || !rec.late_by_minutes) continue
          const tier = lateTiers.find(
            t => rec.late_by_minutes >= t.from_min && (t.to_min === null || rec.late_by_minutes <= t.to_min)
          )
          if (!tier) continue
          if (tier.is_half_day) {
            circleCount++
          } else if (tier.deduction_pct) {
            lateDirectDed += Math.round(perDayApprox * tier.deduction_pct / 100)
          }
        }
      }

      // Column letters for formulas
      const Rn = row
      const cPerDay    = colLetter(C.PER_DAY)
      const cTotSalary = colLetter(C.TOT_SALARY)
      const cActSalary = colLetter(C.ACT_SALARY)
      const cTotDays   = colLetter(C.TOTAL_DAYS)
      const cSalDays   = colLetter(C.SALARY_DAYS)
      const cHdCount   = colLetter(C.TOT_HALF_DAY)
      const cActHD     = colLetter(C.ACT_HALF_DAY)
      const cHDLateDed = colLetter(C.HD_LATE_DED)
      const cLateDed   = colLetter(C.LATE_DED)
      const cNetSal    = colLetter(C.NET_SALARY)
      const cDeds      = colLetter(C.DEDUCTIONS)
      const cSalAdv    = colLetter(C.SAL_ADVANCE)
      const cPrevSal   = colLetter(C.PREV_SAL)

      setNum(C.SR, row, idx + 1)
      setStr(C.CODE, row, emp.emp_code ?? '')
      setStr(C.NAME, row, `${emp.first_name} ${emp.last_name}`)
      setStr(C.DESIG, row, emp.designation?.name ?? '')

      dailyVals.forEach((v, di) => setStr(C.DAILY_START + di, row, v))

      setNum(C.TOT_PRESENT,    row, presentCount)
      setNum(C.TOT_ABSENT,     row, absentCount)
      setNum(C.TOT_HALF_DAY,   row, halfDayCount)
      setNum(C.TOT_PAID_LEAVE, row, paidLeaveCount)
      setNum(C.TOT_WFH,        row, wfhCount)
      setNum(C.TOT_HD,         row, halfDayCount)
      setNum(C.SALARY_DAYS,    row, salaryDays)
      setNum(C.TOTAL_DAYS,     row, totalDays)
      setNum(C.CIRCLE_COUNT,   row, circleCount)
      setNum(C.LATE_MARK,      row, lateCount)
      setNum(C.ACT_SALARY,     row, actualSalary)

      // Per Day = Actual Salary / Total Days
      setFormula(C.PER_DAY, row, `${cActSalary}${Rn}/${cTotDays}${Rn}`)
      // Total Salary = Per Day × Salary Days
      setFormula(C.TOT_SALARY, row, `${cPerDay}${Rn}*${cSalDays}${Rn}`)
      // Actual Half Day deduction = Per Day × Half Day Count × 0.5
      setFormula(C.ACT_HALF_DAY, row, `${cPerDay}${Rn}*${cHdCount}${Rn}*0.5`)
      // Half day for late mark = circle_count × 0.5 × per_day
      setFormula(C.HD_LATE_DED, row, `${colLetter(C.CIRCLE_COUNT)}${Rn}*0.5*${cPerDay}${Rn}`)
      // Late Mark = direct % deduction from policy (deduction_pct tiers)
      setNum(C.LATE_DED, row, lateDirectDed)
      // Net Salary = Total Salary - Actual Half Day - Half Day for Late Mark - Late Mark
      setFormula(C.NET_SALARY, row, `${cTotSalary}${Rn}-${cActHD}${Rn}-${cHDLateDed}${Rn}-${cLateDed}${Rn}`)

      // Manual columns (HR fills these in)
      setNum(C.DEDUCTIONS,  row, 0)
      setNum(C.SAL_ADVANCE, row, 0)
      setNum(C.PREV_SAL,    row, 0)

      // To be Credited = Net Salary - Deductions - Salary Advance + Previous Salary
      setFormula(C.TO_CREDIT, row, `${cNetSal}${Rn}-${cDeds}${Rn}-${cSalAdv}${Rn}+${cPrevSal}${Rn}`)
      // Total Deduction = Deductions + Salary Advance
      setFormula(C.TOT_DEDUCTION, row, `${cDeds}${Rn}+${cSalAdv}${Rn}`)

      // Adjustment (manual) or from payslip adjustment note
      setStr(C.ADJUSTMENT, row, ps.adjustment_note ?? '')

      // Banking
      setStr(C.BENE_NAME,      row, bank?.account_holder_name ?? `${emp.first_name} ${emp.last_name}`)
      // Account number stored as text to preserve leading zeros
      ws[`${colLetter(C.ACCOUNT_NO)}${row}`] = { t: 's', v: bank?.account_number ?? '', z: '@' }
      setStr(C.IFSC,           row, bank?.ifsc_code ?? '')
      setStr(C.FINAL_REMARK,   row, ps.is_manually_adjusted ? 'Adjusted' : '')
      setStr(C.REMARK_DETAILS, row, ps.adjustment_note ?? '')
    })

    // Sheet dimensions
    const lastRow = payslips.length + 1
    ws['!ref'] = `A1:${colLetter(TOTAL_COLS - 1)}${lastRow}`

    // Column widths
    ws['!cols'] = [
      { wch: 6 },   // Sr. No
      { wch: 8 },   // Code
      { wch: 24 },  // Name
      { wch: 18 },  // Designation
      ...dailyHeaders.map(() => ({ wch: 6 })), // daily columns
      { wch: 11 },  // Total Present
      { wch: 11 },  // Total Absent
      { wch: 13 },  // Total Half Day
      { wch: 14 },  // Total Paid Leave
      { wch: 10 },  // Total WFH
      { wch: 10 },  // Total HD
      { wch: 12 },  // Salary Days
      { wch: 11 },  // Total Days
      { wch: 12 },  // Circle Count
      { wch: 13 },  // Total Late Mark
      { wch: 14 },  // Actual Salary
      { wch: 12 },  // Per Day
      { wch: 14 },  // Total Salary
      { wch: 14 },  // Actual Half Day
      { wch: 21 },  // Half Day for Late Mark
      { wch: 12 },  // Late Mark
      { wch: 14 },  // Net Salary
      { wch: 16 },  // Deductions if any
      { wch: 14 },  // Salary Advance
      { wch: 18 },  // Previous Salary add
      { wch: 16 },  // To be Credited
      { wch: 15 },  // Total Deduction
      { wch: 14 },  // Adjustment
      { wch: 22 },  // Beneficiary Name
      { wch: 18 },  // Account No.
      { wch: 14 },  // IFSC Code
      { wch: 14 },  // Final Remark
      { wch: 20 },  // Remark Details
    ]

    // Freeze first row + first 4 columns (Sr, Code, Name, Designation)
    ws['!freeze'] = { xSplit: 4, ySplit: 1 }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName)

    const monthName = new Date(run.year, run.month - 1, 1).toLocaleString('en-IN', { month: 'long' })
    const filename = `Payroll_${monthName}_${run.year}.xlsx`
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
