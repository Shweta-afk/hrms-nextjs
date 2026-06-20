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

    // ── Excel with full color formatting using ExcelJS ───────────────────────
    const ExcelJS = await import('exceljs')
    const wb2 = new ExcelJS.Workbook()
    wb2.creator = 'HRMS'
    const ws2 = wb2.addWorksheet('Detail Attendance', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    })

    // ── Color palette ────────────────────────────────────────────────────────
    const C = {
      empHeader:  { bg: '1E3A5F', fg: 'FFFFFF' },   // deep navy
      dateHeader: { bg: '2C5282', fg: 'FFFFFF' },   // medium blue
      summary:    { bg: 'EBF4FF', fg: '1A365D' },   // light blue tint
      rowLabel:   { bg: 'F7FAFC', fg: '2D3748' },   // near-white
      present:    { bg: 'C6F6D5', fg: '22543D' },   // green
      absent:     { bg: 'FED7D7', fg: '742A2A' },   // red
      halfDay:    { bg: 'BEE3F8', fg: '2A4365' },   // blue
      late:       { bg: 'FEFCBF', fg: '744210' },   // amber
      holiday:    { bg: 'FEEBC8', fg: '7B341E' },   // orange
      weekend:    { bg: 'EDF2F7', fg: '718096' },   // grey
      leave:      { bg: 'FAF5FF', fg: '553C9A' },   // purple
      lateVal:    { bg: 'FFFBEB', fg: 'B45309' },   // amber tint for Late By values
      earlyVal:   { bg: 'EFF6FF', fg: '1D4ED8' },   // blue tint for Early By values
      totalsCol:  { bg: 'EBF4FF', fg: '1A365D' },   // totals column
      separator:  { bg: 'FFFFFF', fg: 'FFFFFF' },
    }

    type FillColor = { bg: string; fg: string }

    function cell(r: number, c: number) { return ws2.getCell(r, c) }

    function styleFill(r: number, c: number, color: FillColor, opts?: {
      bold?: boolean; italic?: boolean; size?: number; align?: 'left'|'center'|'right'; wrap?: boolean; border?: boolean
    }) {
      const cl = cell(r, c)
      cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color.bg } }
      cl.font = { color: { argb: 'FF' + color.fg }, bold: opts?.bold, italic: opts?.italic, size: opts?.size ?? 9, name: 'Calibri' }
      cl.alignment = { horizontal: opts?.align ?? 'center', vertical: 'middle', wrapText: opts?.wrap }
      if (opts?.border) {
        const bStyle = { style: 'thin' as const, color: { argb: 'FFD0D5DB' } }
        cl.border = { top: bStyle, left: bStyle, bottom: bStyle, right: bStyle }
      }
    }

    function statusFill(st: string): FillColor {
      if (st === 'P')            return C.present
      if (st === 'A')            return C.absent
      if (st === 'HD')           return C.halfDay
      if (st === 'L')            return C.leave
      if (st === 'H')            return C.holiday
      if (st === 'W' || st === 'WO') return C.weekend
      return C.rowLabel
    }

    // ── Title row ────────────────────────────────────────────────────────────
    const totalCols = 2 + days.length + 1   // label + days + Total
    ws2.addRow([])
    const titleRow = ws2.addRow([`Attendance Detail Report   ${format(fromDate, 'dd MMM yyyy')}  to  ${format(toDate, 'dd MMM yyyy')}`])
    ws2.mergeCells(titleRow.number, 1, titleRow.number, totalCols)
    const titleCell = cell(titleRow.number, 1)
    titleCell.value = `Attendance Detail Report   ${format(fromDate, 'dd MMM yyyy')}  to  ${format(toDate, 'dd MMM yyyy')}`
    titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    titleCell.font  = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleRow.height = 22
    ws2.addRow([])

    // ── Per-employee blocks ───────────────────────────────────────────────────
    for (const emp of employees) {
      const empRecs = recIndex.get(emp.id) ?? new Map()

      const dataRows: { shift: string; in_time: string; out_time: string; late_by: string; early_by: string; total_ot: string; t_duration: string; status: string; lateMins: number; earlyMins: number }[] = []
      let totalPresent = 0, totalAbsent = 0, totalLeave = 0, totalWO = 0, totalHO = 0
      let totalLateMins = 0, totalEarlyMins = 0, totalDurMins = 0, totalOTMins = 0

      for (const day of days) {
        const ds  = format(day, 'yyyy-MM-dd')
        const rec = empRecs.get(ds)
        const st  = dayStatus(rec, ds)
        const isH = st === 'H', isW = st === 'W'

        if (st === 'P' || st === 'HD' || st === 'WFH') totalPresent++
        else if (st === 'L') totalLeave++
        else if (st === 'A') totalAbsent++
        else if (st === 'W') totalWO++
        else if (st === 'H') totalHO++

        const lateMins  = rec?.late_by_minutes ?? 0
        const earlyMins = rec ? earlyByMinutes(rec.last_out) : 0
        const durMins   = rec?.total_hours ? Math.round(Number(rec.total_hours) * 60) : 0
        const otMins    = rec?.overtime_hours ? Math.round(Number(rec.overtime_hours) * 60) : 0
        totalLateMins += lateMins; totalEarlyMins += earlyMins
        totalDurMins  += durMins;  totalOTMins    += otMins

        dataRows.push({
          shift:      isH ? 'H' : isW ? 'WO' : 'FS',
          in_time:    rec?.first_in ? fmtHHMMSS(rec.first_in) : '00:00:00',
          out_time:   rec?.last_out ? fmtHHMMSS(rec.last_out) : '00:00:00',
          late_by:    lateMins  ? fmtMinutes(lateMins)  : '00:00',
          early_by:   earlyMins ? fmtMinutes(earlyMins) : '00:00',
          total_ot:   otMins    ? fmtMinutes(otMins)    : '00:00',
          t_duration: durMins   ? fmtMinutes(durMins)   : '00:00',
          status: st, lateMins, earlyMins,
        })
      }

      const startRow = ws2.rowCount + 1

      // ── Row 1: Employee header ──────────────────────────────────────────
      const empRow = ws2.addRow([])
      empRow.height = 20
      const er = empRow.number
      ws2.mergeCells(er, 1, er, 2)
      cell(er, 1).value = `Employee Code:  ${emp.emp_code}`
      styleFill(er, 1, C.empHeader, { bold: true, size: 10, align: 'left' })
      const midCol = Math.floor(totalCols / 2)
      for (let c = 3; c <= midCol; c++) styleFill(er, c, C.empHeader)
      ws2.mergeCells(er, midCol + 1, er, totalCols)
      cell(er, midCol + 1).value = `${emp.first_name} ${emp.last_name}  (${emp.department?.name ?? ''})`
      styleFill(er, midCol + 1, C.empHeader, { bold: true, size: 10, align: 'right' })

      // ── Row 2: Date headers ─────────────────────────────────────────────
      const dhRow = ws2.addRow([])
      dhRow.height = 18
      const dr = dhRow.number
      cell(dr, 1).value = ''
      styleFill(dr, 1, C.dateHeader, { bold: true })
      cell(dr, 2).value = ''
      styleFill(dr, 2, C.dateHeader)
      days.forEach((day, i) => {
        const col = 3 + i
        cell(dr, col).value = `${format(day, 'd')}-${format(day, 'EEE')}`
        const isWknd = isWeekend(day)
        const isHol  = holidaySet.has(format(day, 'yyyy-MM-dd'))
        styleFill(dr, col, isHol ? C.holiday : isWknd ? C.weekend : C.dateHeader, { bold: true, size: 8 })
      })
      cell(dr, totalCols).value = 'Total'
      styleFill(dr, totalCols, C.totalsCol, { bold: true })

      // ── Row 3: Summary ──────────────────────────────────────────────────
      const sumRow = ws2.addRow([])
      sumRow.height = 16
      const sr = sumRow.number
      ws2.mergeCells(sr, 1, sr, totalCols)
      cell(sr, 1).value =
        `Present: ${totalPresent}   Absent: ${totalAbsent}   Leave: ${totalLeave}   WO: ${totalWO}   HO: ${totalHO}   ` +
        `Duration: ${fmtMinutes(totalDurMins)}   Late By: ${fmtMinutes(totalLateMins)} hrs   ` +
        `Early By: ${fmtMinutes(totalEarlyMins)} hrs   OT: ${fmtMinutes(totalOTMins)}`
      styleFill(sr, 1, C.summary, { bold: false, size: 8, align: 'left' })

      // ── Rows 4-11: Data rows ────────────────────────────────────────────
      const ROW_DEFS = [
        { label: 'Shift',      key: 'shift'      as const, total: ''                         },
        { label: 'In Time',    key: 'in_time'    as const, total: ''                         },
        { label: 'Out Time',   key: 'out_time'   as const, total: ''                         },
        { label: 'Late By',    key: 'late_by'    as const, total: fmtMinutes(totalLateMins)  },
        { label: 'Early By',   key: 'early_by'   as const, total: fmtMinutes(totalEarlyMins) },
        { label: 'Total OT',   key: 'total_ot'   as const, total: fmtMinutes(totalOTMins)    },
        { label: 'T Duration', key: 't_duration' as const, total: fmtMinutes(totalDurMins)   },
        { label: 'Status',     key: 'status'     as const, total: `${totalPresent}P/${totalAbsent}A` },
      ]

      for (const def of ROW_DEFS) {
        const dataRow = ws2.addRow([])
        dataRow.height = def.key === 'in_time' || def.key === 'out_time' ? 16 : 15
        const rn = dataRow.number

        // Label cell
        cell(rn, 1).value = def.label
        styleFill(rn, 1, C.rowLabel, { bold: true, size: 9, align: 'left', border: true })
        // Spacer
        styleFill(rn, 2, C.rowLabel, { border: true })

        // Day cells
        dataRows.forEach((d, i) => {
          const col = 3 + i
          const val = d[def.key]
          let fillColor: FillColor = C.rowLabel

          if (def.key === 'status') {
            fillColor = statusFill(val)
          } else if (def.key === 'late_by' && d.lateMins > 0) {
            fillColor = C.lateVal
          } else if (def.key === 'early_by' && d.earlyMins > 0) {
            fillColor = C.earlyVal
          } else if (d.status === 'A') {
            fillColor = { bg: 'F9FAFB', fg: 'CBD5E0' }
          } else if (d.status === 'W' || d.status === 'H') {
            fillColor = C.weekend
          }

          const isEmpty = val === '00:00' || val === '00:00:00'
          cell(rn, col).value = isEmpty && def.key !== 'status' ? '' : val
          styleFill(rn, col, fillColor, {
            bold: def.key === 'status',
            size: def.key === 'in_time' || def.key === 'out_time' ? 8 : 9,
            border: true,
          })
        })

        // Total cell
        cell(rn, totalCols).value = def.total
        styleFill(rn, totalCols, C.totalsCol, { bold: true, border: true })
      }

      // ── Separator row ───────────────────────────────────────────────────
      const sepRow = ws2.addRow([])
      sepRow.height = 8
      void startRow // suppress unused-var warning

      ws2.addRow([])
    }

    // ── Column widths ─────────────────────────────────────────────────────────
    ws2.getColumn(1).width = 12  // row label
    ws2.getColumn(2).width = 2   // spacer
    for (let i = 0; i < days.length; i++) ws2.getColumn(3 + i).width = 9
    ws2.getColumn(totalCols).width = 10

    const buffer2 = await wb2.xlsx.writeBuffer()
    const filename = `attendance_detail_${fromStr}_to_${toStr}.xlsx`

    return new NextResponse(Buffer.from(buffer2), {
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
