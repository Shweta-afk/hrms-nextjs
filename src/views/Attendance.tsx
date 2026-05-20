'use client'

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Download, Upload, Users, UserX, CalendarDays, Clock, Home, Wifi, Loader2, X } from "lucide-react";
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

interface Summary {
  present: number;
  absent: number;
  late: number;
}

const statusStyle: Record<string, string> = {
  present: "bg-kpi-green/15 text-kpi-green",
  absent: "bg-kpi-red/15 text-kpi-red",
  late: "bg-kpi-amber/15 text-kpi-amber",
  half_day: "bg-kpi-amber/25 text-kpi-amber",
  holiday: "bg-muted text-muted-foreground",
  weekend: "bg-muted text-muted-foreground",
}

const heatmapColors: Record<string, string> = {
  present: "bg-kpi-green",
  absent: "bg-kpi-red",
  late: "bg-kpi-amber",
  holiday: "bg-muted-foreground/30",
  weekend: "bg-muted-foreground/20",
}

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false
  })
}

const Attendance = () => {
  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<Summary>({ present: 0, absent: 0, late: 0 })
  const [loading, setLoading] = useState(true)
  const [importModal, setImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Correction modal state
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null)
  const [corrFirstIn, setCorrFirstIn] = useState('')
  const [corrLastOut, setCorrLastOut] = useState('')
  const [corrReason, setCorrReason] = useState('')
  const [correcting, setCorrecting] = useState(false)

  const current = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  //const monthLabel = current.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = current.getDay()
  const month = current.getMonth() + 1
  const year = current.getFullYear()
  const monthLabel = current.toLocaleDateString("en-IN", { month: "long", year: "numeric" })

  function handleDownloadReport() {
    if (records.length === 0) {
      toast.error('No attendance records to export')
      return
    }

    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Date',
      'Check In',
      'Check Out',
      'Total Hours',
      'Status',
      'Late',
      'Late By (mins)',
      'Source',
    ]

    const rows = records.map(r => [
      r.employee.emp_code,
      `${r.employee.first_name} ${r.employee.last_name}`,
      r.employee.department?.name ?? '',
      new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      r.first_in ? new Date(r.first_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      r.last_out ? new Date(r.last_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      r.total_hours ? parseFloat(r.total_hours).toFixed(2) : '',
      r.is_late ? 'Late' : r.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      r.is_late ? 'Yes' : 'No',
      r.late_by_minutes,
      r.source,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `attendance-report-${monthLabel.replace(' ', '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success(`Attendance report downloaded — ${records.length} records`)
  }

  function openCorrection(r: AttendanceRecord) {
    setCorrectionRecord(r)
    setCorrFirstIn(r.first_in ? formatTime(r.first_in) : '')
    setCorrLastOut(r.last_out ? formatTime(r.last_out) : '')
    setCorrReason('')
  }

  async function submitCorrection() {
    if (!correctionRecord) return
    if (!corrReason.trim()) { toast.error('Correction reason is required'); return }
    setCorrecting(true)
    try {
      const date = new Date(correctionRecord.date)
      const toDateTime = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number)
        const d = new Date(date)
        d.setHours(h, m, 0, 0)
        return d.toISOString()
      }
      const res = await fetch(`/api/attendance/${correctionRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_in: corrFirstIn ? toDateTime(corrFirstIn) : undefined,
          last_out: corrLastOut ? toDateTime(corrLastOut) : undefined,
          correction_reason: corrReason.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setRecords(prev => prev.map(r => r.id === correctionRecord.id ? { ...r, ...json.data, is_corrected: true } : r))
        toast.success('Attendance corrected successfully')
        setCorrectionRecord(null)
      } else {
        toast.error(json.error || 'Failed to correct attendance')
      }
    } catch {
      toast.error('Failed to correct attendance')
    } finally {
      setCorrecting(false)
    }
  }

  async function fetchAttendance() {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance?month=${month}&year=${year}&limit=100`)
      const json = await res.json()
      if (json.success) {
        setRecords(json.data.records)
        setSummary(json.data.summary)
      } else {
        toast.error('Failed to load attendance')
      }
    } catch {
      toast.error('Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAttendance() }, [monthOffset])

  // Build heatmap from records
  const heatmap: Record<number, string> = {}
  records.forEach(r => {
    const day = new Date(r.date).getDate()
    heatmap[day] = r.is_late ? 'late' : r.status
  })
  // Mark weekends
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow === 0 || dow === 6) heatmap[d] = heatmap[d] || 'weekend'
  }

  // Today's records
  const todayStr = new Date().toDateString()
  const todayRecords = records.filter(r => new Date(r.date).toDateString() === todayStr)
  const lateToday = records.filter(r =>
    new Date(r.date).toDateString() === todayStr && r.is_late
  )

  // ESSL CSV import
  async function handleImport(file: File) {
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/attendance/import', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        setImportResult(json.data)
        toast.success(json.data.message)
        fetchAttendance()
      } else {
        toast.error('Import failed')
      }
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
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
            <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
              {monthLabel}
            </span>
            <Button variant="outline" size="icon" onClick={() => setMonthOffset(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportModal(true)}>
              <Upload className="h-4 w-4 mr-2" /> Import ESSL Data
            </Button>
            <Button variant="outline" onClick={handleDownloadReport}>
              <Download className="h-4 w-4 mr-2" /> Download Report
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Present Today", value: summary.present, icon: Users, color: "text-kpi-green", bg: "bg-kpi-green/10" },
            { label: "Absent", value: summary.absent, icon: UserX, color: "text-kpi-red", bg: "bg-kpi-red/10" },
            { label: "On Leave", value: 0, icon: CalendarDays, color: "text-primary", bg: "bg-primary/10" },
            { label: "Late Arrivals", value: summary.late, icon: Clock, color: "text-kpi-amber", bg: "bg-kpi-amber/10" },
            { label: "Work from Home", value: 0, icon: Home, color: "text-kpi-purple", bg: "bg-kpi-purple/10" },
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
              <CardTitle className="text-base">
                {monthOffset === 0 ? "Today's Attendance" : `Attendance — ${monthLabel}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No attendance records for this period
                </div>
              ) : (
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
                    {records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
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
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => openCorrection(r)}
                            >
                              Correct
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Right panels */}
          <div className="lg:col-span-2 space-y-6">

            {/* Late Arrivals */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Late Arrivals Today ({lateToday.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lateToday.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No late arrivals today
                  </p>
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
                        <p className="text-xs text-muted-foreground">
                          Arrived {formatTime(r.first_in)}
                        </p>
                      </div>
                      <Badge variant="notice" className="text-[10px]">
                        {r.late_by_minutes} min late
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* ESSL Sync Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ESSL Sync Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sync Method</span>
                  <span className="text-sm font-medium">CSV Import</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div className="flex items-center gap-1.5">
                    <Wifi className="h-3.5 w-3.5 text-kpi-green" />
                    <Badge variant="active" className="text-[10px]">Ready</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Records this month</span>
                  <span className="text-sm font-medium">{records.length}</span>
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => setImportModal(true)}
                >
                  <Upload className="h-4 w-4 mr-2" /> Import CSV
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Heatmap */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Attendance Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 text-[10px] text-muted-foreground mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
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
                    className={`w-8 h-8 rounded-sm ${color} flex items-center justify-center text-[10px] font-medium text-primary-foreground cursor-default`}
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

      {/* ESSL Import Modal */}
      <Dialog open={importModal} onOpenChange={setImportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import ESSL Attendance Data</DialogTitle>
            <DialogDescription>
              Upload a CSV file exported from your ESSL device
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* CSV Format Guide */}
            <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Expected CSV format:</p>
              <p>emp_code, date, time, direction</p>
              <p className="font-mono">EMP0001,2026-05-01,09:02:00,I</p>
              <p className="font-mono">EMP0001,2026-05-01,18:30:00,O</p>
              <p className="mt-2">Direction: I = Check In, O = Check Out</p>
            </div>

            {/* File Upload Area */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Click to upload CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Only .csv files accepted</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImport(file)
                }}
              />
            </div>

            {/* Import Progress */}
            {importing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing attendance records...
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className="bg-kpi-green/10 border border-kpi-green/20 rounded-md p-3 space-y-1">
                <p className="text-sm font-medium text-kpi-green">Import Complete</p>
                <p className="text-xs text-muted-foreground">
                  ✓ {importResult.processed} records processed
                </p>
                {importResult.skipped > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ⚠ {importResult.skipped} records skipped
                  </p>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportModal(false)
              setImportResult(null)
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction Modal */}
      <Dialog open={!!correctionRecord} onOpenChange={open => !open && setCorrectionRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Correct Attendance</DialogTitle>
            <DialogDescription>
              {correctionRecord && (
                <>Correcting record for {correctionRecord.employee.first_name} {correctionRecord.employee.last_name} on {new Date(correctionRecord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First In (HH:MM)</Label>
                <Input
                  type="time"
                  value={corrFirstIn}
                  onChange={e => setCorrFirstIn(e.target.value)}
                  placeholder="09:00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Out (HH:MM)</Label>
                <Input
                  type="time"
                  value={corrLastOut}
                  onChange={e => setCorrLastOut(e.target.value)}
                  placeholder="18:00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Correction Reason *</Label>
              <Textarea
                value={corrReason}
                onChange={e => setCorrReason(e.target.value)}
                placeholder="e.g. Forgot to punch in, On-site visit, System error..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionRecord(null)}>Cancel</Button>
            <Button onClick={submitCorrection} disabled={correcting}>
              {correcting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Correction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default Attendance