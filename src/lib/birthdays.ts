/**
 * Birthday utilities — shared between the HR dashboard endpoint and the
 * employee portal aggregate, so both surfaces compute the same list from
 * the same source of truth (employees.personal_info.date_of_birth).
 *
 * DOB lives inside the Employee.personal_info JSON column as a string
 * (typically YYYY-MM-DD). We deliberately strip the year from the output
 * — coworkers don't need to see each other's age, only the month/day —
 * which is the privacy default most HR products land on.
 */

export interface UpcomingBirthday {
  employee_id: string
  emp_code:    string
  name:        string
  department:  string | null
  /** Month-day only ("Jul 14"). The year is intentionally not surfaced. */
  date_label:  string
  /** 0 = today, 1 = tomorrow, etc. Used for sorting + the "Today!" chip. */
  days_away:   number
  is_today:    boolean
}

type EmployeeRow = {
  id:           string
  emp_code:     string
  first_name:   string
  last_name:    string
  personal_info: unknown
  department:   { name: string } | null
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/**
 * Pull date_of_birth out of personal_info safely.
 * Returns null if missing, malformed, or not a parseable date.
 */
function extractDob(personalInfo: unknown): { month: number; day: number } | null {
  if (!personalInfo || typeof personalInfo !== 'object') return null
  const raw = (personalInfo as Record<string, unknown>).date_of_birth
  if (typeof raw !== 'string' || raw.trim() === '') return null

  // Accept both YYYY-MM-DD (the onboarding format) and full ISO timestamps.
  // We don't trust Date.parse blindly because "0001-01-01" or empty-ish
  // strings can sneak through with bogus month/day values.
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null

  // Use UTC accessors so a YYYY-MM-DD string isn't shifted by the server's
  // local timezone (which would push "1990-01-01" to Dec 31 in IST etc).
  const month = d.getUTCMonth() + 1 // 1–12
  const day   = d.getUTCDate()      // 1–31
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { month, day }
}

/**
 * Given employees, compute the upcoming-birthday list within `windowDays`.
 *
 * Sorted by (is_today desc, days_away asc, name asc).
 * Today's birthdays always come first regardless of the window.
 *
 * @param now reference "today" — pass `new Date()` from the caller so tests
 *            can pin it. Compared in UTC to avoid timezone drift.
 */
export function computeUpcomingBirthdays(
  employees: EmployeeRow[],
  opts: { now?: Date; windowDays?: number; excludeEmployeeId?: string | null } = {}
): UpcomingBirthday[] {
  const now = opts.now ?? new Date()
  const windowDays = opts.windowDays ?? 14
  const excludeId = opts.excludeEmployeeId ?? null

  // Work in UTC for the comparison so DST transitions and India-server
  // timezone differences don't shift days_away by ±1.
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const year = now.getUTCFullYear()

  const out: UpcomingBirthday[] = []
  for (const e of employees) {
    if (excludeId && e.id === excludeId) continue
    const dob = extractDob(e.personal_info)
    if (!dob) continue

    // Project this year's birthday; if it's already passed, project next year's.
    // This is the cheapest correct way to compute "days until next birthday"
    // and naturally handles end-of-year → start-of-year wrap-around.
    let next = Date.UTC(year, dob.month - 1, dob.day)
    if (next < todayUTC) {
      next = Date.UTC(year + 1, dob.month - 1, dob.day)
    }
    const daysAway = Math.round((next - todayUTC) / 86_400_000)
    if (daysAway > windowDays) continue

    out.push({
      employee_id: e.id,
      emp_code:    e.emp_code,
      name:        `${e.first_name} ${e.last_name}`.trim(),
      department:  e.department?.name ?? null,
      date_label:  `${MONTH_SHORT[dob.month - 1]} ${dob.day}`,
      days_away:   daysAway,
      is_today:    daysAway === 0,
    })
  }

  out.sort((a, b) => {
    if (a.days_away !== b.days_away) return a.days_away - b.days_away
    return a.name.localeCompare(b.name)
  })
  return out
}
