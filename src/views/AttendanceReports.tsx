'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  FileBarChart2, Download, Eye, RefreshCw, Loader2,
  Cpu, CheckCircle2, XCircle, AlertCircle, Users,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────

interface DailyRow {
  'Sl No': number
  'Employee Code': string
  'Employee Name': string
  Department: string
  Designation: string
  Date: string
  Day: string
  Shift: string
  'Time In': string
  'Time Out': string
  'Work Hours': string | number
  'Late By (min)': number
  'Overtime Hours': string | number
  Status: string
  Remarks: string
}

interface MonthlyRow {
  'Sl No': number
  'Employee Code': string
  'Employee Name': string
  Department: string
  'Total Working Days': number
  'Present Days': number
  'Absent Days': number
  'Late Days': number
  'Total Late Minutes': number
  'Half Days': number
  'Overtime Hours': number
  'LOP Days': number
  'Net Pay Days': number
  'Attendance %': string
  [key: string]: string | number
}

interface DeviceEmployee {
  employee_id: string
  emp_code: string
  name: string
  department: string | null
  designation: string | null
  hrms_status: string
  synced_at: string | null
  enrolled_at: string | null
  on_device: boolean | null
}

interface Device {
  id: string
  name: string
  ip_address: string
  port: number
  location: string | null
  status: string
  total_punches: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function statusBadge(status: string) {
  const cfg: Record<string, { label: string; className: string }> = {
    Present:   { label: 'Present',  className: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-0' },
    Late:      { label: 'Late',     className: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-0' },
    Absent:    { label: 'Absent',   className: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-0' },
    'Half Day':{ label: 'Half Day', className: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-0' },
  }
  const c = cfg[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-0' }
  return <Badge className={cn('text-[10px] px-1.5 py-0 font-medium', c.className)}>{c.label}</Badge>
}

function enrollBadge(hrmsStatus: string, onDevice: boolean | null) {
  if (hrmsStatus === 'enrolled' && onDevice === true) {
    return <Badge className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-0 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Enrolled</Badge>
  }
  if (hrmsStatus === 'enrolled' && onDevice === false) {
    return <Badge className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-0 text-[10px] gap-1"><AlertCircle className="h-3 w-3" />HRMS only</Badge>
  }
  if (hrmsStatus !== 'enrolled' && onDevice === true) {
    return <Badge className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-0 text-[10px] gap-1"><AlertCircle className="h-3 w-3" />Device only</Badge>
  }
  if (hrmsStatus === 'pending') {
    return <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Pending sync</Badge>
  }
  if (hrmsStatus === 'failed') {
    return <Badge className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-0 text-[10px] gap-1"><XCircle className="h-3 w-3" />Failed</Badge>
  }
  return <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Not enrolled</Badge>
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AttendanceReports() {
  const today = new Date()

  // Daily report state
  const [dailyDate, setDailyDate] = useState(format(subDays(today, 1), 'yyyy-MM-dd'))
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([])
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyDownloading, setDailyDownloading] = useState(false)

  // Range report state — HR picks from/to, sees one row per (employee × day)
  // covering the whole window. Defaults to "last 7 days ending yesterday" —
  // the most common "what happened this past week?" ask. Doesn't auto-fetch
  // (range reports can be slow); HR clicks Preview explicitly.
  const [rangeFrom, setRangeFrom] = useState(format(subDays(today, 7), 'yyyy-MM-dd'))
  const [rangeTo,   setRangeTo]   = useState(format(subDays(today, 1), 'yyyy-MM-dd'))
  const [rangeRows, setRangeRows] = useState<DailyRow[]>([])
  const [rangeMeta, setRangeMeta] = useState<{ total: number; employees: number; days: number; truncated: boolean } | null>(null)
  const [rangeLoading, setRangeLoading]         = useState(false)
  const [rangeDownloading, setRangeDownloading] = useState(false)

  // Monthly report state
  const [monthlyMonth, setMonthlyMonth] = useState(today.getMonth() + 1)
  const [monthlyYear, setMonthlyYear] = useState(today.getFullYear())
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([])
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [monthlyDownloading, setMonthlyDownloading] = useState(false)
  const [monthlyColumns, setMonthlyColumns] = useState<string[]>([])

  // Device panel state
  const [devices, setDevices] = useState<Device[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [peoplePanelDevice, setPeoplePanelDevice] = useState<Device | null>(null)
  const [devicePeople, setDevicePeople] = useState<DeviceEmployee[]>([])
  const [devicePeopleLoading, setDevicePeopleLoading] = useState(false)

  // ── Fetch daily preview ────────────────────────────────────────────────
  const fetchDailyPreview = useCallback(async () => {
    setDailyLoading(true)
    try {
      const res = await fetch(`/api/reports/attendance/daily?date=${dailyDate}&format=json`)
      const json = await res.json()
      if (json.success) setDailyRows(json.data)
      else toast.error(json.error ?? 'Failed to load daily preview')
    } catch {
      toast.error('Failed to load daily preview')
    } finally {
      setDailyLoading(false)
    }
  }, [dailyDate])

  // ── Download daily Excel ───────────────────────────────────────────────
  async function downloadDaily() {
    setDailyDownloading(true)
    try {
      const res = await fetch(`/api/reports/attendance/daily?date=${dailyDate}&format=excel`)
      if (!res.ok) { toast.error('Download failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_daily_${dailyDate}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    } finally {
      setDailyDownloading(false)
    }
  }

  // ── Fetch range preview ────────────────────────────────────────────────
  async function fetchRangePreview() {
    if (!rangeFrom || !rangeTo) { toast.error('Pick a from and to date'); return }
    if (rangeFrom > rangeTo) { toast.error('“From” date must be on or before “To” date'); return }
    setRangeLoading(true)
    try {
      const res = await fetch(`/api/reports/attendance/range?from=${rangeFrom}&to=${rangeTo}&format=json`)
      const json = await res.json()
      if (json.success) {
        setRangeRows(json.data.rows)
        setRangeMeta({
          total:      json.data.total_rows,
          employees:  json.data.employees,
          days:       json.data.days,
          truncated:  json.data.truncated,
        })
        if (json.data.truncated) {
          toast.message(`Showing first 500 of ${json.data.total_rows} rows — download for full data`)
        }
      } else {
        toast.error(json.error ?? 'Failed to load range preview')
      }
    } catch {
      toast.error('Failed to load range preview')
    } finally {
      setRangeLoading(false)
    }
  }

  // ── Download range Excel ───────────────────────────────────────────────
  async function downloadRange() {
    if (!rangeFrom || !rangeTo) { toast.error('Pick a from and to date'); return }
    if (rangeFrom > rangeTo) { toast.error('“From” date must be on or before “To” date'); return }
    setRangeDownloading(true)
    try {
      const res = await fetch(`/api/reports/attendance/range?from=${rangeFrom}&to=${rangeTo}&format=excel`)
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        toast.error(txt.includes('Date range too large') ? 'Range too large — max 92 days' : 'Download failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_${rangeFrom}_to_${rangeTo}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    } finally {
      setRangeDownloading(false)
    }
  }

  // ── Fetch monthly preview ──────────────────────────────────────────────
  const fetchMonthlyPreview = useCallback(async () => {
    setMonthlyLoading(true)
    try {
      const res = await fetch(`/api/reports/attendance/monthly?month=${monthlyMonth}&year=${monthlyYear}&format=json`)
      const json = await res.json()
      if (json.success) {
        setMonthlyRows(json.data)
        if (json.data.length > 0) setMonthlyColumns(Object.keys(json.data[0]))
      } else {
        toast.error(json.error ?? 'Failed to load monthly preview')
      }
    } catch {
      toast.error('Failed to load monthly preview')
    } finally {
      setMonthlyLoading(false)
    }
  }, [monthlyMonth, monthlyYear])

  // ── Download monthly Excel ─────────────────────────────────────────────
  async function downloadMonthly() {
    setMonthlyDownloading(true)
    try {
      const res = await fetch(`/api/reports/attendance/monthly?month=${monthlyMonth}&year=${monthlyYear}&format=excel`)
      if (!res.ok) { toast.error('Download failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_monthly_${MONTHS[monthlyMonth - 1]}_${monthlyYear}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    } finally {
      setMonthlyDownloading(false)
    }
  }

  // ── Fetch devices ──────────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true)
    try {
      const res = await fetch('/api/devices')
      const json = await res.json()
      if (json.success) setDevices(json.data ?? [])
    } catch {
      toast.error('Failed to load devices')
    } finally {
      setDevicesLoading(false)
    }
  }, [])

  // ── Fetch device people ────────────────────────────────────────────────
  async function openDevicePeople(device: Device) {
    setPeoplePanelDevice(device)
    setDevicePeople([])
    setDevicePeopleLoading(true)
    try {
      const res = await fetch(`/api/devices/${device.id}/employees`)
      const json = await res.json()
      if (json.success) setDevicePeople(json.data.employees)
      else toast.error(json.error ?? 'Failed to load device users')
    } catch {
      toast.error('Failed to load device users')
    } finally {
      setDevicePeopleLoading(false)
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────
  useEffect(() => { fetchDailyPreview() }, [fetchDailyPreview])
  useEffect(() => { fetchMonthlyPreview() }, [fetchMonthlyPreview])
  useEffect(() => { fetchDevices() }, [fetchDevices])

  const yearOptions = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i)

  return (
    <AppLayout title="Attendance Reports">
      <div className="p-6 space-y-8 max-w-full">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <FileBarChart2 className="h-5 w-5" />
            Attendance Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Download Smart Office–compatible Excel reports or preview data inline
          </p>
        </div>

        {/* ── Daily Report ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold">Daily Attendance Report</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All employees for a specific date — matches Smart Office daily export
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={dailyDate}
                  max={format(today, 'yyyy-MM-dd')}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={fetchDailyPreview} disabled={dailyLoading}>
                  {dailyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  Preview
                </Button>
                <Button size="sm" className="gap-1.5 text-xs" onClick={downloadDaily} disabled={dailyDownloading}>
                  {dailyDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dailyLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : dailyRows.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No attendance data for this date
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-[11px] font-semibold w-10">#</TableHead>
                      <TableHead className="text-[11px] font-semibold">Code</TableHead>
                      <TableHead className="text-[11px] font-semibold">Employee</TableHead>
                      <TableHead className="text-[11px] font-semibold">Department</TableHead>
                      <TableHead className="text-[11px] font-semibold">In</TableHead>
                      <TableHead className="text-[11px] font-semibold">Out</TableHead>
                      <TableHead className="text-[11px] font-semibold">Hours</TableHead>
                      <TableHead className="text-[11px] font-semibold">Late (min)</TableHead>
                      <TableHead className="text-[11px] font-semibold">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyRows.map((row) => (
                      <TableRow key={row['Sl No']} className="text-xs hover:bg-muted/30">
                        <TableCell className="text-muted-foreground">{row['Sl No']}</TableCell>
                        <TableCell className="font-mono text-[11px]">{row['Employee Code']}</TableCell>
                        <TableCell className="font-medium">{row['Employee Name']}</TableCell>
                        <TableCell className="text-muted-foreground">{row['Department']}</TableCell>
                        <TableCell className="font-mono text-[11px]">{row['Time In']}</TableCell>
                        <TableCell className="font-mono text-[11px]">{row['Time Out']}</TableCell>
                        <TableCell>{row['Work Hours']}</TableCell>
                        <TableCell className={row['Late By (min)'] > 0 ? 'text-amber-600 font-medium' : ''}>
                          {row['Late By (min)'] > 0 ? row['Late By (min)'] : '—'}
                        </TableCell>
                        <TableCell>{statusBadge(row['Status'])}</TableCell>
                        <TableCell className="text-muted-foreground text-[10px]">{row['Remarks']}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Range Report ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold">Range Attendance Report</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick any from–to window. One row per employee per day with timings, half-days, lates,
                  approved leaves (with leave type) and holidays. Max 92 days per report.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">From</span>
                  <input
                    type="date"
                    value={rangeFrom}
                    max={rangeTo}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">To</span>
                  <input
                    type="date"
                    value={rangeTo}
                    min={rangeFrom}
                    max={format(today, 'yyyy-MM-dd')}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="text-sm border border-border rounded-md px-2.5 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={fetchRangePreview} disabled={rangeLoading}>
                  {rangeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  Preview
                </Button>
                <Button size="sm" className="gap-1.5 text-xs" onClick={downloadRange} disabled={rangeDownloading}>
                  {rangeDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download Excel
                </Button>
              </div>
            </div>
            {rangeMeta && (
              <p className="text-xs text-muted-foreground mt-2">
                {rangeMeta.employees} employees × {rangeMeta.days} days · {rangeMeta.total.toLocaleString()} rows
                {rangeMeta.truncated && <span className="text-amber-600 ml-1.5">(preview shows first 500 — download for full data)</span>}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {rangeLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rangeRows.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Pick a date range and click Preview to see the data — or just click Download Excel
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-[11px] font-semibold w-10">#</TableHead>
                      <TableHead className="text-[11px] font-semibold">Code</TableHead>
                      <TableHead className="text-[11px] font-semibold">Employee</TableHead>
                      <TableHead className="text-[11px] font-semibold">Department</TableHead>
                      <TableHead className="text-[11px] font-semibold">Date</TableHead>
                      <TableHead className="text-[11px] font-semibold">Day</TableHead>
                      <TableHead className="text-[11px] font-semibold">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold">In</TableHead>
                      <TableHead className="text-[11px] font-semibold">Out</TableHead>
                      <TableHead className="text-[11px] font-semibold">Hours</TableHead>
                      <TableHead className="text-[11px] font-semibold">Late (min)</TableHead>
                      <TableHead className="text-[11px] font-semibold">Leave Type</TableHead>
                      <TableHead className="text-[11px] font-semibold">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rangeRows.map((row, idx) => (
                      <TableRow key={`${row['Employee Code']}-${row['Date']}-${idx}`} className="text-xs hover:bg-muted/30">
                        <TableCell className="text-muted-foreground">{row['Sl No']}</TableCell>
                        <TableCell className="font-mono text-[11px]">{row['Employee Code']}</TableCell>
                        <TableCell className="font-medium">{row['Employee Name']}</TableCell>
                        <TableCell className="text-muted-foreground">{row['Department']}</TableCell>
                        <TableCell className="font-mono text-[11px]">{row['Date']}</TableCell>
                        <TableCell className="text-muted-foreground">{row['Day']}</TableCell>
                        <TableCell>{statusBadge(row['Status'])}</TableCell>
                        <TableCell className="font-mono text-[11px]">{row['Time In']}</TableCell>
                        <TableCell className="font-mono text-[11px]">{row['Time Out']}</TableCell>
                        <TableCell>{row['Work Hours']}</TableCell>
                        <TableCell className={row['Late By (min)'] > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                          {row['Late By (min)'] > 0 ? row['Late By (min)'] : '—'}
                        </TableCell>
                        <TableCell className="text-[10px]">{(row as unknown as Record<string, string | number>)['Leave Type'] ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-[10px]">{row['Remarks']}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Monthly Report ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold">Monthly Attendance Summary</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Per-employee monthly summary with leave types, LOP, and attendance %
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={String(monthlyMonth)}
                  onValueChange={(v) => setMonthlyMonth(Number(v))}
                >
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(monthlyYear)}
                  onValueChange={(v) => setMonthlyYear(Number(v))}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={fetchMonthlyPreview} disabled={monthlyLoading}>
                  {monthlyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  Preview
                </Button>
                <Button size="sm" className="gap-1.5 text-xs" onClick={downloadMonthly} disabled={monthlyDownloading}>
                  {monthlyDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {monthlyLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : monthlyRows.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No data for this month
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      {monthlyColumns.map((col) => (
                        <TableHead key={col} className="text-[11px] font-semibold whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRows.map((row) => (
                      <TableRow key={row['Sl No']} className="text-xs hover:bg-muted/30">
                        {monthlyColumns.map((col) => (
                          <TableCell key={col} className={cn(
                            'whitespace-nowrap',
                            col === 'Absent Days' && Number(row[col]) > 0 ? 'text-red-600 font-medium' : '',
                            col === 'Late Days'   && Number(row[col]) > 0 ? 'text-amber-600 font-medium' : '',
                            col === 'Attendance %' ? 'font-medium' : '',
                          )}>
                            {col === 'Employee Code'
                              ? <span className="font-mono text-[11px]">{row[col]}</span>
                              : row[col]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Device Enrolled People ── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Device Enrolled People
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View all employees configured on each biometric device
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={fetchDevices} disabled={devicesLoading}>
                {devicesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {devicesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No devices configured — add a device in Settings
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {devices.map((device) => {
                  const statusColor =
                    device.status === 'online' ? 'bg-emerald-500' :
                    device.status === 'idle'   ? 'bg-amber-400' :
                    device.status === 'never_connected' ? 'bg-gray-300 dark:bg-muted-foreground/40' :
                    'bg-red-400'
                  return (
                    <div
                      key={device.id}
                      className="border border-border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 rounded-full shrink-0', statusColor)} />
                            <span className="font-medium text-sm truncate">{device.name}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {device.ip_address}:{device.port}
                            {device.location ? ` · ${device.location}` : ''}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {device.total_punches.toLocaleString()} total punches
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs shrink-0"
                          onClick={() => openDevicePeople(device)}
                        >
                          <Users className="h-3.5 w-3.5" />
                          People
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Device People Dialog ── */}
      <Dialog
        open={!!peoplePanelDevice}
        onOpenChange={(open) => { if (!open) setPeoplePanelDevice(null) }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              {peoplePanelDevice?.name} — Enrolled People
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              HRMS enrollment status cross-referenced with physical device users
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {devicePeopleLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : devicePeople.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No employees found
              </div>
            ) : (
              <>
                {/* Summary chips */}
                <div className="flex gap-2 flex-wrap mb-4">
                  <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full font-medium">
                    {devicePeople.filter((p) => p.hrms_status === 'enrolled' && p.on_device === true).length} Fully enrolled
                  </span>
                  <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full font-medium">
                    {devicePeople.filter((p) => p.hrms_status === 'enrolled' && p.on_device === false).length} HRMS only
                  </span>
                  <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full font-medium">
                    {devicePeople.filter((p) => p.hrms_status !== 'enrolled' && p.on_device === true).length} Device only
                  </span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">
                    {devicePeople.filter((p) => p.hrms_status === 'not_enrolled' && !p.on_device).length} Not enrolled
                  </span>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-[11px] font-semibold">Code</TableHead>
                      <TableHead className="text-[11px] font-semibold">Employee</TableHead>
                      <TableHead className="text-[11px] font-semibold">Department</TableHead>
                      <TableHead className="text-[11px] font-semibold">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold">Enrolled At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devicePeople.map((person) => (
                      <TableRow key={person.employee_id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono text-[11px]">{person.emp_code}</TableCell>
                        <TableCell className="font-medium">{person.name}</TableCell>
                        <TableCell className="text-muted-foreground">{person.department ?? '—'}</TableCell>
                        <TableCell>{enrollBadge(person.hrms_status, person.on_device)}</TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">
                          {person.enrolled_at
                            ? new Date(person.enrolled_at).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
