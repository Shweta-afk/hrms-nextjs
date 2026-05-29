'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Activity, AlertTriangle, ChevronDown, ChevronUp,
  Clock, Loader2, Timer, UserCheck, UserX, Users, Wifi, WifiOff,
} from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmployeeBrief {
  id: string
  first_name: string
  last_name: string
  emp_code: string
  department: { name: string } | null
  designation: { name: string } | null
}

interface InsideRecord {
  employee_id: string
  employee: EmployeeBrief | null
  first_in: string | null
  device_name: string | null
}

interface PunchEntry {
  id: string
  emp_code: string
  punch_time: string
  direction: 'IN' | 'OUT'
  device_id: string
  employee_name: string
}

interface LateRecord {
  employee_id: string
  employee: EmployeeBrief | null
}

interface DeviceEntry {
  id: string
  name: string
  location: string | null
  status: 'online' | 'idle' | 'offline' | 'never_connected'
  last_heartbeat: string | null
  punches_today: number
}

interface LiveData {
  as_of: string
  summary: {
    total_employees: number
    present: number
    absent: number
    late: number
    not_yet_in: number
    currently_inside: number
  }
  currently_inside: InsideRecord[]
  not_yet_arrived: EmployeeBrief[]
  recent_punches: PunchEntry[]
  late_today: LateRecord[]
  devices: DeviceEntry[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  const mins = (Date.now() - new Date(iso).getTime()) / 60_000
  if (mins < 1) return 'just now'
  if (mins < 60) return `${Math.floor(mins)} min ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
}

const deviceStatusConfig: Record<string, { dot: string; label: string; labelColor: string }> = {
  online:          { dot: 'bg-green-500',  label: 'Online',           labelColor: 'text-green-600' },
  idle:            { dot: 'bg-yellow-500', label: 'Idle',             labelColor: 'text-yellow-600' },
  offline:         { dot: 'bg-red-500',    label: 'OFFLINE',          labelColor: 'text-red-600' },
  never_connected: { dot: 'bg-gray-400 dark:bg-muted-foreground/50',   label: 'Never connected',  labelColor: 'text-muted-foreground' },
}

const POLL_MS = 30_000

// ── Component ─────────────────────────────────────────────────────────────────

const AttendanceLive = () => {
  const [data, setData]                   = useState<LiveData | null>(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [secondsSince, setSecondsSince]   = useState(0)
  const [showNotArrived, setShowNotArrived] = useState(false)
  const [newPunchIds, setNewPunchIds]     = useState<Set<string>>(new Set())

  const prevPunchIds   = useRef<Set<string>>(new Set())
  const lastFetchedAt  = useRef<Date>(new Date())
  const flashTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/live')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Unknown error')

      const live: LiveData = json.data

      // Flash newly-arrived punches green for 4 seconds
      const currentIds = new Set(live.recent_punches.map((p) => p.id))
      if (prevPunchIds.current.size > 0) {
        const added = new Set([...currentIds].filter((id) => !prevPunchIds.current.has(id)))
        if (added.size > 0) {
          setNewPunchIds(added)
          if (flashTimer.current) clearTimeout(flashTimer.current)
          flashTimer.current = setTimeout(() => setNewPunchIds(new Set()), 4_000)
        }
      }
      prevPunchIds.current = currentIds
      lastFetchedAt.current = new Date()

      setData(live)
      setError(null)
      setSecondsSince(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load live data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + 30-second poll
  useEffect(() => {
    fetchData()
    const poll = setInterval(fetchData, POLL_MS)
    return () => {
      clearInterval(poll)
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [fetchData])

  // "X seconds ago" counter
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsSince(Math.floor((Date.now() - lastFetchedAt.current.getTime()) / 1_000))
    }, 1_000)
    return () => clearInterval(tick)
  }, [])

  const today        = new Date()
  const todayLabel   = format(today, 'EEEE, d MMMM yyyy')
  const isAfter10AM  = today.getHours() >= 10

  // Build lookup maps from the response
  const deviceMap = new Map((data?.devices ?? []).map((d) => [d.id, d.name]))
  const lateEmpCodes = new Set(
    (data?.late_today ?? [])
      .map((r) => r.employee?.emp_code)
      .filter((c): c is string => Boolean(c))
  )
  const hasOffline = data?.devices?.some(
    (d) => d.status === 'offline' || d.status === 'never_connected'
  )

  // ── Summary card config ───────────────────────────────────────────────────

  const summaryCards = data
    ? [
        {
          label: 'Total',
          value: data.summary.total_employees,
          icon: Users,
          color: 'text-foreground',
        },
        {
          label: 'Present',
          value: data.summary.present,
          sub: data.summary.total_employees
            ? `${Math.round((data.summary.present / data.summary.total_employees) * 100)}%`
            : undefined,
          icon: UserCheck,
          color: 'text-kpi-green',
        },
        {
          label: 'Absent',
          value: data.summary.absent,
          icon: UserX,
          color: 'text-kpi-red',
        },
        {
          label: 'Late',
          value: data.summary.late,
          icon: Clock,
          color: 'text-kpi-amber',
        },
        {
          label: 'Inside Now',
          value: data.summary.currently_inside,
          icon: Timer,
          color: 'text-primary',
        },
      ]
    : []

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Live Attendance">

      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          {/* Pulsing LIVE badge */}
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Live</span>
          </div>
          <span className="text-sm font-medium text-foreground hidden sm:block">{todayLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {hasOffline && (
            <Badge variant="destructive" className="text-xs gap-1">
              <WifiOff className="h-3 w-3" /> Device offline
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {secondsSince < 2 ? 'Updated just now' : `Updated ${secondsSince}s ago`}
          </span>
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading} className="h-7 text-xs">
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Activity className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Initial loading skeleton */}
      {loading && !data && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {summaryCards.map(({ label, value, sub, icon: Icon, color }) => (
              <Card key={label} className="shadow-sm">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {label}
                      </p>
                      <p className={cn('text-2xl font-bold mt-0.5', color)}>{value}</p>
                      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                    </div>
                    <Icon className={cn('h-5 w-5 mt-0.5 opacity-50', color)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Two-column layout: punch feed + device status ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

            {/* LEFT — Live Punch Feed */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  ⚡ Live Punch Feed
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {data.recent_punches.length} today
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[380px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4 text-xs w-28">Time</TableHead>
                        <TableHead className="text-xs">Employee</TableHead>
                        <TableHead className="text-xs w-20">Action</TableHead>
                        <TableHead className="text-xs pr-4">Device</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent_punches.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-10">
                            No punches recorded today
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.recent_punches.map((punch) => {
                          const isNew    = newPunchIds.has(punch.id)
                          const isLate   = punch.direction === 'IN' && lateEmpCodes.has(punch.emp_code)
                          const devName  = deviceMap.get(punch.device_id) ?? '—'
                          return (
                            <TableRow
                              key={punch.id}
                              className={cn(
                                'transition-colors duration-500',
                                isNew && 'bg-green-500/10'
                              )}
                            >
                              <TableCell className="pl-4 text-xs font-mono text-muted-foreground py-2.5">
                                {fmtTime(punch.punch_time)}
                              </TableCell>
                              <TableCell className="text-sm font-medium py-2.5">
                                {punch.employee_name}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge
                                  className={cn(
                                    'text-xs font-semibold border-0',
                                    punch.direction === 'IN'
                                      ? 'bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/15'
                                      : 'bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/15'
                                  )}
                                >
                                  {punch.direction === 'IN' ? '🟢 IN' : '🔴 OUT'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground pr-4 py-2.5">
                                {devName}
                                {isLate && (
                                  <Badge variant="destructive" className="ml-1.5 text-[10px] py-0 px-1 h-4">
                                    late
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* RIGHT — Device Status */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" />
                  Device Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-4 py-8 text-center">
                    No devices configured
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {data.devices.map((device) => {
                      const cfg = deviceStatusConfig[device.status] ?? deviceStatusConfig.never_connected
                      return (
                        <div key={device.id} className="px-4 py-3.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full shrink-0',
                                cfg.dot,
                                device.status === 'offline' && 'animate-pulse'
                              )}
                            />
                            <span className="text-sm font-medium truncate flex-1">{device.name}</span>
                            <span className={cn('text-xs font-semibold', cfg.labelColor)}>
                              {cfg.label}
                            </span>
                          </div>
                          {device.location && (
                            <p className="text-xs text-muted-foreground ml-4 mb-0.5">{device.location}</p>
                          )}
                          <p className="text-xs text-muted-foreground ml-4">
                            {device.status === 'offline'
                              ? `⚠ Last seen: ${relativeTime(device.last_heartbeat)}`
                              : `Last heartbeat: ${relativeTime(device.last_heartbeat)}`}
                          </p>
                          <p className="text-xs text-muted-foreground ml-4">
                            Today: {device.punches_today} punch{device.punches_today !== 1 ? 'es' : ''}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Currently Inside ── */}
          <Card className="shadow-sm mb-4">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                Currently Inside
                <Badge variant="secondary" className="ml-1 text-xs">
                  {data.currently_inside.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 text-xs">Employee</TableHead>
                      <TableHead className="text-xs">Department</TableHead>
                      <TableHead className="text-xs">In Since</TableHead>
                      <TableHead className="text-xs pr-4">Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.currently_inside.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">
                          No employees currently inside
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.currently_inside.map((r) => (
                        <TableRow key={r.employee_id}>
                          <TableCell className="pl-4 py-2.5">
                            <p className="text-sm font-medium">
                              {r.employee
                                ? `${r.employee.first_name} ${r.employee.last_name}`
                                : '—'}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {r.employee?.emp_code ?? ''}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2.5">
                            {r.employee?.department?.name ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs font-mono py-2.5">
                            {fmtTime(r.first_in)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground pr-4 py-2.5">
                            {r.device_name ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ── Not Yet Arrived (shown after 10 AM) ── */}
          {isAfter10AM && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <UserX className="h-4 w-4 text-kpi-amber" />
                    Not Yet Arrived
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {data.not_yet_arrived.length}
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setShowNotArrived((v) => !v)}
                  >
                    {showNotArrived
                      ? <ChevronUp className="h-3.5 w-3.5 mr-1" />
                      : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                    {showNotArrived ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>

              {showNotArrived && (
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-56">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4 text-xs">Employee</TableHead>
                          <TableHead className="text-xs">Code</TableHead>
                          <TableHead className="text-xs pr-4">Department</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.not_yet_arrived.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-6">
                              Everyone has arrived 🎉
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.not_yet_arrived.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="pl-4 text-sm font-medium py-2.5">
                                {e.first_name} {e.last_name}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground py-2.5">
                                {e.emp_code}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground pr-4 py-2.5">
                                {e.department?.name ?? '—'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </>
      )}
    </AppLayout>
  )
}

export default AttendanceLive
