/**
 * GPS-based punch-in/out for field agents (employees without a fixed device).
 * Additive to punch-processor.ts — reuses its exported shift/late/status
 * helpers but does NOT modify or call into its write paths, since that file
 * is a hot path shared by device-push, sync, and CSV import.
 *
 * A punch is hard-blocked unless it falls within the radius of one of the
 * employee's assigned Geofences. Rejected attempts are still persisted (as
 * FieldPunch rows) for audit/fraud visibility, but never touch AttendanceRecord.
 */

import { prisma } from '@/lib/prisma'
import { notifyLateArrival } from '@/lib/notifications'
import { istDateOnly } from '@/lib/ist-date'
import { haversineDistanceMeters } from '@/lib/geo'
import { getShiftSettings, lateCalc, statusCalc } from '@/lib/punch-processor'

const DEBOUNCE_MS = 30_000

export class FieldPunchDebounceError extends Error {
  constructor() {
    super('Please wait a moment before punching again.')
    this.name = 'FieldPunchDebounceError'
  }
}

export interface FieldPunchInput {
  org_id: string
  employee_id: string
  direction: 'IN' | 'OUT'
  latitude: number
  longitude: number
  accuracy_m?: number
  selfie_key?: string
  punch_time?: Date
}

export interface FieldPunchResult {
  field_punch_id: string
  status: 'accepted' | 'rejected'
  reject_reason?: 'outside_geofence' | 'no_geofence_assigned'
  geofence?: { id: string; name: string } | null
  distance_m?: number | null
  radius_m?: number | null
  attendance_record_id?: string | null
}

interface GeofenceMatch {
  matched: boolean
  geofence: { id: string; name: string; radius_m: number } | null
  distance_m: number | null
  reject_reason: 'outside_geofence' | 'no_geofence_assigned' | null
}

async function matchGeofence(
  org_id: string, employee_id: string, lat: number, lng: number,
): Promise<GeofenceMatch> {
  const assignments = await prisma.employeeGeofence.findMany({
    where: { org_id, employee_id, geofence: { is_active: true } },
    select: {
      geofence: { select: { id: true, name: true, latitude: true, longitude: true, radius_m: true } },
    },
  })

  if (assignments.length === 0) {
    return { matched: false, geofence: null, distance_m: null, reject_reason: 'no_geofence_assigned' }
  }

  let nearest = { id: '', name: '', radius_m: 0, distance: Infinity }
  for (const { geofence: g } of assignments) {
    const distance = haversineDistanceMeters(lat, lng, Number(g.latitude), Number(g.longitude))
    if (distance < nearest.distance) {
      nearest = { id: g.id, name: g.name, radius_m: g.radius_m, distance }
    }
  }

  const geofence = { id: nearest.id, name: nearest.name, radius_m: nearest.radius_m }
  if (nearest.distance <= nearest.radius_m) {
    return { matched: true, geofence, distance_m: nearest.distance, reject_reason: null }
  }
  return { matched: false, geofence, distance_m: nearest.distance, reject_reason: 'outside_geofence' }
}

/**
 * Submit a field punch: validate against assigned geofences, persist the
 * attempt (accepted or rejected), and — only when accepted — upsert
 * AttendanceRecord using the same first_in/last_out/status math as a device
 * punch, with source: 'field'.
 */
export async function submitFieldPunch(input: FieldPunchInput): Promise<FieldPunchResult> {
  const { org_id, employee_id, direction, latitude, longitude, accuracy_m, selfie_key } = input
  const punch_time = input.punch_time ?? new Date()

  const recent = await prisma.fieldPunch.findFirst({
    where: {
      org_id, employee_id,
      punch_time: { gte: new Date(punch_time.getTime() - DEBOUNCE_MS) },
    },
    select: { id: true },
  })
  if (recent) throw new FieldPunchDebounceError()

  const match = await matchGeofence(org_id, employee_id, latitude, longitude)

  if (!match.matched) {
    const rejected = await prisma.fieldPunch.create({
      data: {
        org_id, employee_id, direction, punch_time, latitude, longitude,
        accuracy_m, selfie_key,
        status: 'rejected',
        reject_reason: match.reject_reason,
        geofence_id: match.geofence?.id ?? null,
        distance_m: match.distance_m,
      },
    })
    return {
      field_punch_id: rejected.id,
      status: 'rejected',
      reject_reason: match.reject_reason ?? undefined,
      geofence: match.geofence ? { id: match.geofence.id, name: match.geofence.name } : null,
      distance_m: match.distance_m,
      radius_m: match.geofence?.radius_m ?? null,
    }
  }

  const geofence = match.geofence! // matched === true guarantees this
  const shiftSettings = await getShiftSettings(org_id)
  const recordDate = istDateOnly(punch_time)

  const existing = await prisma.attendanceRecord.findUnique({
    where: { org_id_employee_id_date: { org_id, employee_id, date: recordDate } },
    select: { first_in: true, last_out: true },
  })

  // first_in/last_out = earliest/latest punch of the day, direction-independent
  // — same robustness rule as processPunch in punch-processor.ts.
  let firstIn: Date | null = existing?.first_in ?? null
  let lastOut: Date | null = existing?.last_out ?? null
  if (!firstIn || punch_time < firstIn) firstIn = punch_time
  if (!lastOut || punch_time > lastOut) lastOut = punch_time

  const effectiveLastOut: Date | null =
    lastOut && firstIn && lastOut.getTime() > firstIn.getTime() ? lastOut : null

  const totalHours: number | null =
    firstIn && effectiveLastOut
      ? (effectiveLastOut.getTime() - firstIn.getTime()) / 3_600_000
      : null

  const { isLate, lateByMinutes } = firstIn
    ? lateCalc(firstIn, shiftSettings)
    : { isLate: false, lateByMinutes: 0 }

  const status = statusCalc(firstIn, effectiveLastOut, totalHours, shiftSettings)

  const record = await prisma.attendanceRecord.upsert({
    where: { org_id_employee_id_date: { org_id, employee_id, date: recordDate } },
    update: {
      first_in: firstIn, last_out: effectiveLastOut, total_hours: totalHours,
      status, is_late: isLate, late_by_minutes: lateByMinutes,
      device_id: null, device_name: geofence.name, source: 'field',
    },
    create: {
      org_id, employee_id, date: recordDate,
      first_in: firstIn, last_out: effectiveLastOut, total_hours: totalHours,
      status, is_late: isLate, late_by_minutes: lateByMinutes,
      device_id: null, device_name: geofence.name, source: 'field',
    },
  })

  const accepted = await prisma.fieldPunch.create({
    data: {
      org_id, employee_id, direction, punch_time, latitude, longitude,
      accuracy_m, selfie_key,
      status: 'accepted',
      geofence_id: geofence.id,
      distance_m: match.distance_m,
      attendance_record_id: record.id,
    },
  })

  const isFirstArrival = !existing?.first_in || punch_time < existing.first_in
  if (isFirstArrival && isLate) {
    notifyLateArrival(org_id, employee_id, lateByMinutes).catch(() => {})
  }

  return {
    field_punch_id: accepted.id,
    status: 'accepted',
    geofence: { id: geofence.id, name: geofence.name },
    distance_m: match.distance_m,
    radius_m: geofence.radius_m,
    attendance_record_id: record.id,
  }
}
