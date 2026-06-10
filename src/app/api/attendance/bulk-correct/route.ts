import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getShiftSettings, lateCalc } from '@/lib/punch-processor'

/**
 * POST /api/attendance/bulk-correct
 *
 * Admin-only batch correction for attendance records — built for the case
 * where a biometric clock misconfiguration (e.g. 12-hour-mode PM punches
 * stored as AM) has produced systematically wrong first_in / last_out
 * values across many employees and many consecutive days.
 *
 * Body:
 *   {
 *     reason: string,                // applied to every row, audit trail
 *     corrections: [
 *       {
 *         employee_id: string,
 *         date:        "YYYY-MM-DD", // date the record belongs to (IST)
 *         first_in:    "HH:MM" | null,  // wall-clock IST; null marks absent
 *         last_out:    "HH:MM" | null,
 *         out_next_day?: boolean,    // OUT belongs to date+1 (night shift)
 *       },
 *       ...
 *     ]
 *   }
 *
 * Behaviour:
 *   - one transaction wraps every row → either all succeed or none
 *   - upsert-by-(org, employee_id, date) — works whether or not a record
 *     already exists, so an "absent" day can be set to "present" with
 *     real times
 *   - total_hours, is_late and late_by_minutes are recomputed from the
 *     corrected values using the org's actual shift settings (not the
 *     hardcoded 9:15 from the legacy single-row POST)
 *   - is_corrected=true and correction_reason are stamped so the original
 *     wrong data is visibly marked-as-fixed in reports
 *   - source = 'manual' so the next live punch from the device doesn't
 *     silently overwrite the correction (the live processor honours
 *     existing values)
 */

interface CorrectionInput {
  employee_id:  string
  date:         string
  first_in:     string | null
  last_out:     string | null
  out_next_day?: boolean
}

// Build a UTC Date from an IST "YYYY-MM-DD" date + "HH:MM" wall-clock
// time. IST is UTC+5:30 (no DST), so subtracting 5h30 from the IST instant
// gives us the right UTC moment.
//
// Kept inline rather than imported from a generic util — the rest of the
// codebase uses Intl.DateTimeFormat for this conversion in different
// contexts; here we know the input is always IST so we can short-cut.
const IST_OFFSET_MS = 5.5 * 60 * 60_000
function istDateAndTimeToUtc(dateStr: string, timeStr: string): Date {
  const [Y, M, D] = dateStr.split('-').map(Number)
  const [h, m]    = timeStr.split(':').map(Number)
  // Treat the (date, time) pair as an IST wall-clock moment, then subtract
  // the IST offset to get the equivalent UTC instant.
  return new Date(Date.UTC(Y, (M ?? 1) - 1, D ?? 1, h ?? 0, m ?? 0) - IST_OFFSET_MS)
}

/**
 * GET /api/attendance/bulk-correct?employee_id=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns the existing attendance_records (if any) for one employee across
 * the date range, in a shape tailored for the bulk-correct UI: one row
 * per calendar day in [from, to], pre-filling first_in/last_out (formatted
 * as IST HH:MM) so HR sees what's currently stored before they overwrite.
 *
 * Days with no record return an empty row — HR can still type values for
 * those, which become a fresh upsert in the POST.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const { org_id } = guard.user

    const url = new URL(req.url)
    const employeeId = url.searchParams.get('employee_id') ?? ''
    const from       = url.searchParams.get('from') ?? ''
    const to         = url.searchParams.get('to')   ?? ''
    if (!employeeId || !from || !to) {
      return NextResponse.json(
        { success: false, error: 'employee_id, from, to are required' },
        { status: 400 }
      )
    }

    // Verify org ownership of the employee — guard against guessing IDs
    // from other tenants via the URL.
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, org_id },
      select: { id: true, emp_code: true, first_name: true, last_name: true,
                department: { select: { name: true } } },
    })
    if (!emp) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const fromUtc = istDateAndTimeToUtc(from, '00:00')
    const toUtc   = istDateAndTimeToUtc(to,   '00:00')
    if (fromUtc.getTime() > toUtc.getTime()) {
      return NextResponse.json(
        { success: false, error: '`from` must be on or before `to`' },
        { status: 400 }
      )
    }
    // Cap range so a misclick doesn't pull a year of records. 92 days covers
    // 3 months, which is the usual outer bound for a single correction
    // session (one quarter's worth of wrong attendance after a long
    // misconfiguration).
    const dayCount = Math.round((toUtc.getTime() - fromUtc.getTime()) / 86_400_000) + 1
    if (dayCount > 92) {
      return NextResponse.json(
        { success: false, error: 'Date range too large (max 92 days per session)' },
        { status: 400 }
      )
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        org_id,
        employee_id: employeeId,
        date: { gte: fromUtc, lte: toUtc },
      },
      select: {
        date: true, first_in: true, last_out: true, status: true,
        is_late: true, late_by_minutes: true, total_hours: true,
        is_corrected: true, correction_reason: true,
      },
    })
    // Index by the "YYYY-MM-DD" string so the day-loop below can look up O(1).
    const byDate = new Map(records.map(r => [
      r.date.toISOString().slice(0, 10), r,
    ]))

    // Build one row per calendar day in [from, to] — including days with
    // no record at all, so HR can type values for those too.
    const days: Array<{
      date: string
      first_in:  string | null
      last_out:  string | null
      status:    string
      is_late:   boolean
      late_by_minutes: number
      total_hours: number | null
      is_corrected: boolean
      correction_reason: string | null
    }> = []

    // Format a UTC Date as IST "HH:MM" for the input fields — no AM/PM,
    // matches the <input type="time"> picker the UI uses.
    const fmtIstTime = (d: Date | null) => {
      if (!d) return null
      const ist = new Date(d.getTime() + IST_OFFSET_MS)
      const hh = String(ist.getUTCHours()).padStart(2, '0')
      const mm = String(ist.getUTCMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    }

    for (let i = 0; i < dayCount; i++) {
      const cur = new Date(fromUtc.getTime() + i * 86_400_000)
      const key = cur.toISOString().slice(0, 10)
      const r = byDate.get(key)
      days.push({
        date:              key,
        first_in:          fmtIstTime(r?.first_in ?? null),
        last_out:          fmtIstTime(r?.last_out ?? null),
        status:            r?.status ?? 'absent',
        is_late:           r?.is_late ?? false,
        late_by_minutes:   r?.late_by_minutes ?? 0,
        total_hours:       r?.total_hours != null ? Number(r.total_hours) : null,
        is_corrected:      r?.is_corrected ?? false,
        correction_reason: r?.correction_reason ?? null,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        employee: {
          id:         emp.id,
          emp_code:   emp.emp_code,
          name:       `${emp.first_name} ${emp.last_name}`.trim(),
          department: emp.department?.name ?? null,
        },
        days,
      },
    })
  } catch (error) {
    console.error('Bulk-correct GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load attendance' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const { org_id, id: actor_id } = guard.user

    const body = await req.json().catch(() => ({})) as {
      reason?:      string
      corrections?: CorrectionInput[]
    }

    const reason = (body.reason ?? '').trim()
    const corrections = Array.isArray(body.corrections) ? body.corrections : []

    if (reason.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Reason is required (at least 10 characters)' },
        { status: 400 }
      )
    }
    if (corrections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No corrections provided' },
        { status: 400 }
      )
    }
    // Cap to keep one HR's misclick from running a 10k-row transaction.
    // The UI doesn't show more than ~62 days × maybe a dozen employees at a
    // time, so 1000 is a generous ceiling.
    if (corrections.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Too many corrections in one request (max 1000)' },
        { status: 400 }
      )
    }

    // Validate every employee belongs to the caller's org BEFORE we start
    // mutating — refusing the whole batch is safer than half-applying it.
    const empIds = Array.from(new Set(corrections.map(c => c.employee_id)))
    const knownEmps = await prisma.employee.findMany({
      where: { id: { in: empIds }, org_id },
      select: { id: true },
    })
    if (knownEmps.length !== empIds.length) {
      return NextResponse.json(
        { success: false, error: 'Some employee IDs are invalid or belong to another organisation' },
        { status: 403 }
      )
    }

    const shift = await getShiftSettings(org_id)

    // Build the per-row update payloads BEFORE entering the transaction so
    // the txn window stays short. Each row computes its own derived
    // (total_hours, is_late, late_by_minutes, status) so the upsert is
    // strictly a write.
    const upserts: Array<{
      employee_id: string
      date:        Date
      data: {
        first_in:        Date | null
        last_out:        Date | null
        total_hours:     number | null
        status:          string
        is_late:         boolean
        late_by_minutes: number
        source:          string
        is_corrected:    boolean
        correction_reason: string
      }
    }> = []

    for (const c of corrections) {
      if (!c.employee_id || !c.date) continue
      const dateMidnightUtc = istDateAndTimeToUtc(c.date, '00:00')
      const firstIn = c.first_in ? istDateAndTimeToUtc(c.date, c.first_in) : null
      // Night-shift OUT: when HR marked "OUT belongs to next day", anchor
      // the OUT timestamp to date+1. Without this, an 04:20 night-shift
      // OUT on the 8th would store as 04:20 on the 8th and the system would
      // compute a *negative* duration vs the 17:50 IN.
      let lastOut: Date | null = null
      if (c.last_out) {
        if (c.out_next_day) {
          const nextDay = new Date(dateMidnightUtc.getTime() + 86_400_000)
          const nd = nextDay.toISOString().slice(0, 10)
          lastOut = istDateAndTimeToUtc(nd, c.last_out)
        } else {
          lastOut = istDateAndTimeToUtc(c.date, c.last_out)
        }
      }

      const totalHours = (firstIn && lastOut)
        ? (lastOut.getTime() - firstIn.getTime()) / 3_600_000
        : null

      const { isLate, lateByMinutes } = firstIn
        ? lateCalc(firstIn, shift)
        : { isLate: false, lateByMinutes: 0 }

      upserts.push({
        employee_id: c.employee_id,
        date:        dateMidnightUtc,
        data: {
          first_in:          firstIn,
          last_out:          lastOut,
          total_hours:       totalHours,
          // Status follows from whether there was a punch at all.
          // If you need leave/holiday/WFH semantics use the dedicated
          // endpoints — this tool is for "fix the in/out times".
          status:            firstIn ? 'present' : 'absent',
          is_late:           isLate,
          late_by_minutes:   lateByMinutes,
          // 'manual' tells the live punch processor not to clobber this
          // record if a stray future punch arrives for the same day.
          source:            'manual',
          is_corrected:      true,
          correction_reason: reason,
        },
      })
    }

    // Wrap the whole batch in a transaction so partial application can't
    // leave the dataset half-fixed. Callback form (not the array form) so
    // we can extend the default 5-second timeout — at the 1000-row cap
    // the per-row upsert latency can otherwise blow the txn budget.
    await prisma.$transaction(async tx => {
      for (const u of upserts) {
        await tx.attendanceRecord.upsert({
          where: {
            org_id_employee_id_date: {
              org_id,
              employee_id: u.employee_id,
              date:        u.date,
            },
          },
          create: {
            org_id,
            employee_id: u.employee_id,
            date:        u.date,
            ...u.data,
          },
          update: u.data,
        })
      }
    }, { timeout: 30_000, maxWait: 10_000 })

    return NextResponse.json({
      success: true,
      data: {
        corrected:    upserts.length,
        actor_id,    // surfaces to the toast — useful when the team asks "who fixed this?"
      },
    })
  } catch (error) {
    console.error('Bulk-correct error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to apply corrections' },
      { status: 500 }
    )
  }
}
