'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface AttendanceRecord {
  id: string
  date: string
  first_in: string | null
  last_out: string | null
  total_hours: string | null
  status: string
  is_late: boolean
  late_by_minutes: number
  is_corrected: boolean
}

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const statusStyle: Record<string, string> = {
  present:        'bg-green-100 text-green-800',
  absent:         'bg-red-100 text-red-800',
  late:           'bg-yellow-100 text-yellow-800',
  half_day:       'bg-orange-100 text-orange-800',
  pending_review: 'bg-purple-100 text-purple-800',
  weekend:        'bg-muted text-muted-foreground',
  holiday:        'bg-blue-100 text-blue-800',
}

const statusLabel: Record<string, string> = {
  present: 'Present', absent: 'Absent', late: 'Late',
  half_day: 'Half Day', pending_review: 'Early Departure',
  weekend: 'Weekend', holiday: 'Holiday',
}

export default function PortalAttendancePage() {
  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [markingHalfDay, setMarkingHalfDay] = useState<string | null>(null)

  async function handleMarkHalfDay(attendanceId: string) {
    setMarkingHalfDay(attendanceId)
    try {
      const res = await fetch('/api/attendance/half-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_id: attendanceId }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Marked as half day — salary will be 50% for this day')
        setRecords(prev => prev.map(r => r.id === attendanceId ? { ...r, status: 'half_day' } : r))
      } else {
        toast.error(json.error ?? 'Failed to mark half day')
      }
    } catch {
      toast.error('Failed to mark half day')
    } finally {
      setMarkingHalfDay(null)
    }
  }

  const current = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const month = current.getMonth() + 1
  const year = current.getFullYear()
  const monthLabel = current.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(year, month, 0).getDate()

  async function fetchAttendance() {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance?month=${month}&year=${year}&limit=31`)
      const json = await res.json()
      if (json.success) setRecords(json.data.records)
    } catch {
      toast.error('Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAttendance() }, [monthOffset])

  const recordMap = Object.fromEntries(
    records.map(r => [new Date(r.date).getDate(), r])
  )

  const presentCount = records.filter(r => r.status === 'present').length
  const lateCount = records.filter(r => r.is_late).length
  const absentCount = records.filter(r => r.status === 'absent').length

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
          <Link href="/portal">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          </Link>
          <h1 className="text-lg font-bold">My Attendance</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">

        {/* Month selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonthOffset(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center">{monthLabel}</span>
            <Button variant="outline" size="icon" onClick={() => setMonthOffset(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-kpi-green">{presentCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Present</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-kpi-amber">{lateCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Late Arrivals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{absentCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Absent</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar view */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daily Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const date = new Date(year, month - 1, day)
                  const dow = date.getDay()
                  const isWeekend = dow === 0 || dow === 6
                  const isFuture = date > now
                  const rec = recordMap[day]

                  if (isWeekend) return null

                  const status = rec ? (rec.is_late ? 'late' : rec.status) : (isFuture ? null : 'absent')
                  if (!status) return null

                  return (
                    <div key={day} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-16 text-sm font-medium text-foreground">
                          {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                        <div className="text-xs text-muted-foreground w-8">
                          {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusStyle[status] ?? 'bg-muted text-muted-foreground'}`}>
                          {statusLabel[status] ?? status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>In: {formatTime(rec?.first_in ?? null)}</span>
                        <span>Out: {formatTime(rec?.last_out ?? null)}</span>
                        <span className="font-medium text-foreground">
                          {rec?.total_hours ? `${parseFloat(rec.total_hours).toFixed(1)}h` : '—'}
                        </span>
                        {rec?.is_late && (
                          <span className="text-kpi-amber">{rec.late_by_minutes}m late</span>
                        )}
                        {/* Allow employees to self-mark present/late day as half day */}
                        {rec && (status === 'present' || status === 'late') && !isFuture && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-orange-700 hover:bg-orange-50"
                            onClick={() => handleMarkHalfDay(rec.id)}
                            disabled={markingHalfDay === rec.id}
                          >
                            {markingHalfDay === rec.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><Clock className="h-3 w-3 mr-1" />Half Day</>
                            }
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}