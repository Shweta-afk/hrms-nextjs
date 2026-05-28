import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// XLSX loaded lazily inside handler — keeps cold-start lean
import { format } from 'date-fns'

/**
 * GET /api/reports/attendance/daily?date=2026-05-16&format=excel
 *
 * Generates the daily attendance report in Excel format matching Smart Office output.
 * Returns all active employees for the org, with their attendance record for the day.
 * Employees with no record are shown as Absent.
 */
export async function GET(req: NextRequest) {
  try {
    // Org-wide daily attendance report — admin-only.
    const XLSX = await import('xlsx')
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date')
    const fmt = searchParams.get('format') ?? 'excel'
    if (!dateStr) {
      return NextResponse.json(
        { success: false, error: 'date query parameter is required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const org_id = session.user.org_id
    const parsed = new Date(dateStr)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 })
    }

    const dayStart = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()))

    const [employees, records] = await Promise.all([
      prisma.employee.findMany({
        where: { org_id, status: 'active' },
        include: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
        orderBy: [{ emp_code: 'asc' }],
      }),
      prisma.attendanceRecord.findMany({
        where: { org_id, date: dayStart },
      }),
    ])

    const recordMap = new Map(records.map((r) => [r.employee_id, r]))

    const fmtDate = format(dayStart, 'dd/MM/yyyy')
    const dayName = format(dayStart, 'EEEE')

    // ── Header row ──────────────────────────────────────────────────────────
    const header = [
      'Sl No', 'Employee Code', 'Employee Name', 'Department', 'Designation',
      'Date', 'Day', 'Shift', 'Time In', 'Time Out', 'Work Hours',
      'Late By (min)', 'Overtime Hours', 'Status', 'Remarks',
    ]

    const rows: (string | number)[][] = [header]

    employees.forEach((emp, idx) => {
      const rec = recordMap.get(emp.id)

      let status = 'Absent'
      let timeIn = '—'
      let timeOut = '—'
      let workHours: string | number = '—'
      let lateBy = 0
      let overtime: string | number = '—'
      let remarks = '—'

      if (rec) {
        if (rec.status === 'present' && rec.is_late) status = 'Late'
        else if (rec.status === 'present') status = 'Present'
        else if (rec.status === 'half_day') status = 'Half Day'
        else status = 'Absent'

        if (rec.first_in) timeIn = format(new Date(rec.first_in), 'HH:mm')
        if (rec.last_out) timeOut = format(new Date(rec.last_out), 'HH:mm')
        if (rec.total_hours != null) workHours = Number(rec.total_hours).toFixed(2)
        lateBy = rec.late_by_minutes
        overtime = rec.overtime_hours != null ? Number(rec.overtime_hours).toFixed(2) : '—'

        if (rec.is_corrected) remarks = 'Corrected'
        else if (rec.source === 'manual') remarks = 'Manual'
        else if (rec.source === 'csv_import') remarks = 'CSV Import'
        else if (rec.source === 'device') remarks = 'Device'
        else remarks = 'ESSL'
      }

      rows.push([
        idx + 1,
        emp.emp_code,
        `${emp.first_name} ${emp.last_name}`,
        emp.department?.name ?? '—',
        emp.designation?.name ?? '—',
        fmtDate,
        dayName,
        'General',
        timeIn,
        timeOut,
        workHours,
        lateBy,
        overtime,
        status,
        remarks,
      ])
    })

    // ── JSON preview mode ────────────────────────────────────────────────────
    if (fmt === 'json') {
      const [headerRow, ...dataRows] = rows
      const jsonRows = dataRows.map((row) => {
        const obj: Record<string, string | number> = {}
        ;(headerRow as string[]).forEach((col, i) => { obj[col] = row[i] })
        return obj
      })
      return NextResponse.json({ success: true, data: jsonRows })
    }

    // ── Build workbook ───────────────────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Column widths
    ws['!cols'] = [
      { wch: 6 },  // Sl No
      { wch: 13 }, // Emp Code
      { wch: 22 }, // Name
      { wch: 16 }, // Dept
      { wch: 16 }, // Designation
      { wch: 12 }, // Date
      { wch: 10 }, // Day
      { wch: 10 }, // Shift
      { wch: 10 }, // Time In
      { wch: 10 }, // Time Out
      { wch: 12 }, // Work Hours
      { wch: 14 }, // Late By
      { wch: 16 }, // Overtime
      { wch: 12 }, // Status
      { wch: 14 }, // Remarks
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Attendance')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `attendance_daily_${dateStr}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/reports/attendance/daily error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate daily report' },
      { status: 500 }
    )
  }
}
