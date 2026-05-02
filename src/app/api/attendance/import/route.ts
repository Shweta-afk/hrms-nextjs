import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// ESSL CSV format: emp_code, date, time, direction (I/O)
// Example row: EMP0001,2026-05-01,09:02:00,I

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())

    // Skip header if present
    const dataLines = lines[0].toLowerCase().includes('emp') ? lines.slice(1) : lines

    const employees = await prisma.employee.findMany({
      where: { org_id: session.user.org_id },
      select: { id: true, emp_code: true, essl_device_id: true },
    })

    const empMap = Object.fromEntries([
      ...employees.map(e => [e.emp_code, e.id]),
      ...employees.filter(e => e.essl_device_id).map(e => [e.essl_device_id!, e.id]),
    ])

    let processed = 0
    let skipped = 0
    const errors: string[] = []

    // Group punches by employee + date
    const punchMap: Record<string, { ins: Date[]; outs: Date[] }> = {}

    for (const line of dataLines) {
      const parts = line.split(',').map(p => p.trim())
      if (parts.length < 4) { skipped++; continue }

      const [empCode, dateStr, timeStr, direction] = parts
      const employeeId = empMap[empCode]

      if (!employeeId) {
        errors.push(`Unknown employee code: ${empCode}`)
        skipped++
        continue
      }

      const punchTime = new Date(`${dateStr}T${timeStr}`)
      if (isNaN(punchTime.getTime())) {
        errors.push(`Invalid date/time: ${dateStr} ${timeStr}`)
        skipped++
        continue
      }

      const key = `${employeeId}_${dateStr}`
      if (!punchMap[key]) punchMap[key] = { ins: [], outs: [] }

      if (direction.toUpperCase() === 'I') punchMap[key].ins.push(punchTime)
      else if (direction.toUpperCase() === 'O') punchMap[key].outs.push(punchTime)
    }

    // Process each employee-day
    for (const [key, punches] of Object.entries(punchMap)) {
      const [employeeId, dateStr] = key.split('_')
      const dateObj = new Date(dateStr)

      const firstIn = punches.ins.length > 0
        ? new Date(Math.min(...punches.ins.map(d => d.getTime())))
        : null
      const lastOut = punches.outs.length > 0
        ? new Date(Math.max(...punches.outs.map(d => d.getTime())))
        : null

      let totalHours = null
      if (firstIn && lastOut) {
        totalHours = (lastOut.getTime() - firstIn.getTime()) / (1000 * 60 * 60)
      }

      let isLate = false
      let lateByMinutes = 0
      if (firstIn) {
        const shiftStart = new Date(firstIn)
        shiftStart.setHours(9, 15, 0, 0)
        if (firstIn > shiftStart) {
          isLate = true
          lateByMinutes = Math.floor((firstIn.getTime() - shiftStart.getTime()) / 60000)
        }
      }

      try {
        await prisma.attendanceRecord.upsert({
          where: {
            org_id_employee_id_date: {
              org_id: session.user.org_id,
              employee_id: employeeId,
              date: dateObj,
            },
          },
          update: {
            first_in: firstIn,
            last_out: lastOut,
            total_hours: totalHours,
            status: firstIn ? 'present' : 'absent',
            is_late: isLate,
            late_by_minutes: lateByMinutes,
            source: 'csv_import',
          },
          create: {
            org_id: session.user.org_id,
            employee_id: employeeId,
            date: dateObj,
            first_in: firstIn,
            last_out: lastOut,
            total_hours: totalHours,
            status: firstIn ? 'present' : 'absent',
            is_late: isLate,
            late_by_minutes: lateByMinutes,
            source: 'csv_import',
          },
        })
        processed++
      } catch (err) {
        errors.push(`Failed to save record for employee ${employeeId} on ${dateStr}`)
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed,
        skipped,
        errors: errors.slice(0, 10),
        message: `Import complete — ${processed} records processed, ${skipped} skipped`,
      },
    })
  } catch (error) {
    console.error('ESSL import error:', error)
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 })
  }
}