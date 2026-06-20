'use client'

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Download, Upload, Users, UserX,
  CalendarDays, Clock, Home, Wifi, Loader2, BarChart3, FileSpreadsheet,
  Mail, CheckCircle2, UserPlus, Filter, Wand2,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AttendanceRecord {
  id: string;
  date: string;
  first_in: string | null;
  last_out: string | null;
  total_hours: string | null;
  overtime_hours: string | null;
  status: string;
  is_late: boolean;
  late_by_minutes: number;
  is_corrected: boolean;
  source: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    emp_code: string;
    department: { name: string } | null;
  };
}

interface Summary { present: number; absent: number; late: number }
interface TodaySummary { present: number; absent: number; on_leave: number; late: number; wfh: number }

interface MonthSummary {
  month: number; present: number; absent: number; late: number; ot_hours: number;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const statusStyle: Record<string, string> = {
  present:  "bg-kpi-green/15 text-kpi-green",
  absent:   "bg-kpi-red/15 text-kpi-red",
  late:     "bg-kpi-amber/15 text-kpi-amber",
  half_day: "bg-kpi-amber/25 text-kpi-amber",
  holiday:  "bg-muted text-muted-foreground",
  weekend:  "bg-muted text-muted-foreground",
}

const heatmapColors: Record<string, string> = {
  present: "bg-kpi-green",
  absent:  "bg-kpi-red",
  late:    "bg-kpi-amber",
  holiday: "bg-muted-foreground/30",
  weekend: "bg-muted-foreground/20",
}

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
}

const Attendance = () => {
  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState('')   // "YYYY-MM-DD" — filters table to a single day
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<Summary>({ present: 0, absent: 0, late: 0 })
  const [today, setToday] = useState<TodaySummary>({ present: 0, absent: 0, on_leave: 0, late: 0, wfh: 0 })
  const [loading, setLoading] = useState(true)

  // Import modal
  const [importModal, setImportModal] = useState(false)
  const [importTab, setImportTab] = useState<'smartoffice' | 'essl' | 'monthly' | 'biometric'>('monthly')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const xlsxRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const monthlyRef = useRef<HTMLInputElement>(null)

  // Biometric API Pull state
  const [bioApiUrl, setBioApiUrl] = useState('')
  const [bioApiKey, setBioApiKey] = useState('')
  const [bioAccountName, setBioAccountName] = useState('')
  const [bioFromDate, setBioFromDate] = useState('')
  const [bioToDate, setBioToDate] = useState('')
  const [bioPulling, setBioPulling] = useState(false)
  const [bioPullResult, setBioPullResult] = useState<{
    fetched: number; processed: number; skipped: number;
    unmatched: string[]; errors: string[]
  } | null>(null)
  const [bioSettingsSaved, setBioSettingsSaved] = useState(false)

  // Monthly Details import result & email sending
  const [monthlyResult, setMonthlyResult] = useState<{
    message: string; date_range: string; payroll_month: number; payroll_year: number;
    employees_total: number; employees_created: number; records_saved: number;
    employees: Array<{
      emp_code: string; name: string; employee_id: string;
      email: string | null; is_new: boolean;
      present: number; absent: number; late: number; records_saved: number
    }>
  } | null>(null)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [emailsSent, setEmailsSent] = useState(false)

  // All active employees — for "today" view (show absent employees too)
  const [activeEmployees, setActiveEmployees] = useState<Array<{
    id: string; first_name: string; last_name: string; emp_code: string;
    department: { name: string } | null;
  }>>([])

  // Reports: filter by employee
  const [reportEmpFilter, setReportEmpFilter] = useState<string>('all')

  // Year overview
  const [showYearView, setShowYearView] = useState(false)
  const [yearSummary, setYearSummary] = useState<MonthSummary[]>([])
  const [yearLoading, setYearLoading] = useState(false)
  const [yearOffset, setYearOffset] = useState(0)

  // Reports
  const [activeReport, setActiveReport] = useState<'absent' | 'late' | 'ot' | 'grid'>('absent')

  // Correction / Add modal
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null)
  const [corrFirstIn, setCorrFirstIn] = useState('')
  const [corrLastOut, setCorrLastOut] = useState('')
  const [corrStatus, setCorrStatus] = useState('present')
  const [corrReason, setCorrReason] = useState('')
  const [correcting, setCorrecting] = useState(false)

  const current = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = current.getDay()
  const month = current.getMonth() + 1
  const year = current.getFullYear()
  const monthLabel = current.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
  const viewYear = now.getFullYear() + yearOffset

  async function fetchAttendance() {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance?month=${month}&year=${year}&limit=5000`)
      const json = await res.json()
      if (json.success) {
        setRecords(json.data.records)
        setSummary(json.data.summary)
        // `today` is always today's headcount snapshot; safe-fallback to zeroes
        // if an older API build doesn't return it yet.
        if (json.data.today) setToday(json.data.today)
      } else toast.error('Failed to load attendance')
    } catch { toast.error('Failed to load attendance') }
    finally { setLoading(false) }
  }

  async function fetchYearSummary() {
    setYearLoading(true)
    try {
      const res = await fetch(`/api/attendance/year-summary?year=${viewYear}`)
      const json = await res.json()
      if (json.success) setYearSummary(json.data.summary)
    } catch { /* silent */ }
    finally { setYearLoading(false) }
  }

  useEffect(() => { fetchAttendance() }, [monthOffset])
  useEffect(() => { if (showYearView) fetchYearSummary() }, [showYearView, yearOffset])

  // Fetch payroll-included active employees for today's absent/present view
  useEffect(() => {
    fetch('/api/employees?status=active&limit=500&payroll_only=true')
      .then(r => r.json())
      .then(j => { if (j.success) setActiveEmployees(j.data.employees ?? j.data ?? []) })
      .catch(() => {})
  }, [])

  // Heatmap
  const heatmap: Record<number, string> = {}
  records.forEach(r => {
    const day = new Date(r.date).getDate()
    heatmap[day] = r.is_late ? 'late' : r.status
  })
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow === 0 || dow === 6) heatmap[d] = heatmap[d] || 'weekend'
  }

  // Today's date as "YYYY-MM-DD" in IST — matches how dates are stored in DB (UTC midnight = IST date for normal office hours)
  const todayDateStr = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const lateToday = records.filter(r => (r.date as string).slice(0, 10) === todayDateStr && r.is_late)

  // Today-only view: all employees with their today status (present/late/absent)
  const todayRecordsOnly = records.filter(r => (r.date as string).slice(0, 10) === todayDateStr)
  const todayRecordByEmpId = new Map(todayRecordsOnly.map(r => [r.employee.id, r]))
  // Employees with no record today show as absent
  const todayAbsentRows: AttendanceRecord[] = activeEmployees
    .filter(e => !todayRecordByEmpId.has(e.id))
    .map(e => ({
      id: `absent-${e.id}`,
      date: new Date().toISOString(),
      first_in: null, last_out: null, total_hours: null, overtime_hours: null,
      status: 'absent', is_late: false, late_by_minutes: 0, is_corrected: false, source: 'device',
      employee: { id: e.id, first_name: e.first_name, last_name: e.last_name, emp_code: e.emp_code, department: e.department },
    }))
  // Combine: present/late first, then absent — sorted by name within each group
  const todayAllRows: AttendanceRecord[] = [
    ...todayRecordsOnly.sort((a, b) => `${a.employee.first_name} ${a.employee.last_name}`.localeCompare(`${b.employee.first_name} ${b.employee.last_name}`)),
    ...todayAbsentRows.sort((a, b) => `${a.employee.first_name} ${a.employee.last_name}`.localeCompare(`${b.employee.first_name} ${b.employee.last_name}`)),
  ]

  // Smart Office XLSX import
  async function handleSmartOfficeImport(file: File) {
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/attendance/import-smartoffice', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.success) {
        setImportResult(json.data)
        toast.success(json.data.message)
        // Navigate to the month/year of the imported data so user can see it immediately
        if (json.data.imported_month && json.data.imported_year) {
          const targetDate = new Date(json.data.imported_year, json.data.imported_month - 1, 1)
          const nowDate   = new Date(now.getFullYear(), now.getMonth(), 1)
          const diff = (targetDate.getFullYear() - nowDate.getFullYear()) * 12
            + (targetDate.getMonth() - nowDate.getMonth())
          setMonthOffset(diff)
        } else {
          fetchAttendance()
        }
      } else {
        toast.error(json.error || 'Import failed')
      }
    } catch { toast.error('Import failed') }
    finally { setImporting(false) }
  }

  // ESSL CSV import
  async function handleEsslImport(file: File) {
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/attendance/import', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.success) {
        setImportResult(json.data)
        toast.success(json.data.message)
        fetchAttendance()
      } else toast.error('Import failed')
    } catch { toast.error('Import failed') }
    finally { setImporting(false) }
  }

  // Monthly Details CSV import
  async function handleMonthlyDetailsImport(file: File) {
    setImporting(true)
    setMonthlyResult(null)
    setEmailsSent(false)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/attendance/import-monthly-details', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.success) {
        setMonthlyResult(json.data)
        toast.success(json.data.message)
        // Navigate to the payroll month so data is immediately visible
        if (json.data.imported_month && json.data.imported_year) {
          const targetDate = new Date(json.data.imported_year, json.data.imported_month - 1, 1)
          const nowDate    = new Date(now.getFullYear(), now.getMonth(), 1)
          const diff = (targetDate.getFullYear() - nowDate.getFullYear()) * 12
            + (targetDate.getMonth() - nowDate.getMonth())
          setMonthOffset(diff)
        } else {
          fetchAttendance()
        }
      } else {
        toast.error(json.error || 'Import failed')
      }
    } catch { toast.error('Import failed') }
    finally { setImporting(false) }
  }

  // Load saved biometric API config from org settings
  async function loadBiometricConfig() {
    try {
      const res  = await fetch('/api/org/settings')
      const json = await res.json()
      if (json.success && json.data?.biometric) {
        const b = json.data.biometric as Record<string, string>
        if (b.api_url)      setBioApiUrl(b.api_url)
        if (b.api_key)      setBioApiKey(b.api_key)
        if (b.account_name) setBioAccountName(b.account_name)
      }
    } catch { /* non-critical */ }
  }

  // Save biometric API config to org settings
  async function handleSaveBioSettings() {
    try {
      const res = await fetch('/api/org/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ biometric: { api_url: bioApiUrl, api_key: bioApiKey, account_name: bioAccountName } }),
      })
      const json = await res.json()
      if (json.success) {
        setBioSettingsSaved(true)
        toast.success('Biometric API settings saved')
        setTimeout(() => setBioSettingsSaved(false), 3000)
      } else {
        toast.error('Failed to save settings')
      }
    } catch { toast.error('Failed to save settings') }
  }

  // Pull attendance from biometric API
  async function handleBiometricPull() {
    if (!bioFromDate || !bioToDate) {
      toast.error('Please select a date range')
      return
    }
    setBioPulling(true)
    setBioPullResult(null)
    try {
      const res  = await fetch('/api/attendance/biometric-pull', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          from_date:    bioFromDate,
          to_date:      bioToDate,
          api_url:      bioApiUrl  || undefined,
          api_key:      bioApiKey  || undefined,
          account_name: bioAccountName || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setBioPullResult(json.data)
        if (json.data.processed > 0) {
          toast.success(`Pulled ${json.data.processed} attendance records`)
          fetchAttendance()
        } else if (json.data.fetched === 0) {
          toast.info('No records found in that date range')
        } else {
          toast.warning('Records fetched but none matched — check Employee Codes')
        }
      } else {
        toast.error(json.error ?? 'Pull failed')
      }
    } catch { toast.error('Failed to pull from biometric API') }
    finally  { setBioPulling(false) }
  }

  // Send welcome emails to imported employees
  async function handleSendWelcomeEmails() {
    if (!monthlyResult) return
    const employeeIds = monthlyResult.employees.map(e => e.employee_id)
    setSendingEmails(true)
    try {
      const res = await fetch('/api/attendance/send-welcome-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_ids: employeeIds }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.data.message)
        setEmailsSent(true)
      } else {
        toast.error(json.error || 'Failed to send emails')
      }
    } catch { toast.error('Failed to send emails') }
    finally { setSendingEmails(false) }
  }

  function handleDownloadReport() {
    if (records.length === 0) { toast.error('No attendance records to export'); return }
    const headers = ['Employee Code','Employee Name','Department','Date','Check In','Check Out','Total Hours','Status','Late','Late By (mins)','Source']
    const rows = records.map(r => [
      r.employee.emp_code,
      `${r.employee.first_name} ${r.employee.last_name}`,
      r.employee.department?.name ?? '',
      new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      r.first_in ? formatTime(r.first_in) : '',
      r.last_out ? formatTime(r.last_out) : '',
      r.total_hours ? parseFloat(r.total_hours).toFixed(2) : '',
      r.is_late ? 'Late' : r.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      r.is_late ? 'Yes' : 'No',
      r.late_by_minutes,
      r.source,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-${monthLabel.replace(' ', '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Downloaded — ${records.length} records`)
  }

  function openCorrection(r: AttendanceRecord) {
    setCorrectionRecord(r)
    setCorrFirstIn(r.first_in ? formatTime(r.first_in) : '')
    setCorrLastOut(r.last_out ? formatTime(r.last_out) : '')
    setCorrStatus(r.status === 'absent' ? 'present' : r.status)
    setCorrReason('')
  }

  async function submitCorrection() {
    if (!correctionRecord) return
    if (!corrReason.trim()) { toast.error('Correction reason is required'); return }
    setCorrecting(true)

    const isAbsent = correctionRecord.id.startsWith('absent-')
    const date = new Date(correctionRecord.date)

    const toDateTime = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number)
      const d = new Date(date)
      d.setHours(h, m, 0, 0)
      return d.toISOString()
    }

    try {
      if (isAbsent) {
        // CREATE — employee had no record; POST to /api/attendance
        const empId = correctionRecord.employee.id
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id:       empId,
            date:              date.toISOString(),
            first_in:          corrFirstIn  ? toDateTime(corrFirstIn)  : null,
            last_out:          corrLastOut  ? toDateTime(corrLastOut)   : null,
            status:            corrStatus,
            correction_reason: corrReason.trim(),
            source:            'manual',
          }),
        })
        const json = await res.json()
        if (json.success) {
          // Add the new record to local state so the row updates immediately
          const newRecord: AttendanceRecord = {
            ...json.data,
            employee: correctionRecord.employee,
            is_corrected: true,
          }
          setRecords(prev => [newRecord, ...prev])
          toast.success('Attendance record added')
          setCorrectionRecord(null)
          fetchAttendance() // re-fetch to get accurate summary
        } else toast.error(json.error || 'Failed to add attendance')
      } else {
        // UPDATE — existing record
        const res = await fetch(`/api/attendance/${correctionRecord.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_in: corrFirstIn ? toDateTime(corrFirstIn) : undefined,
            last_out: corrLastOut ? toDateTime(corrLastOut) : undefined,
            status: corrStatus,
            correction_reason: corrReason.trim(),
          }),
        })
        const json = await res.json()
        if (json.success) {
          setRecords(prev => prev.map(r => r.id === correctionRecord.id ? { ...r, ...json.data, is_corrected: true } : r))
          toast.success('Attendance corrected')
          setCorrectionRecord(null)
        } else toast.error(json.error || 'Failed to correct attendance')
      }
    } catch { toast.error('Failed to save attendance') }
    finally { setCorrecting(false) }
  }

  // Year overview colour based on attendance ratio
  function monthBarColor(present: number, absent: number) {
    const total = present + absent
    if (total === 0) return 'bg-muted'
    const ratio = present / total
    if (ratio >= 0.9) return 'bg-kpi-green'
    if (ratio >= 0.75) return 'bg-kpi-amber'
    return 'bg-kpi-red'
  }

  // ── Per-employee report aggregates (computed from current month records) ──

  interface EmpKey { id: string; name: string; emp_code: string; dept: string }

  const filteredRecords = reportEmpFilter === 'all' ? records : records.filter(r => r.employee.id === reportEmpFilter)

  const absentReport = (() => {
    // Working days in the selected month up to today (Mon–Fri only)
    const todayStr = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const workingDays: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (dateStr > todayStr) break
      const dow = new Date(year, month - 1, d).getDay()
      if (dow !== 0 && dow !== 6) workingDays.push(dateStr)
    }

    // Build a set of dates each employee was present/wfh/half_day
    const presentDates = new Map<string, Set<string>>()
    for (const r of filteredRecords) {
      if (r.status === 'absent') continue
      const eid = r.employee.id
      if (!presentDates.has(eid)) presentDates.set(eid, new Set())
      presentDates.get(eid)!.add((r.date as string).slice(0, 10))
    }

    // For each active employee find working days with no present record
    const empsToCheck = reportEmpFilter === 'all'
      ? activeEmployees
      : activeEmployees.filter(e => e.id === reportEmpFilter)

    const result = new Map<string, EmpKey & { days: number; dates: string[] }>()
    for (const emp of empsToCheck) {
      const present = presentDates.get(emp.id) ?? new Set<string>()
      const absentDays = workingDays.filter(d => !present.has(d))
      if (absentDays.length === 0) continue
      result.set(emp.id, {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        emp_code: emp.emp_code,
        dept: emp.department?.name ?? '—',
        days: absentDays.length,
        dates: absentDays.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      })
    }
    return [...result.values()].sort((a, b) => b.days - a.days)
  })()

  const lateReport = (() => {
    const map = new Map<string, EmpKey & { count: number; totalMins: number; maxMins: number; worstDate: string }>()
    for (const r of filteredRecords) {
      if (!r.is_late) continue
      const key = r.employee.id
      if (!map.has(key)) map.set(key, { id: key, name: `${r.employee.first_name} ${r.employee.last_name}`, emp_code: r.employee.emp_code, dept: r.employee.department?.name ?? '—', count: 0, totalMins: 0, maxMins: 0, worstDate: '' })
      const e = map.get(key)!
      e.count++
      e.totalMins += r.late_by_minutes
      if (r.late_by_minutes > e.maxMins) { e.maxMins = r.late_by_minutes; e.worstDate = new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
    }
    return [...map.values()].sort((a, b) => b.totalMins - a.totalMins)
  })()

  const otReport = (() => {
    const map = new Map<string, EmpKey & { days: number; totalHours: number }>()
    for (const r of filteredRecords) {
      const ot = r.overtime_hours ? parseFloat(r.overtime_hours) : 0
      if (ot <= 0) continue
      const key = r.employee.id
      if (!map.has(key)) map.set(key, { id: key, name: `${r.employee.first_name} ${r.employee.last_name}`, emp_code: r.employee.emp_code, dept: r.employee.department?.name ?? '—', days: 0, totalHours: 0 })
      const e = map.get(key)!
      e.days++
      e.totalHours += ot
    }
    return [...map.values()].sort((a, b) => b.totalHours - a.totalHours)
  })()

  const fmtMins = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`

  function downloadReportCsv(type: 'absent' | 'late' | 'ot') {
    let headers: string[]
    let rows: (string | number)[][]
    if (type === 'absent') {
      headers = ['Emp Code', 'Name', 'Department', 'Absent Days', 'Absent Dates']
      rows = absentReport.map(e => [e.emp_code, e.name, e.dept, e.days, e.dates.join(' | ')])
    } else if (type === 'late') {
      headers = ['Emp Code', 'Name', 'Department', 'Late Count', 'Total Late Time', 'Avg Late (mins)', 'Worst Day', 'Max Late (mins)']
      rows = lateReport.map(e => [e.emp_code, e.name, e.dept, e.count, fmtMins(e.totalMins), Math.round(e.totalMins / e.count), e.worstDate, e.maxMins])
    } else {
      headers = ['Emp Code', 'Name', 'Department', 'OT Days', 'Total OT Hours', 'Avg OT per Day (hrs)']
      rows = otReport.map(e => [e.emp_code, e.name, e.dept, e.days, e.totalHours.toFixed(2), (e.totalHours / e.days).toFixed(2)])
    }
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}-report-${monthLabel.replace(' ', '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${type} report`)
  }

  return (
    <AppLayout title="Attendance">
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setMonthOffset(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center">{monthLabel}</span>
            <Button variant="outline" size="icon" onClick={() => setMonthOffset(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {/* Date picker — loads that specific day's attendance */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                title="View a specific date"
                value={selectedDate}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring w-36"
                onChange={e => {
                  const val = e.target.value
                  setSelectedDate(val)
                  if (val) {
                    const d = new Date(val)
                    if (!isNaN(d.getTime())) {
                      const diff = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
                      setMonthOffset(diff)
                    }
                  }
                }}
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="text-xs text-muted-foreground hover:text-foreground px-1"
                  title="Clear date filter"
                >✕</button>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={showYearView ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowYearView(v => !v)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Year Overview
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setImportModal(true); setImportResult(null); loadBiometricConfig() }}>
              <Upload className="h-4 w-4 mr-2" /> Import Report
            </Button>
            {/* Batch correction tool — surfaced here (not under a menu) because
                this is the single most-asked-for feature whenever a biometric
                clock misfires for >1 day, and burying it costs an extra two
                clicks every time HR needs to fix a fresh mess. */}
            <Button asChild variant="outline" size="sm">
              <Link href="/attendance/bulk-correct">
                <Wand2 className="h-4 w-4 mr-2" /> Bulk Correct
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadReport}>
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
          </div>
        </div>

        {/* Year Overview */}
        {showYearView && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Year Overview — {viewYear}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYearOffset(y => y - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium w-12 text-center">{viewYear}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYearOffset(y => y + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {yearLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
                  {yearSummary.map(m => {
                    const total = m.present + m.absent
                    const pct = total > 0 ? Math.round((m.present / total) * 100) : 0
                    const barColor = monthBarColor(m.present, m.absent)
                    const isCurrentMonth = m.month === now.getMonth() + 1 && viewYear === now.getFullYear()
                    return (
                      <div
                        key={m.month}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border ${isCurrentMonth ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                      >
                        <span className={`text-[11px] font-semibold ${isCurrentMonth ? 'text-primary' : 'text-muted-foreground'}`}>
                          {MONTH_NAMES[m.month - 1]}
                        </span>
                        {/* bar */}
                        <div className="w-full bg-muted rounded-full h-16 flex flex-col justify-end overflow-hidden">
                          {total > 0 && (
                            <div
                              className={`w-full ${barColor} rounded-sm transition-all`}
                              style={{ height: `${pct}%` }}
                            />
                          )}
                        </div>
                        <span className="text-[11px] font-bold tabular-nums">
                          {total > 0 ? `${pct}%` : '—'}
                        </span>
                        <div className="text-[10px] text-muted-foreground text-center leading-tight">
                          <div className="text-kpi-green">{m.present}P</div>
                          <div className="text-kpi-red">{m.absent}A</div>
                          {m.ot_hours > 0 && (
                            <div className="text-kpi-amber">{m.ot_hours.toFixed(0)}h OT</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-kpi-green inline-block" /> ≥90% present</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-kpi-amber inline-block" /> 75–90%</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-kpi-red inline-block" /> &lt;75%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            // KPI strip = TODAY's headcount (not month-aggregate). Sourced
            // from `today` rather than `summary` because `summary` switches to
            // employee-days when a month is queried — which made these cards
            // misleading (e.g. "Present Today: 65" was actually June's running
            // total of person-days).
            { label: "Present Today",   value: today.present,  icon: Users,        color: "text-kpi-green",   bg: "bg-kpi-green/10" },
            { label: "Absent",          value: today.absent,   icon: UserX,        color: "text-kpi-red",     bg: "bg-kpi-red/10" },
            { label: "On Leave",        value: today.on_leave, icon: CalendarDays, color: "text-primary",     bg: "bg-primary/10" },
            { label: "Late Arrivals",   value: today.late,     icon: Clock,        color: "text-kpi-amber",   bg: "bg-kpi-amber/10" },
            { label: "Work from Home",  value: today.wfh,      icon: Home,         color: "text-kpi-purple",  bg: "bg-kpi-purple/10" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Attendance Table */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {selectedDate
                    ? `Attendance — ${new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : monthOffset === 0
                      ? `Today's Attendance (${todayAllRows.length} employees)`
                      : `Attendance — ${monthLabel}`}
                </CardTitle>
                {selectedDate && (
                  <span className="text-xs text-muted-foreground">
                    {records.filter(r => (r.date as string).slice(0, 10) === selectedDate).length} records
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (() => {
                const tableRows = selectedDate
                  ? records.filter(r => (r.date as string).slice(0, 10) === selectedDate)
                  : monthOffset === 0 ? todayAllRows : records
                return tableRows.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  {selectedDate ? `No attendance records for ${selectedDate}` : 'No attendance records for this period'}
                </div>
              ) : (
                <div className="overflow-auto max-h-[480px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Dept</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>In</TableHead>
                        <TableHead>Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className={`text-[10px] ${r.status === 'absent' ? 'bg-kpi-red/10 text-kpi-red' : 'bg-primary/10 text-primary'}`}>
                                  {r.employee.first_name[0]}{r.employee.last_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">
                                {r.employee.first_name} {r.employee.last_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {r.employee.department?.name ?? '—'}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[r.is_late ? 'late' : r.status] || statusStyle.present}`}>
                              {r.is_late ? 'Late' : r.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{formatTime(r.first_in)}</TableCell>
                          <TableCell className="text-sm">{formatTime(r.last_out)}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {r.total_hours ? `${parseFloat(r.total_hours).toFixed(1)}h` : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {r.is_corrected && (
                                <Badge variant="notice" className="text-[10px]">Corrected</Badge>
                              )}
                              <button
                                className={`text-xs font-medium hover:underline ${r.id.startsWith('absent-') ? 'text-kpi-green' : 'text-primary'}`}
                                onClick={() => openCorrection(r)}
                              >
                                {r.id.startsWith('absent-') ? 'Add Record' : 'Correct'}
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
              })()}
            </CardContent>
          </Card>

          {/* Right panels */}
          <div className="lg:col-span-2 space-y-6">

            {/* Late Arrivals */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Late Arrivals Today ({lateToday.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lateToday.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No late arrivals today</p>
                ) : (
                  lateToday.map((r) => (
                    <div key={r.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px] bg-kpi-amber/15 text-kpi-amber">
                          {r.employee.first_name[0]}{r.employee.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.employee.first_name} {r.employee.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">Arrived {formatTime(r.first_in)}</p>
                      </div>
                      <Badge variant="notice" className="text-[10px]">{r.late_by_minutes} min late</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Smart Office Sync Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Data Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Smart Office XLSX</span>
                  <div className="flex items-center gap-1.5">
                    <Wifi className="h-3.5 w-3.5 text-kpi-green" />
                    <Badge variant="active" className="text-[10px]">Ready</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">ESSL CSV</span>
                  <Badge variant="secondary" className="text-[10px]">Available</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Records this month</span>
                  <span className="text-sm font-medium">{records.length}</span>
                </div>
                <Button
                  className="w-full" size="sm"
                  onClick={() => { setImportModal(true); setImportResult(null); loadBiometricConfig() }}
                >
                  <Upload className="h-4 w-4 mr-2" /> Import Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Detailed Reports ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base">Detailed Reports — {monthLabel}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Employee filter */}
                <Select value={reportEmpFilter} onValueChange={setReportEmpFilter}>
                  <SelectTrigger className="h-8 text-xs w-44 gap-1">
                    <Filter className="h-3 w-3 shrink-0" />
                    <SelectValue placeholder="All employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All employees</SelectItem>
                    {[...new Map(records.map(r => [r.employee.id, r.employee])).values()]
                      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
                      .map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.first_name} {e.last_name} ({e.emp_code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {/* Tab switcher */}
                <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                  {([
                    { key: 'absent', label: `Absent (${absentReport.length})` },
                    { key: 'late',   label: `Late (${lateReport.length})` },
                    { key: 'ot',     label: `Overtime (${otReport.length})` },
                    { key: 'grid',   label: 'Daily Grid' },
                  ] as const).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setActiveReport(t.key)}
                      className={`px-3 py-1.5 transition-colors ${activeReport === t.key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {activeReport !== 'grid' && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => downloadReportCsv(activeReport as 'absent' | 'late' | 'ot')}>
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">

            {/* ── Absent Report ── */}
            {activeReport === 'absent' && (
              absentReport.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No absences recorded this month</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Absent Days</TableHead>
                      <TableHead>Absent Dates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absentReport.map(e => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px] bg-kpi-red/15 text-kpi-red">
                                {e.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{e.name}</p>
                              <p className="text-[11px] text-muted-foreground">{e.emp_code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.dept}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center rounded-full w-8 h-8 text-sm font-bold ${e.days >= 5 ? 'bg-kpi-red/15 text-kpi-red' : e.days >= 3 ? 'bg-kpi-amber/15 text-kpi-amber' : 'bg-muted text-foreground'}`}>
                            {e.days}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {e.dates.map(d => (
                              <span key={d} className="inline-block bg-kpi-red/10 text-kpi-red text-[10px] font-medium px-1.5 py-0.5 rounded">{d}</span>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}

            {/* ── Late Report ── */}
            {activeReport === 'late' && (
              lateReport.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No late arrivals recorded this month</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Late Count</TableHead>
                      <TableHead>Total Late Time</TableHead>
                      <TableHead>Avg / Day</TableHead>
                      <TableHead>Worst Day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lateReport.map(e => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px] bg-kpi-amber/15 text-kpi-amber">
                                {e.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{e.name}</p>
                              <p className="text-[11px] text-muted-foreground">{e.emp_code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.dept}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center rounded-full w-8 h-8 text-sm font-bold ${e.count >= 5 ? 'bg-kpi-red/15 text-kpi-red' : e.count >= 3 ? 'bg-kpi-amber/15 text-kpi-amber' : 'bg-kpi-amber/10 text-kpi-amber'}`}>
                            {e.count}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{fmtMins(e.totalMins)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtMins(Math.round(e.totalMins / e.count))}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{e.worstDate}</span>
                            <span className="text-[11px] text-kpi-red font-medium">+{fmtMins(e.maxMins)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}

            {/* ── OT Report ── */}
            {activeReport === 'ot' && (
              otReport.length === 0 ? (
                <div className="text-center py-10 space-y-1">
                  <p className="text-sm text-muted-foreground">No overtime recorded this month</p>
                  <p className="text-xs text-muted-foreground/70">OT hours are imported via Smart Office Monthly Details report</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">OT Days</TableHead>
                      <TableHead>Total OT</TableHead>
                      <TableHead>Avg / Day</TableHead>
                      <TableHead>OT Bar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const maxHrs = Math.max(...otReport.map(e => e.totalHours), 1)
                      return otReport.map(e => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px] bg-kpi-purple/15 text-kpi-purple">
                                  {e.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{e.name}</p>
                                <p className="text-[11px] text-muted-foreground">{e.emp_code}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.dept}</TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center rounded-full w-8 h-8 text-sm font-bold bg-kpi-purple/10 text-kpi-purple">
                              {e.days}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-bold text-kpi-purple">{e.totalHours.toFixed(1)}h</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{(e.totalHours / e.days).toFixed(1)}h</TableCell>
                          <TableCell className="w-32">
                            <div className="h-2 rounded-full bg-muted overflow-hidden w-full">
                              <div
                                className="h-full rounded-full bg-kpi-purple transition-all"
                                style={{ width: `${(e.totalHours / maxHrs) * 100}%` }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    })()}
                  </TableBody>
                </Table>
              )
            )}

            {/* ── Daily Grid ── */}
            {activeReport === 'grid' && (() => {
              // Group records by employee, then by day-of-month
              const empRows = (() => {
                const map = new Map<string, {
                  id: string; name: string; emp_code: string; dept: string;
                  days: Map<number, AttendanceRecord>
                }>()
                for (const r of filteredRecords) {
                  const key = r.employee.id
                  if (!map.has(key)) map.set(key, {
                    id: key,
                    name: `${r.employee.first_name} ${r.employee.last_name}`,
                    emp_code: r.employee.emp_code,
                    dept: r.employee.department?.name ?? '—',
                    days: new Map(),
                  })
                  const d = parseInt((r.date as string).split('T')[0].split('-')[2])
                  map.get(key)!.days.set(d, r)
                }
                return [...map.values()].sort((a, b) => a.emp_code.localeCompare(b.emp_code))
              })()
              const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1)
              const cellCls = (r: AttendanceRecord | undefined) => {
                if (!r) return 'bg-muted/40 text-muted-foreground/30'
                const s = r.is_late ? 'late' : r.status
                return ({
                  present:    'bg-kpi-green/20 text-kpi-green font-semibold',
                  late:       'bg-kpi-amber/20 text-kpi-amber font-semibold',
                  absent:     'bg-kpi-red/20 text-kpi-red font-semibold',
                  half_day:   'bg-kpi-amber/10 text-kpi-amber',
                  holiday:    'bg-muted text-muted-foreground',
                  weekly_off: 'bg-muted/50 text-muted-foreground/50',
                } as Record<string, string>)[s] ?? 'bg-muted text-muted-foreground'
              }
              const cellLabel = (r: AttendanceRecord | undefined) => {
                if (!r) return ''
                const s = r.is_late ? 'late' : r.status
                return ({ present: 'P', late: 'L', absent: 'A', half_day: '½', holiday: 'H', weekly_off: '–' } as Record<string, string>)[s] ?? '?'
              }
              if (empRows.length === 0) return (
                <p className="text-sm text-muted-foreground text-center py-10">No attendance records for this month</p>
              )
              return (
                <div className="overflow-x-auto">
                  <table className="text-[11px] border-collapse w-max min-w-full">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 bg-card border-b border-border px-3 py-2 text-left font-medium text-muted-foreground min-w-[160px]">
                          Employee
                        </th>
                        <th className="sticky left-[160px] z-10 bg-card border-b border-border px-2 py-2 text-left font-medium text-muted-foreground min-w-[90px]">
                          Dept
                        </th>
                        {dayNums.map(d => {
                          const dow = new Date(year, month - 1, d).getDay()
                          const isWeekend = dow === 0 || dow === 6
                          return (
                            <th key={d} className={`border-b border-border px-0 py-2 text-center font-medium w-8 ${isWeekend ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                              {d}
                            </th>
                          )
                        })}
                        <th className="border-b border-border px-2 py-2 text-center font-medium text-muted-foreground">P</th>
                        <th className="border-b border-border px-2 py-2 text-center font-medium text-muted-foreground">A</th>
                        <th className="border-b border-border px-2 py-2 text-center font-medium text-muted-foreground">L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empRows.map((emp, ri) => {
                        let pCount = 0, aCount = 0, lCount = 0
                        return (
                          <tr key={emp.id} className={ri % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                            <td className="sticky left-0 z-10 bg-inherit border-b border-border px-3 py-1.5 min-w-[160px]">
                              <div>
                                <span className="font-medium text-foreground">{emp.name}</span>
                                <span className="ml-1.5 text-muted-foreground">({emp.emp_code})</span>
                              </div>
                            </td>
                            <td className="sticky left-[160px] z-10 bg-inherit border-b border-border px-2 py-1.5 text-muted-foreground min-w-[90px] truncate max-w-[90px]">
                              {emp.dept}
                            </td>
                            {dayNums.map(d => {
                              const rec = emp.days.get(d)
                              const s = rec ? (rec.is_late ? 'late' : rec.status) : ''
                              if (s === 'present') pCount++
                              else if (s === 'absent') aCount++
                              else if (s === 'late') { pCount++; lCount++ }
                              return (
                                <td key={d} className={`border-b border-border text-center py-1 w-8 ${cellCls(rec)}`}
                                  title={rec ? `${d} ${monthLabel}: ${s}${rec.first_in ? ` · In ${formatTime(rec.first_in)}` : ''}${rec.late_by_minutes > 0 ? ` · Late ${rec.late_by_minutes}m` : ''}` : `${d} ${monthLabel}: no record`}>
                                  {cellLabel(rec)}
                                </td>
                              )
                            })}
                            <td className="border-b border-border px-2 py-1.5 text-center font-bold text-kpi-green">{pCount}</td>
                            <td className="border-b border-border px-2 py-1.5 text-center font-bold text-kpi-red">{aCount}</td>
                            <td className="border-b border-border px-2 py-1.5 text-center font-bold text-kpi-amber">{lCount}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="flex items-center gap-4 px-4 py-3 text-[11px] text-muted-foreground border-t border-border flex-wrap">
                    {[
                      { label: 'P = Present', cls: 'bg-kpi-green/20 text-kpi-green' },
                      { label: 'L = Late',    cls: 'bg-kpi-amber/20 text-kpi-amber' },
                      { label: 'A = Absent',  cls: 'bg-kpi-red/20 text-kpi-red' },
                      { label: 'H = Holiday', cls: 'bg-muted text-muted-foreground' },
                      { label: '½ = Half Day',cls: 'bg-kpi-amber/10 text-kpi-amber' },
                      { label: '– = Off',     cls: 'bg-muted/50 text-muted-foreground/50' },
                    ].map(l => (
                      <span key={l.label} className={`px-2 py-0.5 rounded font-medium ${l.cls}`}>{l.label}</span>
                    ))}
                  </div>
                </div>
              )
            })()}

          </CardContent>
        </Card>

        {/* Heatmap */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Attendance Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 text-[10px] text-muted-foreground mb-2">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                <span key={d} className="w-8 text-center">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} className="w-8 h-8" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                const status = heatmap[day] || 'absent'
                const color = heatmapColors[status] || 'bg-muted'
                return (
                  <div
                    key={day}
                    className={`w-8 h-8 rounded-sm ${color} flex items-center justify-center text-[10px] font-medium text-primary-foreground`}
                    title={`${day} ${monthLabel} — ${status}`}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-4">
              {Object.entries(heatmapColors).map(([label, cls]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${cls}`} />
                  <span className="text-[11px] text-muted-foreground capitalize">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Import Modal ── */}
      <Dialog open={importModal} onOpenChange={open => {
        setImportModal(open)
        if (!open) { setImportResult(null); setMonthlyResult(null); setEmailsSent(false) }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Attendance Data</DialogTitle>
            <DialogDescription>Upload monthly attendance from your biometric system</DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium shrink-0">
            <button
              className={`flex-1 py-2 px-2 transition-colors ${importTab === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              onClick={() => { setImportTab('monthly'); setImportResult(null); setMonthlyResult(null); setEmailsSent(false) }}
            >
              <Upload className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
              Monthly Details CSV
            </button>
            <button
              className={`flex-1 py-2 px-2 transition-colors ${importTab === 'smartoffice' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              onClick={() => { setImportTab('smartoffice'); setImportResult(null); setMonthlyResult(null) }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
              Smart Office XLSX
            </button>
            <button
              className={`flex-1 py-2 px-2 transition-colors ${importTab === 'essl' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              onClick={() => { setImportTab('essl'); setImportResult(null); setMonthlyResult(null) }}
            >
              ESSL CSV
            </button>
            <button
              className={`flex-1 py-2 px-2 transition-colors ${importTab === 'biometric' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              onClick={() => { setImportTab('biometric'); setImportResult(null); setMonthlyResult(null); setBioPullResult(null) }}
            >
              <Wifi className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
              Live API Pull
            </button>
          </div>

          <div className="overflow-y-auto flex-1 space-y-4 pr-1">

          {/* ── Monthly Details CSV tab ── */}
          {importTab === 'monthly' && !monthlyResult && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-xs space-y-1.5">
                <p className="font-semibold text-blue-900 dark:text-blue-300">Monthly Detailed Attendance Report</p>
                <p className="text-blue-800 dark:text-blue-300">Accepts the CSV exported from your biometric software with the heading <span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">Monthly Detailed Attendance Report(Default)</span></p>
                <p className="text-blue-700 dark:text-blue-400 mt-1">• The date range is read from row 3 (e.g. <span className="font-mono">21-Apr-2026 to 20-May-2026</span>)</p>
                <p className="text-blue-700 dark:text-blue-400">• Each employee's P/A status, in-time, out-time, overtime and late-by are imported</p>
                <p className="text-blue-700 dark:text-blue-400">• New employees are auto-created and will appear in the Employees list</p>
                <p className="text-blue-700 dark:text-blue-400">• You can send welcome emails to all imported employees after upload</p>
              </div>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => monthlyRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleMonthlyDetailsImport(f) }}
              >
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold">Click or drag CSV file here</p>
                <p className="text-xs text-muted-foreground mt-1">Monthly Details CSV from SmartOffice / ESSL biometric system</p>
                <input
                  ref={monthlyRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleMonthlyDetailsImport(f); e.target.value = '' }}
                />
              </div>
            </div>
          )}

          {/* ── Monthly Details result panel ── */}
          {importTab === 'monthly' && monthlyResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-green-800 dark:text-green-300 text-sm">Import Successful</span>
                </div>
                <p className="text-xs text-green-700 dark:text-green-400">Period: <strong>{monthlyResult.date_range}</strong></p>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-card rounded p-2 text-center border border-green-100 dark:border-green-900">
                    <p className="text-lg font-bold text-foreground">{monthlyResult.employees_total}</p>
                    <p className="text-[10px] text-muted-foreground">Employees</p>
                  </div>
                  <div className="bg-card rounded p-2 text-center border border-green-100 dark:border-green-900">
                    <p className="text-lg font-bold text-blue-600">{monthlyResult.employees_created}</p>
                    <p className="text-[10px] text-muted-foreground">Auto-created</p>
                  </div>
                  <div className="bg-card rounded p-2 text-center border border-green-100 dark:border-green-900">
                    <p className="text-lg font-bold text-foreground">{monthlyResult.records_saved}</p>
                    <p className="text-[10px] text-muted-foreground">Records saved</p>
                  </div>
                </div>
              </div>

              {/* Employee list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Imported Employees</p>
                  {!emailsSent ? (
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={sendingEmails}
                      onClick={handleSendWelcomeEmails}
                    >
                      {sendingEmails
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending…</>
                        : <><Mail className="h-3 w-3" /> Send Welcome Emails</>}
                    </Button>
                  ) : (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Emails sent
                    </span>
                  )}
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Code</th>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-center px-2 py-2 font-medium">P</th>
                        <th className="text-center px-2 py-2 font-medium">A</th>
                        <th className="text-center px-2 py-2 font-medium">Late</th>
                        <th className="text-right px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyResult.employees.map((emp, idx) => (
                        <tr key={emp.employee_id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                          <td className="px-3 py-1.5 font-mono">{emp.emp_code}</td>
                          <td className="px-3 py-1.5">
                            <span>{emp.name}</span>
                            {emp.is_new && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded px-1 py-0.5 text-[10px] font-medium">
                                <UserPlus className="h-2.5 w-2.5" /> New
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center text-green-700 dark:text-green-400 font-medium">{emp.present}</td>
                          <td className="px-2 py-1.5 text-center text-red-600 dark:text-red-400 font-medium">{emp.absent}</td>
                          <td className="px-2 py-1.5 text-center text-amber-600 dark:text-amber-400 font-medium">{emp.late}</td>
                          <td className="px-3 py-1.5 text-right">
                            {emp.email
                              ? <span className="text-green-600 dark:text-green-400">✓ Has email</span>
                              : <span className="text-muted-foreground">No email</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {monthlyResult.employees.some(e => !e.email) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚠ Employees with no email won't receive welcome emails. Go to <strong>Employees</strong> to add their email addresses.
                  </p>
                )}
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={() => { setMonthlyResult(null); setEmailsSent(false) }}>
                ← Import Another File
              </Button>
            </div>
          )}

          {/* ── Smart Office XLSX tab ── */}
          {importTab === 'smartoffice' && (
            <div className="space-y-4">
              <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Supported Smart Office formats:</p>
                <p>• <strong>Monthly Basic</strong> — Daily P/A summary per employee</p>
                <p>• <strong>Monthly Details</strong> — In/Out times, OT, late by per day</p>
                <p>• <strong>Daily Basic</strong> — Single-day snapshot with times</p>
                <p className="mt-2 text-foreground/70">Format is auto-detected from the file name.</p>
              </div>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => xlsxRef.current?.click()}
              >
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Click to upload XLSX / XLS</p>
                <p className="text-xs text-muted-foreground mt-1">Smart Office exported reports</p>
                <input
                  ref={xlsxRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleSmartOfficeImport(f) }}
                />
              </div>
            </div>
          )}

          {/* ── ESSL CSV tab ── */}
          {importTab === 'essl' && (
            <div className="space-y-4">
              <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Expected CSV format:</p>
                <p>emp_code, date, time, direction</p>
                <p className="font-mono">EMP0001,2026-05-01,09:02:00,I</p>
                <p className="font-mono">EMP0001,2026-05-01,18:30:00,O</p>
                <p className="mt-2">Direction: I = Check In, O = Check Out</p>
              </div>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => csvRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Click to upload CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Only .csv files accepted</p>
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleEsslImport(f) }}
                />
              </div>
            </div>
          )}

          {/* ── Biometric API Pull tab ── */}
          {importTab === 'biometric' && (
            <div className="space-y-5">
              {/* API Config */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">API Configuration</p>
                  <button
                    onClick={handleSaveBioSettings}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {bioSettingsSaved ? '✓ Saved' : 'Save for future use'}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">API Endpoint URL</Label>
                    <Input
                      value={bioApiUrl}
                      onChange={e => setBioApiUrl(e.target.value)}
                      placeholder="https://sohcm.com/SmartApp_ess/api/SwipeDetails/GetDeviceLogs"
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">API Key</Label>
                      <Input
                        value={bioApiKey}
                        onChange={e => setBioApiKey(e.target.value)}
                        placeholder="200111012629"
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Account Name <span className="text-muted-foreground">(optional)</span></Label>
                      <Input
                        value={bioAccountName}
                        onChange={e => setBioAccountName(e.target.value)}
                        placeholder="Dynavac"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Range</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">From Date</Label>
                    <Input type="date" value={bioFromDate} onChange={e => setBioFromDate(e.target.value)} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To Date</Label>
                    <Input type="date" value={bioToDate} onChange={e => setBioToDate(e.target.value)} className="text-sm" />
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-xs space-y-1">
                <p className="font-semibold text-blue-900 dark:text-blue-300">How it works</p>
                <p className="text-blue-800 dark:text-blue-300">• Pulls swipe logs from your biometric device API in real-time</p>
                <p className="text-blue-800 dark:text-blue-300">• First swipe of the day = Check-In, last swipe = Check-Out</p>
                <p className="text-blue-800 dark:text-blue-300">• Matches <strong>UserId</strong> from device to <strong>Employee Code</strong> in HRMS</p>
                <p className="text-blue-800 dark:text-blue-300">• Unmatched User IDs are listed below so you can fix the mapping</p>
              </div>

              <Button
                className="w-full"
                onClick={handleBiometricPull}
                disabled={bioPulling || !bioApiUrl || !bioApiKey || !bioFromDate || !bioToDate}
              >
                {bioPulling
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pulling data…</>
                  : <><Wifi className="h-4 w-4 mr-2" /> Pull Attendance from Biometric API</>
                }
              </Button>

              {/* Pull Result */}
              {bioPullResult && (
                <div className={`border rounded-lg p-4 space-y-3 ${bioPullResult.processed > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
                  <p className={`font-semibold text-sm ${bioPullResult.processed > 0 ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {bioPullResult.processed > 0 ? '✓ Sync Complete' : '⚠ Sync Complete — No Records Matched'}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-card rounded p-2 border">
                      <p className="text-lg font-bold">{bioPullResult.fetched}</p>
                      <p className="text-xs text-muted-foreground">Raw Swipes</p>
                    </div>
                    <div className="bg-card rounded p-2 border">
                      <p className="text-lg font-bold text-green-600">{bioPullResult.processed}</p>
                      <p className="text-xs text-muted-foreground">Records Saved</p>
                    </div>
                    <div className="bg-card rounded p-2 border">
                      <p className="text-lg font-bold text-amber-600">{bioPullResult.skipped}</p>
                      <p className="text-xs text-muted-foreground">Skipped</p>
                    </div>
                  </div>
                  {bioPullResult.unmatched.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        Unmatched UserIds — set matching Employee Code in each employee's profile:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {bioPullResult.unmatched.map(uid => (
                          <span key={uid} className="font-mono text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                            {uid}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {bioPullResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-destructive">Other errors:</p>
                      {bioPullResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-destructive">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {importing && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted rounded-md p-3">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>Processing attendance records… this may take a moment for large files.</span>
            </div>
          )}

          {importResult && importTab !== 'monthly' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 space-y-1">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Import Complete</p>
              {importResult.format && (
                <p className="text-xs text-muted-foreground">Format: {importResult.format}</p>
              )}
              <p className="text-xs text-muted-foreground">✓ {importResult.processed} records saved</p>
              {importResult.skipped > 0 && (
                <p className="text-xs text-muted-foreground">⚠ {importResult.skipped} skipped</p>
              )}
              {importResult.errors?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-destructive">Errors:</p>
                  {importResult.errors.map((e: string, i: number) => (
                    <p key={i} className="text-xs text-destructive">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button variant="outline" onClick={() => { setImportModal(false); setImportResult(null); setMonthlyResult(null); setEmailsSent(false) }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Correction / Add Modal ── */}
      <Dialog open={!!correctionRecord} onOpenChange={open => !open && setCorrectionRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {correctionRecord?.id.startsWith('absent-') ? 'Add Attendance Record' : 'Correct Attendance'}
            </DialogTitle>
            <DialogDescription>
              {correctionRecord && (
                <>
                  {correctionRecord.id.startsWith('absent-') ? 'Creating record for ' : 'Correcting record for '}
                  <strong>{correctionRecord.employee.first_name} {correctionRecord.employee.last_name}</strong>
                  {' '}on {new Date(correctionRecord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={corrStatus} onValueChange={setCorrStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="wfh">Work From Home</SelectItem>
                  <SelectItem value="leave">On Leave</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First In (HH:MM)</Label>
                <Input type="time" value={corrFirstIn} onChange={e => setCorrFirstIn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Out (HH:MM)</Label>
                <Input type="time" value={corrLastOut} onChange={e => setCorrLastOut(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Textarea
                value={corrReason}
                onChange={e => setCorrReason(e.target.value)}
                placeholder={correctionRecord?.id.startsWith('absent-')
                  ? 'e.g. On-site visit, no device punch...'
                  : 'e.g. Forgot to punch in, device error...'}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionRecord(null)}>Cancel</Button>
            <Button onClick={submitCorrection} disabled={correcting}>
              {correcting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                : correctionRecord?.id.startsWith('absent-') ? 'Add Record' : 'Save Correction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default Attendance
