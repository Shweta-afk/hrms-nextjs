// Shared "is this date off for this shift schedule" logic — used by payroll
// run generation and the attendance report export, which used to each carry
// their own slightly-different copy of this calculation.
//
// A ShiftGroup's schedule is expressed as `off_day_rules`: for each weekday
// that's ever off, which occurrence(s)-in-the-month it applies to. This
// generalizes the plain "weekly_offs" day list (every week) to patterns like
// "only the 2nd Saturday" or "the 1st and 3rd Sunday" — common alternating
// schedules that a flat day-of-week list can't express. A shift group with
// no off_day_rules falls back to its legacy weekly_offs (every occurrence).

export interface OffDayRule {
  weekday: number            // 0=Sun … 6=Sat
  occurrences: 'all' | number[]  // 'all', or a mix of 1-5 (nth occurrence) and -1 (last occurrence of that weekday in the month)
}

const MAX_OCCURRENCE = 5

/** Which occurrence (1st, 2nd, …) of its weekday this date is within its month. */
export function occurrenceInMonth(date: Date): number {
  return Math.ceil(date.getUTCDate() / 7)
}

/** Is `date` the LAST time its weekday appears in its month? */
function isLastOccurrenceInMonth(date: Date): boolean {
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  return date.getUTCDate() + 7 > daysInMonth
}

/**
 * Is `date` an off-day per this shift's schedule (ignoring holidays and
 * working-day overrides — those are layered on separately by callers)?
 */
export function isScheduledOffDay(
  date: Date,
  offDayRules: OffDayRule[] | null | undefined,
  legacyWeeklyOffs: number[],
): boolean {
  const dow = date.getUTCDay()
  if (!offDayRules || offDayRules.length === 0) {
    return legacyWeeklyOffs.includes(dow)
  }
  const rule = offDayRules.find(r => r.weekday === dow)
  if (!rule) return false
  if (rule.occurrences === 'all') return true
  const occurrence = occurrenceInMonth(date)
  if (rule.occurrences.includes(occurrence)) return true
  if (rule.occurrences.includes(-1) && isLastOccurrenceInMonth(date)) return true
  return false
}

/**
 * Working days within an arbitrary date range (inclusive both ends),
 * honoring the shift's off-day schedule, real holidays, and any HR
 * working-day overrides (a weekly-off/holiday date HR marked as worked).
 */
export function getWorkingDaysInPeriod(
  from: Date,
  to: Date,
  offDayRules: OffDayRule[] | null | undefined,
  legacyWeeklyOffs: number[],
  holidays: { date: Date; type: string }[],
  workingDayOverrides: string[] | Set<string>,
): number {
  const overrideSet = workingDayOverrides instanceof Set ? workingDayOverrides : new Set(workingDayOverrides)
  const holidaySet = new Set(
    holidays
      .filter(h => h.type !== 'working_day')
      .map(h => new Date(h.date).toISOString().slice(0, 10))
  )

  let count = 0
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))

  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10)
    if (isScheduledOffDay(cur, offDayRules, legacyWeeklyOffs)) {
      if (overrideSet.has(iso)) count++ // HR marked this off-day as a working day
    } else if (!holidaySet.has(iso)) {
      count++
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ORDINAL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', [-1]: 'last' }

/** Human-readable summary for shift-group list/detail UI, e.g. "Sun (every week), Sat (2nd, 4th)". */
export function describeOffDaySchedule(
  offDayRules: OffDayRule[] | null | undefined,
  legacyWeeklyOffs: number[],
): string {
  if (!offDayRules || offDayRules.length === 0) {
    if (legacyWeeklyOffs.length === 0) return 'No weekly off'
    return legacyWeeklyOffs
      .slice()
      .sort((a, b) => a - b)
      .map(d => DAY_NAMES[d])
      .join(', ')
  }
  return offDayRules
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map(r => {
      if (r.occurrences === 'all') return DAY_NAMES[r.weekday]
      const labels = r.occurrences
        .slice()
        .sort((a, b) => a - b)
        .map(o => ORDINAL[o] ?? String(o))
      return `${DAY_NAMES[r.weekday]} (${labels.join(', ')})`
    })
    .join(', ')
}

/** Validates and normalizes an off_day_rules payload from the client. Returns null if input is empty/absent. */
export function normalizeOffDayRules(input: unknown): OffDayRule[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const out: OffDayRule[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const rec = raw as Record<string, unknown>
    const weekday = Number(rec.weekday)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue
    const occ = rec.occurrences
    if (occ === 'all') {
      out.push({ weekday, occurrences: 'all' })
      continue
    }
    if (Array.isArray(occ)) {
      const cleaned = occ
        .map(Number)
        .filter(n => Number.isInteger(n) && (n === -1 || (n >= 1 && n <= MAX_OCCURRENCE)))
      if (cleaned.length > 0) out.push({ weekday, occurrences: Array.from(new Set(cleaned)) })
    }
  }
  return out.length > 0 ? out : null
}
