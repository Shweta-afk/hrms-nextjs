'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  ChevronDown, ChevronUp, Filter, Building2, User,
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

// Cell colour for a single-letter status code in the wide-format range
// grid. Coloured cells let HR scan absences/lates at a glance across a
// 30+ column date strip without reading each value. Leave-type codes
// (SL, CL, EL, ML, etc.) all collapse into the same neutral colour so
// HR can read off the actual code without it being lost in heavy tinting.
function codeColor(code: string): string {
  switch (code) {
    case 'P':   return 'bg-emerald-50/60 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-400'
    case 'L':   return 'bg-amber-50/60 dark:bg-amber-900/15 text-amber-700 dark:text-amber-400 font-semibold'
    case 'HD':  return 'bg-blue-50/60 dark:bg-blue-900/15 text-blue-700 dark:text-blue-400'
    case 'A':   return 'bg-red-50/60 dark:bg-red-900/15 text-red-600 dark:text-red-400 font-semibold'
    case 'WFH': return 'bg-violet-50/60 dark:bg-violet-900/15 text-violet-700 dark:text-violet-400'
    case 'H':   return 'bg-orange-50/60 dark:bg-orange-900/15 text-orange-700 dark:text-orange-400'
    case 'WO':  return 'bg-muted/40 text-muted-foreground'
    case 'PR':  return 'bg-yellow-50/60 dark:bg-yellow-900/15 text-yellow-700 dark:text-yellow-400'
    default:    return 'bg-zinc-50/60 dark:bg-zinc-900/15 text-zinc-700 dark:text-zinc-300' // leave-type codes
  }
}

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

type ReportType =
  | 'basic' | 'detailed' | 'summary' | 'work_duration' | 'total_duration'
  | 'period_wise' | 'ot1_ot2' | 'form_j' | 'muster_roll' | 'monthly_matrix'
  | 'period_wise_detailed' | 'ot_summary'

export default function AttendanceReports() {
  const today = new Date()
  const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1
  const prevYear  = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()

  // ── Unified date range (shared across all reports) ─────────────────────
  const [fromDate, setFromDate] = useState(format(new Date(prevYear, prevMonth, 21), 'yyyy-MM-dd'))
  const [toDate,   setToDate]   = useState(format(new Date(today.getFullYear(), today.getMonth(), 20), 'yyyy-MM-dd'))
  const [groupBy,  setGroupBy]  = useState('employee')
  const [sortBy,   setSortBy]   = useState('emp_code')
  const [recalculate, setRecalculate] = useState(true)

  // ── Employee filters ───────────────────────────────────────────────────
  const [filtersOpen,  setFiltersOpen]  = useState(true)
  const [deptOpen,     setDeptOpen]     = useState(false)
  const [empCode,      setEmpCode]      = useState('')
  const [empName,      setEmpName]      = useState('')
  const [exactMatch,   setExactMatch]   = useState(false)
  const [filterDept,   setFilterDept]   = useState('all')
  const [filterDesig,  setFilterDesig]  = useState('all')
  const [filterEmpType,setFilterEmpType]= useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // ── Departments / designations for filter dropdowns ────────────────────
  const [departments,  setDepartments]  = useState<{id:string;name:string}[]>([])
  const [designations, setDesignations] = useState<{id:string;name:string}[]>([])

  // ── Active report + results ────────────────────────────────────────────
  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const [loading,      setLoading]      = useState(false)

  // results for each report type
  const [dailyRows,    setDailyRows]    = useState<DailyRow[]>([])
  const [rangeGrid,    setRangeGrid]    = useState<{
    fixed_left_headers: string[]
    date_headers:       string[]
    summary_headers:    string[]
    rows:               (string | number)[][]
    employees:          number
    days:               number
  } | null>(null)
  const [monthlyRows,    setMonthlyRows]    = useState<MonthlyRow[]>([])
  const [monthlyColumns, setMonthlyColumns] = useState<string[]>([])
  const [detailData, setDetailData] = useState<{
    date_headers: string[]
    employees: {
      emp_code: string
      name: string
      department: string
      summary: {
        total_present: number; total_absent: number; total_leave: number
        total_wo: number; total_ho: number; total_duration: string
        total_late_by: string; total_early_by: string; total_ot: string
      }
      days: {
        shift: string; in_time: string; out_time: string
        late_by: string; early_by: string; total_ot: string
        t_duration: string; status: string
      }[]
    }[]
  } | null>(null)

  // ── Device panel ───────────────────────────────────────────────────────
  const [devices,           setDevices]           = useState<Device[]>([])
  const [devicesLoading,    setDevicesLoading]    = useState(false)
  const [peoplePanelDevice, setPeoplePanelDevice] = useState<Device | null>(null)
  const [devicePeople,      setDevicePeople]      = useState<DeviceEmployee[]>([])
  const [devicePeopleLoading, setDevicePeopleLoading] = useState(false)

  // ── Filter param builder ───────────────────────────────────────────────
  function filterParams() {
    const p = new URLSearchParams()
    if (empCode)                    p.set('emp_code',    empCode)
    if (empName)                    p.set('emp_name',    empName)
    if (exactMatch)                 p.set('exact',       '1')
    if (filterDept   !== 'all')     p.set('dept_id',     filterDept)
    if (filterDesig  !== 'all')     p.set('desig_id',    filterDesig)
    if (filterEmpType !== 'all')    p.set('emp_type',    filterEmpType)
    if (filterStatus !== 'all')     p.set('status',      filterStatus)
    return p.toString() ? `&${p.toString()}` : ''
  }

  // ── Generic Excel downloader ───────────────────────────────────────────
  async function downloadExcel(url: string, filename: string) {
    const res = await fetch(url)
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      toast.error(txt.includes('too large') || txt.includes('Date range') ? 'Date range too large for this report' : 'Download failed')
      return
    }
    const blob = await res.blob()
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ── Generate / download a report ──────────────────────────────────────
  async function generate(type: ReportType, download = false) {
    if (fromDate > toDate) { toast.error('"From" must be on or before "To"'); return }
    const fp = filterParams()
    const month = new Date(fromDate).getMonth() + 1
    const year  = new Date(fromDate).getFullYear()

    if (download) {
      setLoading(true)
      try {
        switch (type) {
          case 'basic':
            await downloadExcel(`/api/reports/attendance/daily?date=${fromDate}&format=excel${fp}`, `attendance_basic_${fromDate}.xlsx`)
            break
          case 'detailed':
          case 'period_wise_detailed':
            await downloadExcel(`/api/reports/attendance/detail?from=${fromDate}&to=${toDate}&format=excel${fp}`, `attendance_detail_${fromDate}_to_${toDate}.xlsx`)
            break
          case 'period_wise':
          case 'work_duration':
          case 'total_duration':
            await downloadExcel(`/api/reports/attendance/range?from=${fromDate}&to=${toDate}&format=excel${fp}`, `attendance_range_${fromDate}_to_${toDate}.xlsx`)
            break
          case 'summary':
          case 'monthly_matrix':
            await downloadExcel(`/api/reports/attendance/monthly?month=${month}&year=${year}&format=excel${fp}`, `attendance_monthly_${MONTHS[month-1]}_${year}.xlsx`)
            break
          default:
            toast.info('This report type download is coming soon')
        }
      } finally {
        setLoading(false)
      }
      return
    }

    // Preview
    setActiveReport(type)
    setLoading(true)
    setDailyRows([]); setRangeGrid(null); setMonthlyRows([]); setDetailData(null)
    try {
      switch (type) {
        case 'basic': {
          const res  = await fetch(`/api/reports/attendance/daily?date=${fromDate}&format=json${fp}`)
          const json = await res.json()
          if (json.success) setDailyRows(json.data)
          else toast.error(json.error ?? 'Failed')
          break
        }
        case 'detailed':
        case 'period_wise_detailed': {
          const res  = await fetch(`/api/reports/attendance/detail?from=${fromDate}&to=${toDate}&format=json${fp}`)
          const json = await res.json()
          if (json.success) setDetailData(json.data)
          else toast.error(json.error ?? 'Failed')
          break
        }
        case 'period_wise':
        case 'work_duration':
        case 'total_duration': {
          const res  = await fetch(`/api/reports/attendance/range?from=${fromDate}&to=${toDate}&format=json${fp}`)
          const json = await res.json()
          if (json.success) setRangeGrid(json.data)
          else toast.error(json.error ?? 'Failed')
          break
        }
        case 'summary':
        case 'monthly_matrix': {
          const res  = await fetch(`/api/reports/attendance/monthly?month=${month}&year=${year}&format=json${fp}`)
          const json = await res.json()
          if (json.success) {
            setMonthlyRows(json.data)
            if (json.data.length > 0) setMonthlyColumns(Object.keys(json.data[0]))
          } else toast.error(json.error ?? 'Failed')
          break
        }
        default:
          toast.info('Preview for this report type is coming soon')
          setActiveReport(null)
      }
    } catch {
      toast.error('Failed to load report')
      setActiveReport(null)
    } finally {
      setLoading(false)
    }
  }

  // ── Fetch departments / designations ───────────────────────────────────
  const fetchFilters = useCallback(async () => {
    try {
      const [d, g] = await Promise.all([
        fetch('/api/departments').then(r => r.json()),
        fetch('/api/designations').then(r => r.json()),
      ])
      if (d.success) setDepartments(d.data ?? [])
      if (g.success) setDesignations(g.data ?? [])
    } catch { /* silent */ }
  }, [])

  // ── Device helpers ─────────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true)
    try {
      const res  = await fetch('/api/devices')
      const json = await res.json()
      if (json.success) setDevices(json.data ?? [])
    } catch { toast.error('Failed to load devices') }
    finally  { setDevicesLoading(false) }
  }, [])

  async function openDevicePeople(device: Device) {
    setPeoplePanelDevice(device); setDevicePeople([]); setDevicePeopleLoading(true)
    try {
      const res  = await fetch(`/api/devices/${device.id}/employees`)
      const json = await res.json()
      if (json.success) setDevicePeople(json.data.employees)
      else toast.error(json.error ?? 'Failed')
    } catch { toast.error('Failed to load device users') }
    finally  { setDevicePeopleLoading(false) }
  }

  useEffect(() => { fetchFilters() }, [fetchFilters])
  useEffect(() => { fetchDevices() }, [fetchDevices])

  // ── Report buttons config ──────────────────────────────────────────────
  const reportButtons: { type: ReportType; label: string }[] = [
    { type: 'basic',              label: 'Basic Report' },
    { type: 'detailed',           label: 'Detailed Report' },
    { type: 'summary',            label: 'Summary Report' },
    { type: 'work_duration',      label: 'Work Duration' },
    { type: 'total_duration',     label: 'Total Duration' },
    { type: 'period_wise',        label: 'Period Wise' },
    { type: 'ot1_ot2',           label: 'OT1 OT2 Summary' },
    { type: 'form_j',             label: 'Form J' },
    { type: 'muster_roll',        label: 'Muster Roll' },
    { type: 'monthly_matrix',     label: 'Monthly Matrix' },
  ]
  const secondRowButtons: { type: ReportType; label: string }[] = [
    { type: 'period_wise_detailed', label: 'Period Wise Detailed' },
    { type: 'ot_summary',           label: 'OT Summary' },
  ]

  const hasResults = dailyRows.length > 0 || !!rangeGrid || monthlyRows.length > 0 || !!detailData

  return (
    <AppLayout title="Attendance Reports">
      <div className="p-4 space-y-4 max-w-full">
        {/* Page header */}
        {/* ── Report Generator Panel ── */}
        {/* ── Generate report panel ── */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-0 pt-4 px-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Generate Monthly Attendance Report</p>
          </CardHeader>
          <CardContent className="px-5 pt-3 pb-5 space-y-4">

            {/* Row 1: date range + group/sort */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">From Date</Label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">To Date</Label>
                <input type="date" value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)}
                  className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Group By</Label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee Wise</SelectItem>
                    <SelectItem value="department">Department Wise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emp_code">Employee Code</SelectItem>
                    <SelectItem value="emp_name">Employee Name</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Employee Filters accordion */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-primary" />
                  Employee Filters
                </span>
                {filtersOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {filtersOpen && (
                <div className="px-4 py-4 space-y-3 bg-background">
                  {/* Row: emp code + name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Employee Code</Label>
                      <Input placeholder="Search employee code..." value={empCode} onChange={e => setEmpCode(e.target.value)} className="h-8 text-sm" />
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer mt-1">
                        <Checkbox checked={exactMatch} onCheckedChange={v => setExactMatch(!!v)} className="h-3.5 w-3.5" />
                        Exact match
                      </label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Employee Name</Label>
                      <Input placeholder="Search employee name..." value={empName} onChange={e => setEmpName(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  {/* Row: category / designation / location / grade / emp-type / team / status / shift */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Department</Label>
                      <Select value={filterDept} onValueChange={setFilterDept}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {departments.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Designation</Label>
                      <Select value={filterDesig} onValueChange={setFilterDesig}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {designations.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Employment Type</Label>
                      <Select value={filterEmpType} onValueChange={setFilterEmpType}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="full_time">Full Time</SelectItem>
                          <SelectItem value="part_time">Part Time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="intern">Intern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Status..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filter Company & Department accordion */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setDeptOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-primary" />
                  Filter Company &amp; Department
                </span>
                {deptOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {deptOpen && (
                <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-background">
                  {departments.map(d => (
                    <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filterDept === d.id}
                        onCheckedChange={v => setFilterDept(v ? d.id : 'all')}
                        className="h-3.5 w-3.5"
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Report type buttons */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap gap-2">
                {reportButtons.map(({ type, label }) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={activeReport === type ? 'default' : 'outline'}
                    className={cn(
                      'text-xs gap-1.5 h-8',
                      activeReport === type && 'ring-2 ring-primary/40'
                    )}
                    disabled={loading}
                    onClick={() => generate(type)}
                  >
                    {loading && activeReport === type
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Eye className="h-3 w-3" />}
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={recalculate} onCheckedChange={v => setRecalculate(!!v)} className="h-3.5 w-3.5" />
                  Recalculate Attendance
                </label>
                {secondRowButtons.map(({ type, label }) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={activeReport === type ? 'default' : 'outline'}
                    className={cn('text-xs gap-1.5 h-8', activeReport === type && 'ring-2 ring-primary/40')}
                    disabled={loading}
                    onClick={() => generate(type)}
                  >
                    {loading && activeReport === type
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Eye className="h-3 w-3" />}
                    {label}
                  </Button>
                ))}
                <span className="text-xs text-muted-foreground ml-1">Select filters and click to generate</span>
                {activeReport && hasResults && (
                  <Button size="sm" className="gap-1.5 text-xs h-8 ml-auto" onClick={() => generate(activeReport!, true)} disabled={loading}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    Download Excel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Results panel ── */}
        {loading && !hasResults && (
          <div className="flex justify-center py-12 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-5 w-5 animate-spin" /> Generating report…
          </div>
        )}

        {/* Basic Report (daily) */}
        {activeReport === 'basic' && dailyRows.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Basic Report — {fromDate}</CardTitle>
                <Badge variant="outline" className="text-[10px]">{dailyRows.length} employees</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
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
            </CardContent>
          </Card>
        )}

        {/* Detailed / Period Wise Detailed — Smart Office per-employee block format */}
        {(activeReport === 'detailed' || activeReport === 'period_wise_detailed') && detailData && (
          <div className="space-y-0">
            {/* header bar */}
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-sm font-semibold">
                {activeReport === 'detailed' ? 'Detailed Report' : 'Period Wise Detailed'} — {fromDate} to {toDate}
              </p>
              <Badge variant="outline" className="text-[10px]">{detailData.employees.length} employees</Badge>
            </div>

            {detailData.employees.map((emp) => {
              const s   = emp.summary
              const ROW_LABELS = ['Shift', 'In Time', 'Out Time', 'Late By', 'Early By', 'Total OT', 'T Duration', 'Status']
              const ROW_KEYS   = ['shift', 'in_time', 'out_time', 'late_by', 'early_by', 'total_ot', 't_duration', 'status'] as const

              function statusColor(st: string) {
                if (st === 'P')  return 'text-emerald-600 font-bold'
                if (st === 'A')  return 'text-red-500 font-bold'
                if (st === 'HD') return 'text-blue-600 font-bold'
                if (st === 'H')  return 'text-orange-500 font-bold'
                if (st === 'W' || st === 'WO') return 'text-muted-foreground'
                if (st === 'L')  return 'text-amber-600 font-bold'
                return ''
              }

              return (
                <div key={emp.emp_code} className="border border-border rounded-lg mb-3 overflow-hidden">
                  {/* Employee header */}
                  <div className="flex items-center justify-between bg-muted/60 px-4 py-2 border-b border-border">
                    <span className="text-xs font-semibold">
                      EmployeeCode&nbsp;&nbsp;<span className="font-bold text-foreground">{emp.emp_code}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{emp.department}</span>
                    <span className="text-xs font-semibold">
                      EmployeeName&nbsp;&nbsp;<span className="font-bold text-foreground">{emp.name}</span>
                    </span>
                  </div>

                  {/* Summary line */}
                  <div className="px-3 py-1.5 bg-muted/30 border-b border-border text-[10px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>Total Present <b className="text-emerald-600">{s.total_present}</b></span>
                    <span>Total Absent <b className="text-red-500">{s.total_absent}</b></span>
                    <span>Leave Taken <b>{s.total_leave}</b></span>
                    <span>WO <b>{s.total_wo}</b></span>
                    <span>HO <b>{s.total_ho}</b></span>
                    <span>Duration <b>{s.total_duration}</b></span>
                    <span>Late By <b className="text-amber-600">{s.total_late_by}</b> hrs</span>
                    <span>Early By <b>{s.total_early_by}</b> hrs</span>
                    <span>OT <b>{s.total_ot}</b></span>
                  </div>

                  {/* Horizontal grid */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-muted/50">
                          {/* row-label col */}
                          <th className="sticky left-0 z-10 bg-muted/50 text-left px-3 py-1.5 font-semibold border-r border-border whitespace-nowrap min-w-[90px]">
                            &nbsp;
                          </th>
                          {detailData.date_headers.map((dh) => (
                            <th key={dh} className="px-2 py-1.5 text-center font-semibold border-r border-border whitespace-nowrap min-w-[72px]">
                              {dh}
                            </th>
                          ))}
                          <th className="px-3 py-1.5 text-center font-semibold border-r border-border whitespace-nowrap bg-muted/70">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ROW_LABELS.map((label, ri) => {
                          const key = ROW_KEYS[ri]
                          const isStatus    = key === 'status'
                          const isInOut     = key === 'in_time' || key === 'out_time'
                          const isLate      = key === 'late_by'
                          const isEarly     = key === 'early_by'

                          // total column value per row
                          const totals: Record<typeof ROW_KEYS[number], string> = {
                            shift:      '',
                            in_time:    '',
                            out_time:   '',
                            late_by:    s.total_late_by,
                            early_by:   s.total_early_by,
                            total_ot:   s.total_ot,
                            t_duration: s.total_duration,
                            status:     `${s.total_present}P / ${s.total_absent}A`,
                          }

                          return (
                            <tr key={label} className="border-t border-border hover:bg-muted/10">
                              <td className="sticky left-0 z-10 bg-card px-3 py-1 font-medium text-muted-foreground border-r border-border whitespace-nowrap">
                                {label}
                              </td>
                              {emp.days.map((d, di) => {
                                const val = d[key]
                                const isEmpty = val === '00:00' || val === '00:00:00' || val === 'FS'
                                return (
                                  <td
                                    key={di}
                                    className={cn(
                                      'px-1 py-1 text-center border-r border-border font-mono',
                                      isStatus && statusColor(val),
                                      isLate   && val !== '00:00' && 'text-amber-600',
                                      isEarly  && val !== '00:00' && 'text-sky-600',
                                      isEmpty  && !isStatus && 'text-muted-foreground/40',
                                    )}
                                  >
                                    {val}
                                  </td>
                                )
                              })}
                              <td className="px-2 py-1 text-center border-r border-border font-mono bg-muted/20 font-semibold">
                                {totals[key]}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Period Wise / Work Duration / Total Duration (range grid) */}
        {(activeReport === 'period_wise' || activeReport === 'work_duration' || activeReport === 'total_duration') && rangeGrid && rangeGrid.rows.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {activeReport === 'period_wise' ? 'Period Wise' : activeReport === 'work_duration' ? 'Work Duration' : 'Total Duration'} — {fromDate} to {toDate}
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">{rangeGrid.employees} employees × {rangeGrid.days} days</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-[10px] text-muted-foreground border-b">
                <span><b className="text-emerald-600">P</b> Present</span>
                <span><b className="text-amber-600">L</b> Late</span>
                <span><b className="text-blue-600">HD</b> Half Day</span>
                <span><b className="text-red-600">A</b> Absent</span>
                <span><b className="text-violet-600">WFH</b> WFH</span>
                <span><b className="text-orange-600">H</b> Holiday</span>
                <span><b className="text-muted-foreground">WO</b> Weekly Off</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40">
                      {rangeGrid.fixed_left_headers.map((h, i) => (
                        <th key={h} className={cn('text-[11px] font-semibold px-2 py-2 text-left border-b border-r border-border bg-card sticky z-10', i === 0 && 'left-0 w-10', i === 1 && 'left-10')} style={{ minWidth: i === 0 ? 40 : i === 1 ? 80 : 120 }}>{h}</th>
                      ))}
                      {rangeGrid.date_headers.map(d => (
                        <th key={d} className="text-[10px] font-semibold px-1 py-2 text-center border-b border-r border-border bg-card w-12 whitespace-nowrap">{d}</th>
                      ))}
                      {rangeGrid.summary_headers.map(s => (
                        <th key={s} className="text-[10px] font-semibold px-2 py-2 text-center border-b border-r border-border bg-muted/60 whitespace-nowrap">{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rangeGrid.rows.map((row, idx) => {
                      const leftCols = rangeGrid.fixed_left_headers.length
                      const dateCols = rangeGrid.date_headers.length
                      const sumStart = leftCols + dateCols
                      return (
                        <tr key={idx} className="hover:bg-muted/20">
                          {row.slice(0, leftCols).map((v, i) => (
                            <td key={i} className={cn('px-2 py-1.5 border-b border-r border-border bg-card sticky z-10', i === 0 && 'left-0 text-muted-foreground', i === 1 && 'left-10 font-mono text-[11px]', i === 2 && 'font-medium', i >= 3 && 'text-muted-foreground')}>{v}</td>
                          ))}
                          {row.slice(leftCols, sumStart).map((v, i) => (
                            <td key={`d-${i}`} className={cn('text-center px-1 py-1.5 border-b border-r border-border font-mono text-[11px]', codeColor(String(v)))}>{v}</td>
                          ))}
                          {row.slice(sumStart).map((v, i) => (
                            <td key={`s-${i}`} className="text-center px-2 py-1.5 border-b border-r border-border tabular-nums text-[11px] bg-muted/20">{v}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary / Monthly Matrix */}
        {(activeReport === 'summary' || activeReport === 'monthly_matrix') && monthlyRows.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {activeReport === 'summary' ? 'Summary Report' : 'Monthly Matrix'} — {MONTHS[new Date(fromDate).getMonth()]} {new Date(fromDate).getFullYear()}
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">{monthlyRows.length} employees</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      {monthlyColumns.map(col => (
                        <TableHead key={col} className="text-[11px] font-semibold whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRows.map(row => (
                      <TableRow key={row['Sl No']} className="text-xs hover:bg-muted/30">
                        {monthlyColumns.map(col => (
                          <TableCell key={col} className={cn('whitespace-nowrap', col === 'Absent Days' && Number(row[col]) > 0 ? 'text-red-600 font-medium' : '', col === 'Late Days' && Number(row[col]) > 0 ? 'text-amber-600 font-medium' : '', col === 'Attendance %' ? 'font-medium' : '')}>
                            {col === 'Employee Code' ? <span className="font-mono text-[11px]">{row[col]}</span> : row[col]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

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
