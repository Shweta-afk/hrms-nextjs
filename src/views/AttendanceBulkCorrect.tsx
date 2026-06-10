'use client'

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AppLayout from "@/components/AppLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Loader2, ArrowLeft, Save, RotateCcw, AlertTriangle, Wand2, Info,
} from "lucide-react"
import { toast } from "sonner"

/**
 * HR Bulk Attendance Correction
 *
 * Built for the scenario where a device-clock misconfiguration produces
 * systematically wrong first_in / last_out times across many employees and
 * many consecutive dates. HR picks one employee at a time + a date range,
 * sees current (wrong) values pre-filled, types the real times, and saves
 * the whole window in one transaction.
 *
 * Three quality-of-life affordances:
 *   1. "Quick apply" lets HR add/subtract a constant offset to every IN
 *      and/or OUT in the table — turns a 60-row correction into 4 clicks
 *      when the device error was a constant shift.
 *   2. "Out next day" toggle per row stays available for the rare
 *      overtime case where an OUT genuinely belongs to the calendar
 *      day after the IN. Not pre-ticked — this org has no night shift.
 *   3. Rows that have been edited get a yellow tint and a small "Edited"
 *      pill so HR knows exactly what they're about to save.
 */

interface EmpLite {
  id:        string
  emp_code:  string
  first_name: string
  last_name:  string
  department: { name: string } | null
}

interface DayRow {
  date:             string  // YYYY-MM-DD
  // Editable fields — start equal to original_first_in / original_last_out
  // and diverge as HR edits. Storing both lets us colour edited rows and
  // implement Reset.
  first_in:         string  // HH:MM ('' = blank)
  last_out:         string
  out_next_day:     boolean
  // Snapshot of what the API returned, for diffing + Reset
  original_first_in: string
  original_last_out: string
  original_out_next_day: boolean
  // For HR's reference only
  status:           string
  is_late:          boolean
  late_by_minutes:  number
  is_corrected:     boolean
  total_hours:      number | null
}

const todayIST = () => {
  // We want today's date in IST, formatted YYYY-MM-DD. Using toLocaleDateString
  // with timeZone is the simplest way that handles month/day rollovers around
  // midnight IST correctly.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

const daysAgoIST = (n: number) => {
  const t = new Date()
  t.setUTCDate(t.getUTCDate() - n)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(t)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

// Add a signed minute offset to an "HH:MM" string. Returns null if the
// result would cross midnight in either direction — the caller is expected
// to flip out_next_day in that case rather than us silently wrapping.
function shiftTime(hhmm: string, deltaMin: number): { time: string; crossedDay: number } | null {
  if (!hhmm) return null
  const [hh, mm] = hhmm.split(':').map(Number)
  if (isNaN(hh) || isNaN(mm)) return null
  let total = hh * 60 + mm + deltaMin
  let crossed = 0
  while (total < 0)   { total += 1440; crossed -= 1 }
  while (total >= 1440) { total -= 1440; crossed += 1 }
  const newH = String(Math.floor(total / 60)).padStart(2, '0')
  const newM = String(total % 60).padStart(2, '0')
  return { time: `${newH}:${newM}`, crossedDay: crossed }
}

const AttendanceBulkCorrect = () => {
  const router = useRouter()

  const [employees, setEmployees] = useState<EmpLite[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)

  const [employeeId, setEmployeeId] = useState<string>('')
  const [from, setFrom] = useState(daysAgoIST(7))
  const [to,   setTo]   = useState(todayIST())

  const [days, setDays] = useState<DayRow[]>([])
  const [empInfo, setEmpInfo] = useState<{ name: string; emp_code: string; department: string | null } | null>(null)
  const [loading, setLoading] = useState(false)

  const [reason, setReason] = useState('Biometric device time-format misconfiguration — PM punches recorded as AM. Re-keyed from CCTV / employee confirmation.')
  const [saving, setSaving] = useState(false)

  // Quick-apply controls
  const [qaTarget, setQaTarget] = useState<'first_in' | 'last_out' | 'both'>('first_in')
  const [qaDelta,  setQaDelta]  = useState('12:00') // signed HH:MM

  // Load employee list once. The combobox is intentionally simple — there's
  // typically <500 active employees per org and the native <Select/>
  // (with its built-in search via type-to-find) handles that fine.
  useEffect(() => {
    setEmployeesLoading(true)
    fetch('/api/employees?limit=500')
      .then(r => r.json())
      .then(json => {
        if (json.success) setEmployees(json.data.employees ?? json.data ?? [])
      })
      .catch(() => toast.error('Failed to load employees'))
      .finally(() => setEmployeesLoading(false))
  }, [])

  async function loadRange() {
    if (!employeeId) { toast.error('Pick an employee first'); return }
    if (!from || !to) { toast.error('Pick a date range'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance/bulk-correct?employee_id=${employeeId}&from=${from}&to=${to}`)
      const json = await res.json()
      if (!json.success) { toast.error(json.error); return }
      setEmpInfo({
        name: json.data.employee.name,
        emp_code: json.data.employee.emp_code,
        department: json.data.employee.department,
      })
      // Hydrate one row per day from the API. out_next_day is never
      // auto-ticked — this org has no night shift, so an OUT that's
      // numerically smaller than IN is almost certainly bad device data
      // that HR is about to overwrite anyway. Keeping the checkbox off
      // by default means HR's hand-typed times land on the same calendar
      // day where they belong.
      const rows: DayRow[] = (json.data.days as any[]).map(d => {
        const fi = d.first_in ?? ''
        const lo = d.last_out ?? ''
        return {
          date:                  d.date,
          first_in:              fi,
          last_out:              lo,
          out_next_day:          false,
          original_first_in:     fi,
          original_last_out:     lo,
          original_out_next_day: false,
          status:                d.status,
          is_late:               d.is_late,
          late_by_minutes:       d.late_by_minutes,
          is_corrected:          d.is_corrected,
          total_hours:           d.total_hours,
        }
      })
      setDays(rows)
    } catch {
      toast.error('Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  function updateRow(date: string, patch: Partial<DayRow>) {
    setDays(prev => prev.map(r => r.date === date ? { ...r, ...patch } : r))
  }

  function resetRow(date: string) {
    setDays(prev => prev.map(r => r.date === date ? {
      ...r,
      first_in:     r.original_first_in,
      last_out:     r.original_last_out,
      out_next_day: r.original_out_next_day,
    } : r))
  }

  // Returns the rows the user has actually edited — only these will be
  // sent to the API. Anything untouched is left alone in the DB so the
  // history stays clean.
  const editedRows = useMemo(() => days.filter(r =>
    r.first_in     !== r.original_first_in ||
    r.last_out     !== r.original_last_out ||
    r.out_next_day !== r.original_out_next_day
  ), [days])

  function applyQuickShift() {
    const sign = qaDelta.startsWith('-') ? -1 : 1
    const raw = qaDelta.replace(/^[-+]/, '')
    const [hStr, mStr] = raw.split(':')
    const h = Number(hStr || 0)
    const m = Number(mStr || 0)
    if (isNaN(h) || isNaN(m)) { toast.error('Offset must be HH:MM (e.g. 12:00 or -01:30)'); return }
    const delta = sign * (h * 60 + m)
    if (delta === 0) { toast.error('Offset is 0 — nothing to apply'); return }

    let touched = 0
    setDays(prev => prev.map(r => {
      // Skip days with no original data — quick-apply is for shifting
      // existing values, not for filling blanks (HR should hand-enter
      // those with the real times from CCTV / employee).
      if (!r.original_first_in && !r.original_last_out) return r
      let next = { ...r }

      if (qaTarget === 'first_in' || qaTarget === 'both') {
        const s = shiftTime(r.first_in, delta)
        if (s) {
          next.first_in = s.time
          // crossedDay on the IN side is rare (e.g. shifting a 23:00 IN by
          // +2h becomes 01:00 next day) but means the date for this row
          // should actually be the next day — out of scope for quick-apply.
          // We just leave the row marked edited and HR can adjust.
        }
      }
      if (qaTarget === 'last_out' || qaTarget === 'both') {
        const s = shiftTime(r.last_out, delta)
        if (s) {
          next.last_out = s.time
          // If the shift causes OUT to wrap past midnight forward, the
          // OUT now belongs to the next day → set out_next_day.
          if (s.crossedDay > 0) next.out_next_day = true
          // If the shift wraps backward, clear out_next_day.
          if (s.crossedDay < 0) next.out_next_day = false
        }
      }
      // Re-derive out_next_day from the new times: if OUT is numerically
      // earlier than IN on the same day, it must belong to the next day.
      if (next.first_in && next.last_out && next.last_out < next.first_in) {
        next.out_next_day = true
      }
      touched++
      return next
    }))
    toast.success(`Applied ${qaDelta} to ${qaTarget === 'both' ? 'IN and OUT' : qaTarget.replace('_', ' ')} on ${touched} row${touched === 1 ? '' : 's'}`)
  }

  async function handleSave() {
    if (editedRows.length === 0) {
      toast.error('No rows have been edited')
      return
    }
    if (reason.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters) for the audit trail')
      return
    }

    setSaving(true)
    try {
      const corrections = editedRows.map(r => ({
        employee_id:  employeeId,
        date:         r.date,
        first_in:     r.first_in || null,
        last_out:     r.last_out || null,
        out_next_day: r.out_next_day,
      }))
      const res = await fetch('/api/attendance/bulk-correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), corrections }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error); return }
      toast.success(`${json.data.corrected} attendance record${json.data.corrected === 1 ? '' : 's'} corrected`)
      // Re-load the range so the corrected values become the new "original"
      // baseline — keeps the diff display honest for follow-up edits.
      await loadRange()
    } catch {
      toast.error('Failed to save corrections')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout title="Bulk Attendance Correction">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header + back link */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push('/attendance')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Attendance
          </Button>
          {empInfo && (
            <div className="text-sm text-muted-foreground">
              Editing: <span className="font-medium text-foreground">{empInfo.name}</span>{' '}
              <span className="text-xs">({empInfo.emp_code}{empInfo.department ? ` · ${empInfo.department}` : ''})</span>
            </div>
          )}
        </div>

        {/* When-to-use callout — explains the propagation reality so HR
            isn't surprised when payroll doesn't auto-update. */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">When you use this tool</p>
              <p className="text-muted-foreground">
                Corrections save straight into the attendance ledger — the
                dashboard, reports, and the employee&apos;s own portal will
                show the new times immediately. <b>Payroll already run for
                the affected month does NOT auto-recalculate</b>: re-run
                payroll, or use Upload Adjustments to push corrected
                payslips. If payroll was already approved, unapprove the
                affected payslips first (Payroll → row &rarr; Unapprove).
              </p>
            </div>
          </div>
        </div>

        {/* Selection card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pick employee &amp; date range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId} disabled={employeesLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={employeesLoading ? 'Loading…' : 'Pick employee'} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.first_name} {e.last_name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {e.emp_code}{e.department?.name ? ` · ${e.department.name}` : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} max={to} />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} min={from} max={todayIST()} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end">
              <Button onClick={loadRange} disabled={!employeeId || loading}>
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</>
                  : 'Load attendance for this range'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {days.length > 0 && (
          <>
            {/* Quick-apply offset card — the "fix 30 rows in 4 clicks" tool */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Quick apply offset
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Add or subtract a fixed offset to every row at once — useful
                  when the device error was a constant shift (e.g. <code>+12:00</code>{' '}
                  for PM punches that were stored as AM). Prefix with{' '}
                  <code>-</code> to subtract. Skips days with no existing data.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <Label>Apply to</Label>
                    <Select value={qaTarget} onValueChange={v => setQaTarget(v as any)}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first_in">IN time only</SelectItem>
                        <SelectItem value="last_out">OUT time only</SelectItem>
                        <SelectItem value="both">Both IN and OUT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Offset (HH:MM, prefix &minus; for negative)</Label>
                    <Input
                      value={qaDelta}
                      onChange={e => setQaDelta(e.target.value)}
                      placeholder="e.g. 12:00 or -01:30"
                      className="w-44"
                    />
                  </div>
                  <Button variant="outline" onClick={applyQuickShift}>
                    <Wand2 className="h-4 w-4 mr-2" /> Apply
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Editor table */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Day-by-day correction
                    {editedRows.length > 0 && (
                      <Badge variant="notice" className="ml-3 text-[10px]">
                        {editedRows.length} edited
                      </Badge>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-32">IN time</TableHead>
                      <TableHead className="w-32">OUT time</TableHead>
                      <TableHead className="w-32">Out next day?</TableHead>
                      <TableHead className="w-20 text-right">Hrs</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {days.map(r => {
                      const edited =
                        r.first_in     !== r.original_first_in ||
                        r.last_out     !== r.original_last_out ||
                        r.out_next_day !== r.original_out_next_day
                      const wasCorrected = r.is_corrected && !edited
                      // Live-derived hours for the EDITED row (so HR can see
                      // the new total before saving). For unedited rows we
                      // show the stored total_hours.
                      let displayHours = r.total_hours
                      if (edited && r.first_in && r.last_out) {
                        const [fh, fm] = r.first_in.split(':').map(Number)
                        const [oh, om] = r.last_out.split(':').map(Number)
                        let mins = (oh * 60 + om) - (fh * 60 + fm)
                        if (r.out_next_day) mins += 1440
                        displayHours = mins > 0 ? mins / 60 : null
                      }
                      // A nonsense corrected duration (>24h, or negative)
                      // means HR's OUT-next-day toggle is probably wrong.
                      // Flag it inline so they don't save it by mistake.
                      const suspect = edited && displayHours != null && (displayHours <= 0 || displayHours > 18)

                      return (
                        <TableRow
                          key={r.date}
                          className={
                            edited ? 'bg-amber-50/50 dark:bg-amber-950/15' :
                            wasCorrected ? 'bg-emerald-50/30 dark:bg-emerald-950/10' :
                            undefined
                          }
                        >
                          <TableCell className="font-medium">
                            {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'present' ? 'active' : 'secondary'} className="text-[10px]">
                              {r.status}
                            </Badge>
                            {r.is_late && (
                              <p className="text-[10px] text-kpi-amber mt-0.5">
                                Late {r.late_by_minutes}m
                              </p>
                            )}
                            {wasCorrected && (
                              <p className="text-[10px] text-emerald-600 mt-0.5">Already corrected</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={r.first_in}
                              onChange={e => updateRow(r.date, { first_in: e.target.value })}
                              className="h-9 w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={r.last_out}
                              onChange={e => updateRow(r.date, { last_out: e.target.value })}
                              className="h-9 w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <label className="inline-flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={r.out_next_day}
                                onChange={e => updateRow(r.date, { out_next_day: e.target.checked })}
                                className="h-4 w-4 rounded border-zinc-300"
                              />
                              Next day
                            </label>
                          </TableCell>
                          <TableCell className={`text-right tabular-nums ${suspect ? 'text-destructive font-medium' : ''}`}>
                            {displayHours != null ? displayHours.toFixed(2) : '—'}
                            {suspect && (
                              <AlertTriangle className="inline h-3 w-3 ml-1" aria-label="Check OUT-next-day toggle" />
                            )}
                          </TableCell>
                          <TableCell>
                            {edited && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => resetRow(r.date)}
                                title="Reset this row to its loaded values"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Reason + save */}
            <Card>
              <CardContent className="py-5 space-y-4">
                <div className="space-y-1.5">
                  <Label>Reason for correction <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                    placeholder="At least 10 characters — explains the audit trail"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored on every corrected record for the audit trail. Same reason applies to all rows you save in this batch.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {editedRows.length === 0
                      ? 'No edits yet — type new times above.'
                      : `Ready to save ${editedRows.length} corrected ${editedRows.length === 1 ? 'row' : 'rows'}.`}
                  </p>
                  <Button onClick={handleSave} disabled={saving || editedRows.length === 0}>
                    {saving
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                      : <><Save className="h-4 w-4 mr-2" /> Save corrections</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Footer help */}
        <p className="text-xs text-muted-foreground text-center">
          For one-off fixes, click any row in the regular{' '}
          <Link href="/attendance" className="text-primary hover:underline">Attendance page</Link>.
          This screen is for batch corrections.
        </p>
      </div>
    </AppLayout>
  )
}

export default AttendanceBulkCorrect
