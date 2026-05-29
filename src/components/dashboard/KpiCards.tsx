'use client'

import { useState, useEffect } from "react";
import { Users, UserCheck, UserX, CalendarOff, Briefcase, TrendingUp, Loader2 } from "lucide-react";

interface KpiData {
  total_employees: number
  present_today: number
  absent_today: number
  on_leave_today: number
  open_positions: number
  attendance_rate: number
}

const KpiCards = () => {
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchKpis() {
      try {
        const [empRes, attRes, leaveRes, recruitRes] = await Promise.all([
          fetch('/api/employees?limit=1&payroll_only=true'),
          fetch('/api/attendance?limit=1'),
          fetch('/api/leave/requests?status=approved&limit=200'),
          fetch('/api/recruitment/jobs'),
        ])

        const [empJson, attJson, leaveJson, recruitJson] = await Promise.all([
          empRes.json(), attRes.json(), leaveRes.json(), recruitRes.json(),
        ])

        const totalEmployees = empJson.success ? empJson.data.total : 0
        const presentToday   = attJson.success ? attJson.data.summary.present : 0
        const absentToday    = attJson.success ? attJson.data.summary.absent  : 0
        const attendanceRate = totalEmployees > 0
          ? Math.round((presentToday / totalEmployees) * 100)
          : 0

        const openPositions = recruitJson.success
          ? recruitJson.data
              .filter((j: { status: string; openings: number }) => j.status === 'open')
              .reduce((sum: number, j: { openings: number }) => sum + j.openings, 0)
          : 0

        // Date-string comparison avoids UTC-midnight vs IST timezone traps
        const todayStr = new Date().toISOString().slice(0, 10)
        const onLeaveToday = leaveJson.success
          ? leaveJson.data.requests.filter((r: { from_date: string; to_date: string }) => {
              const from = (r.from_date ?? '').slice(0, 10)
              const to   = (r.to_date   ?? '').slice(0, 10)
              return from <= todayStr && todayStr <= to
            }).length
          : 0

        setData({
          total_employees: totalEmployees,
          present_today:   presentToday,
          absent_today:    absentToday,
          on_leave_today:  onLeaveToday,
          open_positions:  openPositions,
          attendance_rate: attendanceRate,
        })
      } catch (err) {
        console.error('Failed to fetch KPIs', err)
      } finally {
        setLoading(false)
      }
    }
    fetchKpis()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg border border-border p-5 shadow-sm h-[110px] flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    )
  }

  const kpis = [
    {
      label: "Total Employees",
      value: String(data?.total_employees ?? 0),
      icon: Users,
      trend: "Active employees",
      trendColor: "text-muted-foreground",
      showTrendIcon: false,
    },
    {
      label: "Present Today",
      value: String(data?.present_today ?? 0),
      icon: UserCheck,
      trend: `${data?.attendance_rate ?? 0}% attendance rate`,
      trendColor: (data?.attendance_rate ?? 0) >= 80 ? "text-kpi-green" : "text-kpi-amber",
      showTrendIcon: true,
    },
    {
      label: "Absent Today",
      value: String(data?.absent_today ?? 0),
      icon: UserX,
      trend: data?.total_employees
        ? `${Math.round(((data.absent_today ?? 0) / data.total_employees) * 100)}% of workforce`
        : "0% of workforce",
      trendColor: (data?.absent_today ?? 0) > 0 ? "text-destructive" : "text-kpi-green",
      showTrendIcon: false,
    },
    {
      label: "On Leave Today",
      value: String(data?.on_leave_today ?? 0),
      icon: CalendarOff,
      trend: data?.total_employees
        ? `${Math.round(((data.on_leave_today ?? 0) / data.total_employees) * 100)}% of workforce`
        : "0% of workforce",
      trendColor: "text-muted-foreground",
      showTrendIcon: false,
    },
    {
      label: "Open Positions",
      value: String(data?.open_positions ?? 0),
      icon: Briefcase,
      trend: "Active job openings",
      trendColor: "text-muted-foreground",
      showTrendIcon: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="bg-card rounded-lg border border-border p-5 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">{kpi.label}</p>
              <p className="text-3xl font-bold text-foreground mt-1">{kpi.value}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <kpi.icon className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            {kpi.showTrendIcon && <TrendingUp className="h-3.5 w-3.5 text-kpi-green" />}
            <span className={`text-xs font-medium ${kpi.trendColor}`}>
              {kpi.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default KpiCards
