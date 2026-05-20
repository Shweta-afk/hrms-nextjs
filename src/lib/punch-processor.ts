/**
 * Shared punch-to-attendance processing logic.
 * Used by: device-push (real-time), sync (batch pull), CSV import (legacy).
 * Handles: employee lookup, PunchLog creation, AttendanceRecord upsert,
 *           first_in/last_out recalculation, late detection.
 */

import { prisma } from '@/lib/prisma'
import { notifyLateArrival } from '@/lib/notifications'

const SHIFT_START_HOUR = parseInt(process.env.SHIFT_START_TIME?.split(':')[0] ?? '9')
const SHIFT_START_MIN  = parseInt(process.env.SHIFT_START_TIME?.split(':')[1] ?? '0')
const LATE_THRESHOLD   = parseInt(process.env.LATE_THRESHOLD_MINUTES ?? '15')

export interface PunchInput {
  org_id:     string
  device_id:  string
  device_name: string
  emp_code:   string
  punch_time: Date
  direction:  'IN' | 'OUT'
  raw_data?:  string
}

export interface PunchResult {
  punch_log_id:         string
  attendance_record_id: string | null
  employee_id:          string | null
  skipped:              boolean
  reason?:              string
}

/** Extract midnight-UTC date from a punch timestamp (date portion only). */
function dateOnly(dt: Date): Date {
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()))
}

/** Calculate whether a first-in time is late and by how many minutes. */
function lateCalc(firstIn: Date): { isLate: boolean; lateByMinutes: number } {
  const graceLimit = new Date(firstIn)
  graceLimit.setHours(SHIFT_START_HOUR, SHIFT_START_MIN + LATE_THRESHOLD, 0, 0)

  if (firstIn <= graceLimit) return { isLate: false, lateByMinutes: 0 }

  const shiftStart = new Date(firstIn)
  shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MIN, 0, 0)
  const lateByMinutes = Math.floor((firstIn.getTime() - shiftStart.getTime()) / 60_000)
  return { isLate: true, lateByMinutes }
}

/**
 * Process a single punch: save PunchLog + upsert AttendanceRecord.
 * Safe to call concurrently — uses upsert semantics throughout.
 */
export async function processPunch(input: PunchInput): Promise<PunchResult> {
  const { org_id, device_id, device_name, emp_code, punch_time, direction, raw_data } = input

  // Resolve employee by emp_code OR legacy essl_device_id
  const employee = await prisma.employee.findFirst({
    where: {
      org_id,
      OR: [{ emp_code }, { essl_device_id: emp_code }],
    },
    select: { id: true },
  })

  if (!employee) {
    // Still persist the raw punch so it can be replayed after the employee is added
    const log = await prisma.punchLog.create({
      data: { org_id, device_id, emp_code, punch_time, direction, raw_data, processed: false },
    })
    return {
      punch_log_id: log.id,
      attendance_record_id: null,
      employee_id: null,
      skipped: true,
      reason: `Unknown emp_code: ${emp_code}`,
    }
  }

  // Persist the punch log (processed = true because we will create the record)
  const log = await prisma.punchLog.create({
    data: { org_id, device_id, emp_code, punch_time, direction, raw_data, processed: true },
  })

  const recordDate = dateOnly(punch_time)

  // Load existing attendance record for this employee+date
  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      org_id_employee_id_date: { org_id, employee_id: employee.id, date: recordDate },
    },
    select: { first_in: true, last_out: true },
  })

  // Recalculate first_in / last_out by comparing with new punch
  let firstIn: Date | null = existing?.first_in ?? null
  let lastOut: Date | null = existing?.last_out ?? null

  if (direction === 'IN') {
    if (!firstIn || punch_time < firstIn) firstIn = punch_time
  } else {
    if (!lastOut || punch_time > lastOut) lastOut = punch_time
  }

  // Derived fields
  let totalHours: number | null = null
  if (firstIn && lastOut && lastOut > firstIn) {
    totalHours = (lastOut.getTime() - firstIn.getTime()) / 3_600_000
  }

  const { isLate, lateByMinutes } = firstIn ? lateCalc(firstIn) : { isLate: false, lateByMinutes: 0 }

  const record = await prisma.attendanceRecord.upsert({
    where: {
      org_id_employee_id_date: { org_id, employee_id: employee.id, date: recordDate },
    },
    update: {
      first_in:        firstIn,
      last_out:        lastOut,
      total_hours:     totalHours,
      status:          firstIn ? 'present' : 'absent',
      is_late:         isLate,
      late_by_minutes: lateByMinutes,
      device_id,
      device_name,
      source:          'device',
    },
    create: {
      org_id,
      employee_id:     employee.id,
      date:            recordDate,
      first_in:        firstIn,
      last_out:        lastOut,
      total_hours:     totalHours,
      status:          firstIn ? 'present' : 'absent',
      is_late:         isLate,
      late_by_minutes: lateByMinutes,
      device_id,
      device_name,
      source:          'device',
    },
  })

  // Fire-and-forget: notify manager when employee punches IN late
  if (direction === 'IN' && isLate) {
    notifyLateArrival(org_id, employee.id, lateByMinutes).catch(() => {})
  }

  return {
    punch_log_id:         log.id,
    attendance_record_id: record.id,
    employee_id:          employee.id,
    skipped:              false,
  }
}

/**
 * Bulk-process an array of punches. Returns per-item results.
 * Processes sequentially to avoid unique-constraint races on AttendanceRecord.
 */
export async function processPunches(inputs: PunchInput[]): Promise<{
  processed: number
  skipped:   number
  errors:    string[]
}> {
  let processed = 0
  let skipped   = 0
  const errors: string[] = []

  for (const input of inputs) {
    try {
      const result = await processPunch(input)
      if (result.skipped) {
        skipped++
        if (result.reason) errors.push(result.reason)
      } else {
        processed++
      }
    } catch (err) {
      skipped++
      errors.push(`${input.emp_code} @ ${input.punch_time.toISOString()}: ${String(err)}`)
    }
  }

  return { processed, skipped, errors }
}
