/**
 * IST (Asia/Kolkata, UTC+5:30) calendar-date helpers.
 *
 * `AttendanceRecord.date` stores a UTC-midnight Date whose Y/M/D represent
 * the IST calendar day (the org operates in IST only). Every place that
 * derives "today" or buckets a punch timestamp into a day MUST go through
 * these helpers — taking the UTC calendar date of a raw timestamp directly
 * is wrong for ~5.5 hours a day (IST 00:00–05:29), when the IST date has
 * already rolled over but the UTC date hasn't yet.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60_000

/** IST calendar date (returned as UTC midnight) for a given instant. */
export function istDateOnly(dt: Date): Date {
  const shifted = new Date(dt.getTime() + IST_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

/** Today's IST calendar date (as UTC midnight) — the standard "today" boundary for attendance queries. */
export function todayIST(): Date {
  return istDateOnly(new Date())
}
