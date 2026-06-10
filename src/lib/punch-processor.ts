/**
 * Shared punch-to-attendance processing logic.
 * Used by: device-push (real-time), sync (batch pull), CSV import (legacy).
 * Handles: employee lookup, PunchLog creation, AttendanceRecord upsert,
 *           first_in/last_out recalculation, late detection.
 */

import { prisma } from '@/lib/prisma'
import { notifyLateArrival } from '@/lib/notifications'

// ── Org-level shift settings cache (1 min TTL per org) ───────────────────────
export interface ShiftSettings {
  shiftStartHour: number
  shiftStartMin:  number
  shiftEndHour:   number
  shiftEndMin:    number
  lateThreshold:  number
  fetchedAt:      number
}
const shiftCache = new Map<string, ShiftSettings>()
const CACHE_TTL_MS = 60_000

// Exported so the bulk-correct admin endpoint can reuse the same shift
// rules — otherwise corrections would compute late-by-minutes against a
// hardcoded shift start (the legacy POST /api/attendance does this and
// gets it wrong for any org not on a 9:00 IST shift).
export async function getShiftSettings(org_id: string): Promise<ShiftSettings> {
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

/** Calculate whether a first-in time is late and by how many minutes.
 *  Exported for reuse by the bulk-correct endpoint — same rules as the
 *  live punch pipeline so a corrected record reads is_late identically
 *  to one that came in from the device. */
export function lateCalc(firstIn: Date, s: ShiftSettings): { isLate: boolean; lateByMinutes: number } {
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

  // first_in  = EARLIEST punch of the day (regardless of IN/OUT direction)
  // last_out  = LATEST punch of the day   (regardless of IN/OUT direction)
  // This is robust against direction mis-assignment from AiFace alternating logic.
  let firstIn: Date | null = existing?.first_in ?? null
  let lastOut: Date | null = existing?.last_out ?? null

  if (!firstIn || punch_time < firstIn) firstIn = punch_time
  if (!lastOut || punch_time > lastOut) lastOut  = punch_time

  // Only set last_out when there is a meaningful gap — a single punch means
  // the employee just arrived (or only tapped once), so keep last_out null.
  const effectiveLastOut: Date | null =
    lastOut && firstIn && lastOut.getTime() > firstIn.getTime() ? lastOut : null

  // Derived fields
  const totalHours: number | null =
    firstIn && effectiveLastOut
      ? (effectiveLastOut.getTime() - firstIn.getTime()) / 3_600_000
      : null

  const { isLate, lateByMinutes } = firstIn
    ? lateCalc(firstIn, shiftSettings)
    : { isLate: false, lateByMinutes: 0 }

  const record = await prisma.attendanceRecord.upsert({
    where: {
      org_id_employee_id_date: { org_id, employee_id: employee.id, date: recordDate },
    },
    update: {
      first_in:        firstIn,
      last_out:        effectiveLastOut,
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
      last_out:        effectiveLastOut,
      total_hours:     totalHours,
      status:          firstIn ? 'present' : 'absent',
      is_late:         isLate,
      late_by_minutes: lateByMinutes,
      device_id,
      device_name,
      source:          'device',
    },
  })

  // Fire late notification on first arrival of the day
  const isFirstArrival = !existing?.first_in || punch_time < existing.first_in
  if (isFirstArrival && isLate) {
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

/**
 * High-performance bulk processor — processes a batch of punches in 4 DB
 * round-trips instead of 4 × N.
 *
 * 1. ONE query  — batch employee lookup by emp_code
 * 2. ONE insert — createMany punch logs
 * 3. ONE query  — load existing AttendanceRecords for affected employee+days
 * 4. U upserts  — one per unique employee+day  (U << N for typical batches)
 *
 * All inputs must belong to the same org_id.
 */
export async function processPunchesBulk(inputs: PunchInput[]): Promise<{
  processed: number
  skipped:   number
  errors:    string[]
}> {
  if (inputs.length === 0) return { processed: 0, skipped: 0, errors: [] }

  const org_id        = inputs[0].org_id
  const shiftSettings = await getShiftSettings(org_id)

  // ── 1. Batch employee lookup ────────────────────────────────────────────
  const empCodes = [...new Set(inputs.map(i => i.emp_code))]
  const employees = await prisma.employee.findMany({
    where: {
      org_id,
      OR: [
        { emp_code:        { in: empCodes } },
        { essl_device_id:  { in: empCodes } },
      ],
    },
    select: { id: true, emp_code: true, essl_device_id: true },
  })

  const empMap = new Map<string, string>() // emp_code → employee_id
  for (const emp of employees) {
    if (emp.emp_code)       empMap.set(emp.emp_code,       emp.id)
    if (emp.essl_device_id) empMap.set(emp.essl_device_id, emp.id)
  }

  // ── 2. Batch insert punch logs ──────────────────────────────────────────
  await prisma.punchLog.createMany({
    data: inputs.map(i => ({
      org_id:     i.org_id,
      device_id:  i.device_id,
      emp_code:   i.emp_code,
      punch_time: i.punch_time,
      direction:  i.direction,
      raw_data:   i.raw_data ?? null,
      processed:  empMap.has(i.emp_code),
    })),
  }).catch(() => {}) // non-fatal if some logs already exist

  // ── 3. Group matched inputs by employee + date ──────────────────────────
  type DayData = {
    employee_id: string
    date:        Date
    firstIn:     Date | null
    lastOut:     Date | null
    device_id:   string
    device_name: string
  }

  const dayMap  = new Map<string, DayData>()
  let   skipped = 0
  const errors: string[] = []

  for (const input of inputs) {
    const employee_id = empMap.get(input.emp_code)
    if (!employee_id) { skipped++; continue }

    const date = dateOnly(input.punch_time)
    const key  = `${employee_id}_${date.toISOString()}`

    if (!dayMap.has(key)) {
      dayMap.set(key, {
        employee_id,
        date,
        firstIn:     null,
        lastOut:     null,
        device_id:   input.device_id,
        device_name: input.device_name,
      })
    }
    const d = dayMap.get(key)!
    // first_in = earliest punch, last_out = latest punch — direction-independent
    if (!d.firstIn || input.punch_time < d.firstIn) d.firstIn = input.punch_time
    if (!d.lastOut || input.punch_time > d.lastOut) d.lastOut  = input.punch_time
  }

  if (dayMap.size === 0) return { processed: 0, skipped, errors }

  // ── 4. Load existing attendance records (ONE query) ─────────────────────
  const dayEntries = [...dayMap.values()]
  const existing   = await prisma.attendanceRecord.findMany({
    where: {
      org_id,
      OR: dayEntries.map(d => ({ employee_id: d.employee_id, date: d.date })),
    },
    select: { employee_id: true, date: true, first_in: true, last_out: true },
  })

  for (const ex of existing) {
    const key = `${ex.employee_id}_${ex.date.toISOString()}`
    const d   = dayMap.get(key)
    if (!d) continue
    if (ex.first_in && (!d.firstIn || ex.first_in < d.firstIn)) d.firstIn = ex.first_in
    if (ex.last_out && (!d.lastOut || ex.last_out > d.lastOut)) d.lastOut = ex.last_out
  }

  // ── 4b. Merge ALL punch logs for these employees/dates ──────────────────
  // Unprocessed punches (employee not mapped at sync time) live in PunchLog
  // but never made it into AttendanceRecord.  Re-scan them here so first_in
  // always reflects the true earliest tap, not just the current batch.
  if (dayEntries.length > 0) {
    const minDate = new Date(Math.min(...dayEntries.map(d => d.date.getTime())))
    const maxDate = new Date(Math.max(...dayEntries.map(d => d.date.getTime())) + 86_400_000)
    const allLogs = await prisma.punchLog.findMany({
      where: {
        org_id,
        emp_code: { in: empCodes },
        punch_time: { gte: minDate, lt: maxDate },
      },
      select: { emp_code: true, punch_time: true },
    })
    for (const log of allLogs) {
      const employee_id = empMap.get(log.emp_code)
      if (!employee_id) continue
      const date = dateOnly(log.punch_time)
      const key  = `${employee_id}_${date.toISOString()}`
      const d    = dayMap.get(key)
      if (!d) continue  // only touch days already in this batch
      if (!d.firstIn || log.punch_time < d.firstIn) d.firstIn = log.punch_time
      if (!d.lastOut  || log.punch_time > d.lastOut) d.lastOut  = log.punch_time
    }
  }

  // ── 5. Upsert one record per unique employee+day ────────────────────────
  for (const d of dayMap.values()) {
    try {
      const { isLate, lateByMinutes } = d.firstIn
        ? lateCalc(d.firstIn, shiftSettings)
        : { isLate: false, lateByMinutes: 0 }

      // Only treat lastOut as a real checkout if it's strictly later than firstIn.
      // A single punch (or double-tap at the same second) must not set last_out.
      const effectiveLastOut =
        d.lastOut && d.firstIn && d.lastOut.getTime() > d.firstIn.getTime()
          ? d.lastOut : null

      const totalHours = d.firstIn && effectiveLastOut
        ? (effectiveLastOut.getTime() - d.firstIn.getTime()) / 3_600_000
        : null

      await prisma.attendanceRecord.upsert({
        where:  { org_id_employee_id_date: { org_id, employee_id: d.employee_id, date: d.date } },
        update: {
          first_in:        d.firstIn,
          last_out:        effectiveLastOut,
          total_hours:     totalHours,
          status:          d.firstIn ? 'present' : 'absent',
          is_late:         isLate,
          late_by_minutes: lateByMinutes,
          device_id:       d.device_id,
          device_name:     d.device_name,
          source:          'device',
        },
        create: {
          org_id,
          employee_id:     d.employee_id,
          date:            d.date,
          first_in:        d.firstIn,
          last_out:        effectiveLastOut,
          total_hours:     totalHours,
          status:          d.firstIn ? 'present' : 'absent',
          is_late:         isLate,
          late_by_minutes: lateByMinutes,
          device_id:       d.device_id,
          device_name:     d.device_name,
          source:          'device',
        },
      })
    } catch (err) {
      skipped++
      errors.push(`${d.employee_id} @ ${d.date.toISOString()}: ${String(err)}`)
    }
  }

  const processed = inputs.length - skipped
  return { processed, skipped, errors }
}
