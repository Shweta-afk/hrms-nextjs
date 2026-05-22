/**
 * Shared punch-to-attendance processing logic.
 * Used by: device-push (real-time), sync (batch pull), CSV import (legacy).
 * Handles: employee lookup, PunchLog creation, AttendanceRecord upsert,
 *           first_in/last_out recalculation, late detection.
 */

import { prisma } from '@/lib/prisma'
import { notifyLateArrival } from '@/lib/notifications'

// ── Org-level shift settings cache (1 min TTL per org) ───────────────────────
interface ShiftSettings {
  shiftStartHour: number
  shiftStartMin:  number
  shiftEndHour:   number
  shiftEndMin:    number
  lateThreshold:  number
  fetchedAt:      number
}
const shiftCache = new Map<string, ShiftSettings>()
const CACHE_TTL_MS = 60_000

async function getShiftSettings(org_id: string): Promise<ShiftSettings> {
  const cached = shiftCache.get(org_id)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached

  const org = await prisma.organisation.findUnique({
    where: { id: org_id },
    select: { settings: true },
  })
  const s = (org?.settings ?? {}) as Record<string, unknown>
  const attendance = (s.attendance ?? {}) as Record<string, unknown>

  // Parse "HH:MM" strings stored in org settings, fall back to env vars
  const parseTime = (val: unknown, envKey: string, defaultH: number, defaultM: number) => {
    const str = (val as string | undefined) ?? process.env[envKey] ?? `${defaultH}:${String(defaultM).padStart(2,'0')}`
    const [h, m] = str.split(':').map(Number)
    return { h: isNaN(h) ? defaultH : h, m: isNaN(m) ? defaultM : m }
  }

  const start = parseTime(attendance.shift_start, 'SHIFT_START_TIME', 9, 0)
  const end   = parseTime(attendance.shift_end,   'SHIFT_END_TIME',   18, 0)

  const settings: ShiftSettings = {
    shiftStartHour: start.h,
    shiftStartMin:  start.m,
    shiftEndHour:   end.h,
    shiftEndMin:    end.m,
    lateThreshold:  Number(attendance.late_threshold ?? process.env.LATE_THRESHOLD_MINUTES ?? 15),
    fetchedAt:      Date.now(),
  }
  shiftCache.set(org_id, settings)
  return settings
}

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
function lateCalc(firstIn: Date, s: ShiftSettings): { isLate: boolean; lateByMinutes: number } {
  const graceLimit = new Date(firstIn)
  graceLimit.setUTCHours(
    // shift times are in device local (IST), but firstIn is UTC — convert
    // We use a simple approach: compare HH:MM in UTC+5:30
    s.shiftStartHour - 5,   // approximate; full IST → UTC conversion below
    s.shiftStartMin  + s.lateThreshold - 30,
    0, 0
  )

  // Proper IST comparison: add 5:30 to UTC time to get IST hours
  const istOffsetMs = 5.5 * 60 * 60_000
  const firstInIST = new Date(firstIn.getTime() + istOffsetMs)
  const shiftStartMinutes = s.shiftStartHour * 60 + s.shiftStartMin
  const firstInMinutes    = firstInIST.getUTCHours() * 60 + firstInIST.getUTCMinutes()
  const graceMinutes      = shiftStartMinutes + s.lateThreshold

  if (firstInMinutes <= graceMinutes) return { isLate: false, lateByMinutes: 0 }

  const lateByMinutes = firstInMinutes - shiftStartMinutes
  return { isLate: true, lateByMinutes }
}

/**
 * Process a single punch: save PunchLog + upsert AttendanceRecord.
 * Safe to call concurrently — uses upsert semantics throughout.
 */
export async function processPunch(input: PunchInput): Promise<PunchResult> {
  const { org_id, device_id, device_name, emp_code, punch_time, direction, raw_data } = input

  // Load org shift settings (cached 1 min)
  const shiftSettings = await getShiftSettings(org_id)

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

  const { isLate, lateByMinutes } = firstIn ? lateCalc(firstIn, shiftSettings) : { isLate: false, lateByMinutes: 0 }

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
