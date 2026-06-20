import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/punch-processor'
import { eachDayOfInterval, format, isWeekend, parseISO } from 'date-fns'

/**
 * GET /api/reports/attendance/detail?from=2026-05-21&to=2026-06-20&format=excel
 *
 * Generates the per-employee horizontal calendar report matching the Smart Office
 * "Detail" format:
 *  - One block per employee
 *  - Dates as columns
 *  - Rows: Shift | In Time | Out Time | Late By | Early By | Total OT | T Duration | Status
 *  - Summary line: Total Present, Absent, Leave, WO, Duration, Late By (hrs), Early By (hrs), OT
 */
export async function GET(req: NextRequest) {
  try {
    const XLSX = await import('xlsx')
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { searchParams } = new URL(req.url)
    const fromStr = searchParams.get('from')
    const toStr   = searchParams.get('to')
    const fmt     = searchParams.get('format') ?? 'excel'

    if (!fromStr || !toStr) {
      return NextResponse.json(
        { success: false, error: '"from" and "to" query parameters are required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const fromDate = parseISO(fromStr)
    const toDate   = parseISO(toStr)
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
      return NextResponse.json({ success: false, error: 'Invalid date range' }, { status: 400 })
    }

    const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1
    if (spanDays > 62) {
      return NextResponse.json(
        { success: false, error: 'Date range too large — max 62 days' },
        { status: 400 }
      )
    }

    const org_id = session.user.org_id

    // UTC-aligned boundaries
    const rangeStart = new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()))
    const rangeEnd   = new Date(Date.UTC(toDate.getFullYear(),   toDate.getMonth(),   toDate.getDate() + 1))

    const [employees, records, holidays, shiftSettings] = await Promise.all([
      prisma.employee.findMany({
        where: { org_id, status: 'active' },
        include: {
          department:  { select: { name: true } },
          designation: { select: { name: true } },
        },
        orderBy: [{ emp_code: 'asc' }],
      }),
      prisma.attendanceRecord.findMany({
        where: { org_id, date: { gte: rangeStart, lt: rangeEnd } },
      }),
      prisma.holiday.findMany({
        where: { org_id, date: { gte: rangeStart, lt: rangeEnd } },
        select: { date: true },
      }),
      getShiftSettings(org_id),
    ])

    const holidaySet = new Set(holidays.map((h) => format(h.date, 'yyyy-MM-dd')))

    // Index records: employee_id → (dateStr → record)
    const recIndex = new Map<string, Map<string, typeof records[0]>>()
    for (const rec of records) {
      const empMap = recIndex.get(rec.employee_id) ?? new Map()
      empMap.set(format(rec.date, 'yyyy-MM-dd'), rec)
      recIndex.set(rec.employee_id, empMap)
    }

    // All days in range
    const days = eachDayOfInterval({ start: fromDate, end: toDate })

    // ── Helpers ──────────────────────────────────────────────────────────────

    const IST = 5.5 * 3600_000

    function toIST(dt: Date) { return new Date(dt.getTime() + IST) }

    function fmtHHMM(dt: Date | null | undefined): string {
      if (!dt) return '00:00'
      const ist = toIST(dt)
      return `${String(ist.getUTCHours()).padStart(2,'0')}:${String(ist.getUTCMinutes()).padStart(2,'0')}`
    }

    function fmtHHMMSS(dt: Date | null | undefined): string {
      if (!dt) return '00:00:00'
      const ist = toIST(dt)
      return `${String(ist.getUTCHours()).padStart(2,'0')}:${String(ist.getUTCMinutes()).padStart(2,'0')}:${String(ist.getUTCSeconds()).padStart(2,'0')}`
    }

    /** Format a duration in total minutes as HH:MM */
    function fmtMinutes(totalMin: number): string {
      const h = Math.floor(Math.abs(totalMin) / 60)
      const m = Math.abs(totalMin) % 60
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    }

    /** Compute early-by minutes: how many minutes before shift end the employee left */
    function earlyByMinutes(lastOut: Date | null): number {
      if (!lastOut) return 0
      const ist = toIST(lastOut)
      const outMins = ist.getUTCHours() * 60 + ist.getUTCMinutes()
      const shiftEndMins = shiftSettings.shiftEndHour * 60 + shiftSettings.shiftEndMin
      return Math.max(0, shiftEndMins - outMins)
    }

    function dayStatus(rec: typeof records[0] | undefined, dateStr: string): string {
      if (!rec) {
        if (holidaySet.has(dateStr)) return 'H'
        const d = parseISO(dateStr)
        if (isWeekend(d)) return 'W'
        return 'A'
      }
      const s = rec.status
      if (s === 'present' || s === 'late') return 'P'
      if (s === 'half_day') return 'HD'
      if (s === 'wfh') return 'WFH'
      if (s === 'leave') return 'L'
      if (s === 'holiday') return 'H'
      if (s === 'weekly_off' || s === 'weekend') return 'W'
      if (s === 'absent') return 'A'
      return 'A'
    }

    // ── Build workbook ────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new()

    if (fmt === 'json') {
      // Return full per-day data for each employee so the UI can render
      // the exact Smart Office block format (one table per employee).
      const dateHeaders = days.map(d => `${format(d, 'd')}-${format(d, 'EEE')}`)

      const empBlocks = employees.map((emp) => {
        const empRecs = recIndex.get(emp.id) ?? new Map()
        let totalPresent = 0, totalAbsent = 0, totalLeave = 0, totalWO = 0, totalHO = 0
        let totalLateMins = 0, totalEarlyMins = 0, totalDurMins = 0, totalOTMins = 0

        const dayRows = days.map((day) => {
          const ds  = format(day, 'yyyy-MM-dd')
          const rec = empRecs.get(ds)
          const st  = dayStatus(rec, ds)

          if (st === 'P' || st === 'HD' || st === 'WFH') totalPresent++
          else if (st === 'L') totalLeave++
          else if (st === 'A') totalAbsent++
          else if (st === 'W') totalWO++
          else if (st === 'H') totalHO++

          const lateMins  = rec?.late_by_minutes ?? 0
          const earlyMins = rec ? earlyByMinutes(rec.last_out) : 0
          const durMins   = rec?.total_hours ? Math.round(Number(rec.total_hours) * 60) : 0
          const otMins    = rec?.overtime_hours ? Math.round(Number(rec.overtime_hours) * 60) : 0

          totalLateMins  += lateMins
          totalEarlyMins += earlyMins
          totalDurMins   += durMins
          totalOTMins    += otMins

          const isHoliday = st === 'H'
          const isWeekOff = st === 'W'

          return {
            shift:     isHoliday ? 'H' : isWeekOff ? 'WO' : 'FS',
            in_time:   rec?.first_in  ? fmtHHMMSS(rec.first_in)  : '00:00:00',
            out_time:  rec?.last_out  ? fmtHHMMSS(rec.last_out)  : '00:00:00',
            late_by:   lateMins   ? fmtMinutes(lateMins)   : '00:00',
            early_by:  earlyMins  ? fmtMinutes(earlyMins)  : '00:00',
            total_ot:  otMins     ? fmtMinutes(otMins)     : '00:00',
            t_duration:durMins    ? fmtMinutes(durMins)    : '00:00',
            status:    st,
          }
        })

        return {
          emp_code:   emp.emp_code,
          name:       `${emp.first_name} ${emp.last_name}`,
          department: emp.department?.name ?? '',
          summary: {
            total_present:  totalPresent,
            total_absent:   totalAbsent,
            total_leave:    totalLeave,
            total_wo:       totalWO,
            total_ho:       totalHO,
            total_duration: fmtMinutes(totalDurMins),
            total_late_by:  fmtMinutes(totalLateMins),
            total_early_by: fmtMinutes(totalEarlyMins),
            total_ot:       fmtMinutes(totalOTMins),
          },
          days: dayRows,
        }
      })

      return NextResponse.json({ success: true, data: { date_headers: dateHeaders, employees: empBlocks } })
    }

    // ── Excel: one sheet ──────────────────────────────────────────────────────
    const aoaRows: (string | number)[][] = []

    // Title
    aoaRows.push([`Attendance Detail Report — ${format(fromDate, 'dd MMM yyyy')} to ${format(toDate, 'dd MMM yyyy')}`])
    aoaRows.push([])

    // Date header row (shared across all employee blocks)
    const dateHeaderRow: string[] = ['', '']
    for (const day of days) {
      dateHeaderRow.push(`${format(day, 'd')}-${format(day, 'EEE')}`)
    }
    dateHeaderRow.push('Total')

    for (const emp of employees) {
      const empRecs = recIndex.get(emp.id) ?? new Map()

      // Per-day computed values
      const shiftRow: string[]    = ['Shift', '']
      const inRow: string[]       = ['In Time', '']
      const outRow: string[]      = ['Out Time', '']
      const lateRow: string[]     = ['Late By', '']
      const earlyRow: string[]    = ['Early By', '']
      const otRow: string[]       = ['Total OT', '']
      const durRow: string[]      = ['T Duration', '']
      const statusRow: string[]   = ['Status', '']

      let totalPresent = 0, totalAbsent = 0, totalLeave = 0, totalWO = 0, totalHO = 0
      let totalLateMins = 0, totalEarlyMins = 0, totalDurMins = 0, totalOTMins = 0

      for (const day of days) {
        const ds  = format(day, 'yyyy-MM-dd')
        const rec = empRecs.get(ds)
        const st  = dayStatus(rec, ds)

        const isHoliday = st === 'H'
        const isWeekOff = st === 'W'

        if (st === 'P' || st === 'HD' || st === 'WFH') totalPresent++
        else if (st === 'L') totalLeave++
        else if (st === 'A') totalAbsent++
        else if (st === 'W') totalWO++
        else if (st === 'H') totalHO++

        const shiftLabel = isHoliday ? 'H' : isWeekOff ? 'WO' : 'FS'
        shiftRow.push(shiftLabel)

        if (rec?.first_in) {
          inRow.push(fmtHHMMSS(rec.first_in))
        } else {
          inRow.push('00:00:00')
        }

        if (rec?.last_out) {
          outRow.push(fmtHHMMSS(rec.last_out))
        } else {
          outRow.push('00:00:00')
        }

        const lateMins  = rec?.late_by_minutes ?? 0
        const earlyMins = rec ? earlyByMinutes(rec.last_out) : 0
        const durMins   = rec?.total_hours ? Math.round(Number(rec.total_hours) * 60) : 0
        const otMins    = rec?.overtime_hours ? Math.round(Number(rec.overtime_hours) * 60) : 0

        lateRow.push(lateMins   ? fmtMinutes(lateMins)  : '00:00')
        earlyRow.push(earlyMins ? fmtMinutes(earlyMins) : '00:00')
        otRow.push(otMins       ? fmtMinutes(otMins)    : '00:00')
        durRow.push(durMins     ? fmtMinutes(durMins)   : '00:00')
        statusRow.push(st)

        totalLateMins  += lateMins
        totalEarlyMins += earlyMins
        totalDurMins   += durMins
        totalOTMins    += otMins
      }

      // Totals column
      shiftRow.push('')
      inRow.push('')
      outRow.push('')
      lateRow.push(fmtMinutes(totalLateMins))
      earlyRow.push(fmtMinutes(totalEarlyMins))
      otRow.push(fmtMinutes(totalOTMins))
      durRow.push(fmtMinutes(totalDurMins))
      statusRow.push('')

      // ── Employee block ────────────────────────────────────────────────────
      // Header: code | name
      aoaRows.push([
        `EmployeeCode  ${emp.emp_code}`,
        '',
        ...Array(days.length).fill(''),
        `EmployeeName  ${emp.first_name} ${emp.last_name}`,
      ])

      // Date header
      aoaRows.push(dateHeaderRow)

      // Summary line
      aoaRows.push([
        `Total Present - ${totalPresent}  Total Absent - ${totalAbsent}  Total Leave Taken - ${totalLeave}  Total Weekly Off Present - ${totalWO}  Total Duration - ${fmtMinutes(totalDurMins)}  Total T.Duration - ${fmtMinutes(totalDurMins)}  Total Over Time - ${fmtMinutes(totalOTMins)}  Total WO Count ${totalWO}  Total HO Count ${totalHO}  Total LateBy - ${fmtMinutes(totalLateMins)} (Hrs.)  Total EarlyBy - ${fmtMinutes(totalEarlyMins)} (Hrs.)  Total Regular OT - ${fmtMinutes(totalOTMins)} (Hrs.)`,
      ])

      aoaRows.push(shiftRow)
      aoaRows.push(inRow)
      aoaRows.push(outRow)
      aoaRows.push(lateRow)
      aoaRows.push(earlyRow)
      aoaRows.push(otRow)
      aoaRows.push(durRow)
      aoaRows.push(statusRow)
      aoaRows.push([]) // blank separator
    }

    const ws = XLSX.utils.aoa_to_sheet(aoaRows)

    // Fixed col widths: label col + date cols
    ws['!cols'] = [
      { wch: 14 }, // row label
      { wch: 4  }, // spacer
      ...days.map(() => ({ wch: 11 })),
      { wch: 8 },  // Total
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Detail')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `attendance_detail_${fromStr}_to_${toStr}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/reports/attendance/detail error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate detail report' },
      { status: 500 }
    )
  }
}
