import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// ─── Helper: count working days in a range ──────────────────────────────────
function getWorkingDays(
  from: Date, to: Date,
  weeklyOffs: number[],
  holidayDates: Set<string>,
  workingDayOverrides: Set<string>,
): number {
  let count = 0
  const cur = new Date(from)
  while (cur <= to) {
    const ds = cur.toISOString().slice(0, 10)
    const isWeekend  = weeklyOffs.includes(cur.getUTCDay())
    const isHoliday  = holidayDates.has(ds)
    const isOverride = workingDayOverrides.has(ds)
    if (!isWeekend && !isHoliday || isOverride) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { id } = await params

    const run = await prisma.payrollRun.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!run) return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 })

    // Period boundaries
    const periodStart: Date = run.period_from ?? new Date(Date.UTC(run.year, run.month - 1, 1))
    const periodEnd:   Date = run.period_to   ?? new Date(Date.UTC(run.year, run.month, 0, 23, 59, 59))

    // Org settings
    const org = await prisma.organisation.findUnique({
      where: { id: session.user.org_id },
      select: { settings: true, name: true },
    })
    const settings = (org?.settings ?? {}) as Record<string, unknown>
    const workWeekDays = (settings.work_week_days as number) ?? 5
    const weeklyOffs: number[] = Array.isArray(settings.weekly_offs)
      ? (settings.weekly_offs as number[])
      : workWeekDays >= 6 ? [0] : [0, 6]

    // Holidays
    const holidays = await prisma.holiday.findMany({
      where: { org_id: session.user.org_id, date: { gte: periodStart, lte: periodEnd } },
      select: { date: true, type: true, name: true },
    })
    const holidayDates = new Set<string>()
    const workingDayOverrides = new Set<string>()
    const holidayNames = new Map<string, string>()
    for (const h of holidays) {
      const ds = new Date(h.date).toISOString().slice(0, 10)
      if (h.type === 'working_day') workingDayOverrides.add(ds)
      else { holidayDates.add(ds); holidayNames.set(ds, h.name) }
    }

    // Payslips with employee data
    const payslips = await prisma.payslip.findMany({
      where: { payroll_run_id: id, org_id: session.user.org_id },
      include: {
        employee: {
          select: {
            id: true, emp_code: true, first_name: true, last_name: true,
            ctc_annual: true, date_of_joining: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
            shift_group: { select: { weekly_offs: true } },
          },
        },
      },
      orderBy: [{ employee: { emp_code: 'asc' } }],
    })

    // Load ALL attendance in ONE query (avoid N+1)
    const employeeIds = payslips.map(p => p.employee.id)
    const allAttendance = await prisma.attendanceRecord.findMany({
      where: {
        org_id: session.user.org_id,
        employee_id: { in: employeeIds },
        date: { gte: periodStart, lte: periodEnd },
      },
      select: { employee_id: true, date: true, status: true, first_in: true,
                last_out: true, is_late: true, late_by_minutes: true, overtime_hours: true },
    })
    const attByEmp = new Map<string, typeof allAttendance>()
    for (const a of allAttendance) {
      const list = attByEmp.get(a.employee_id) ?? []
      list.push(a)
      attByEmp.set(a.employee_id, list)
    }

    // Collect all dates in the period
    const allDates: Date[] = []
    const cur = new Date(periodStart)
    while (cur <= periodEnd) {
      allDates.push(new Date(cur))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    const dateStrings = allDates.map(d => d.toISOString().slice(0, 10))

    // ── Sheet 1: Day-by-day attendance ──────────────────────────────────────
    const dayRows: Record<string, string | number>[] = []

    for (const ps of payslips) {
      const emp = ps.employee
      const empWeeklyOffs = (emp.shift_group?.weekly_offs as number[] | null) ?? weeklyOffs

      // Use pre-loaded attendance map (no extra DB call per employee)
      const empAttendance = attByEmp.get(emp.id) ?? []
      const attMap = new Map(
        empAttendance.map(a => [new Date(a.date).toISOString().slice(0, 10), a])
      )

      const empWorkingDays = getWorkingDays(periodStart, periodEnd, empWeeklyOffs, holidayDates, workingDayOverrides)
      let presentDays = 0, absentDays = 0, lateDays = 0, halfDays = 0
      let holidayCount = 0, weeklyOffCount = 0, leaveDays = 0

      const row: Record<string, string | number> = {
        'Emp Code':   emp.emp_code,
        'Employee':   `${emp.first_name} ${emp.last_name}`,
        'Department': emp.department?.name ?? '',
        'Designation':emp.designation?.name ?? '',
        'CTC (Annual)': emp.ctc_annual ? Number(emp.ctc_annual) : '',
        'Working Days (Period)': empWorkingDays,
      }

      for (const ds of dateStrings) {
        const date = new Date(ds + 'T00:00:00Z')
        const isWeekOff  = empWeeklyOffs.includes(date.getUTCDay())
        const isHoliday  = holidayDates.has(ds)
        const isWorkDay  = workingDayOverrides.has(ds)
        const rec = attMap.get(ds)

        let cell: string
        if (rec) {
          switch (rec.status) {
            case 'present':     cell = 'P';    presentDays++;  break
            case 'late':        cell = `L(${rec.late_by_minutes ?? 0}m)`; lateDays++; presentDays++; break
            case 'half_day':    cell = 'HD';   halfDays++;     break
            case 'holiday':     cell = 'HOL';  holidayCount++; break
            case 'weekly_off':  cell = 'OFF';  weeklyOffCount++;break
            case 'absent':      cell = 'A';    absentDays++;   break
            case 'leave':       cell = 'LV';   leaveDays++;    break
            default:            cell = rec.status.toUpperCase()
          }
        } else if (isHoliday && !isWorkDay) {
          cell = `HOL(${holidayNames.get(ds) ?? ''})`
          holidayCount++
        } else if (isWeekOff && !isWorkDay) {
          cell = 'OFF'
          weeklyOffCount++
        } else {
          cell = 'A'
          absentDays++
        }

        // Format the date as DD-MMM for column header
        const label = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
        row[label] = cell
      }

      const effectivePresent = presentDays + halfDays * 0.5
      const lopDays = Math.max(0, empWorkingDays - effectivePresent)
      const ctcMonthly = emp.ctc_annual ? Number(emp.ctc_annual) / 12 : 0
      const lopDeduction = ctcMonthly > 0 && empWorkingDays > 0
        ? Math.round((lopDays / empWorkingDays) * ctcMonthly)
        : 0

      row['Present'] = presentDays
      row['Late']    = lateDays
      row['Half Day']= halfDays
      row['Absent/LOP'] = absentDays
      row['Leave']   = leaveDays
      row['Holiday'] = holidayCount
      row['Weekly Off'] = weeklyOffCount
      row['Eff. Present'] = effectivePresent
      row['LOP Days'] = lopDays
      row['Est. LOP Deduction (₹)'] = lopDeduction
      row['Net Salary (₹)'] = Number(ps.net_salary)

      dayRows.push(row)
    }

    // ── Sheet 2: Summary ───────────────────────────────────────────────────
    const summaryRows = payslips.map(ps => ({
      'Emp Code':    ps.employee.emp_code,
      'Employee':    `${ps.employee.first_name} ${ps.employee.last_name}`,
      'Department':  ps.employee.department?.name ?? '',
      'Working Days':Number(ps.working_days),
      'Present Days':Number(ps.present_days),
      'LOP Days':    Math.max(0, Number(ps.working_days) - Number(ps.present_days)),
      'Gross (₹)':   Number(ps.gross_salary),
      'Deductions (₹)': Number(ps.total_deductions),
      'Net Salary (₹)': Number(ps.net_salary),
      'Status':      ps.hr_approved_at ? 'HR Approved' : (ps.is_published ? 'Published' : 'Draft'),
    }))

    // Build workbook
    const wb = XLSX.utils.book_new()

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    wsSummary['!cols'] = [
      {wch:10},{wch:22},{wch:16},{wch:13},{wch:13},{wch:10},{wch:14},{wch:16},{wch:14},{wch:14},
    ]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Payroll Summary')

    const wsDetail = XLSX.utils.json_to_sheet(dayRows)
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Day-by-Day Detail')

    // Holiday legend sheet
    const legendRows = holidays.map(h => ({
      'Date': new Date(h.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', timeZone:'UTC' }),
      'Name': h.name,
      'Type': h.type === 'working_day' ? 'Working Day Override' : 'Holiday',
    }))
    if (legendRows.length > 0) {
      const wsLegend = XLSX.utils.json_to_sheet(legendRows)
      XLSX.utils.book_append_sheet(wb, wsLegend, 'Holidays')
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const filename = `payroll_attendance_${monthNames[run.month - 1]}_${run.year}.xlsx`

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('payroll_attendance_report_failed', error)
    return NextResponse.json({ success: false, error: 'Report generation failed' }, { status: 500 })
  }
}
