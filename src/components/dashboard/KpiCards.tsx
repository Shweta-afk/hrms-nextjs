'use client'

import { useState, useEffect } from "react";
import { Users, UserCheck, CalendarOff, Briefcase, TrendingUp, Loader2 } from "lucide-react";

interface KpiData {
  total_employees: number
  present_today: number
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
        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()

        const [empRes, attRes, leaveRes, recruitRes] = await Promise.all([
          fetch('/api/employees?limit=1&payroll_only=true'),
          fetch('/api/attendance?limit=1'),
          fetch('/api/leave/requests?status=approved&limit=50'),
          fetch('/api/recruitment/jobs'),
        ])

        const [empJson, attJson, leaveJson, recruitJson] = await Promise.all([
          empRes.json(), attRes.json(), leaveRes.json(), recruitRes.json(),
        ])

        const totalEmployees = empJson.success ? empJson.data.total : 0
        const presentToday = attJson.success ? attJson.data.summary.present : 0
        const attendanceRate = totalEmployees > 0
          ? Math.round((presentToday / totalEmployees) * 100)
          : 0

        // Count open positions from recruitment
        const openJobs = recruitJson.success
          ? recruitJson.data.filter((j: any) => j.status === 'open')
          : []
        const openPositions = openJobs.reduce((sum: number, j: any) => sum + j.openings, 0)

        // Count approved leaves today
        const today = new Date().toDateString()
        const onLeaveToday = leaveJson.success
          ? leaveJson.data.requests.filter((r: any) => {
              const from = new Date(r.from_date)
              const to = new Date(r.to_date)
              const now = new Date()
              return now >= from && now <= to
            }).length
          : 0

        setData({
          total_employees: totalEmployees,
          present_today: presentToday,
          on_leave_today: onLeaveToday,
          open_positions: openPositions,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
      trendPositive: true,
    },
    {
      label: "Present Today",
      value: String(data?.present_today ?? 0),
      icon: UserCheck,
      trend: `${data?.attendance_rate ?? 0}% attendance`,
      trendPositive: (data?.attendance_rate ?? 0) >= 80,
    },
    {
      label: "On Leave Today",
      value: String(data?.on_leave_today ?? 0),
      icon: CalendarOff,
      trend: data?.total_employees
        ? `${Math.round(((data?.on_leave_today ?? 0) / data.total_employees) * 100)}% of workforce`
        : '0% of workforce',
      trendPositive: false,
    },
    {
      label: "Open Positions",
      value: String(data?.open_positions ?? 0),
      icon: Briefcase,
      trend: "Active job openings",
      trendPositive: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <kpi.icon className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            {kpi.trendPositive && <TrendingUp className="h-3.5 w-3.5 text-kpi-green" />}
            <span className={`text-xs font-medium ${kpi.trendPositive ? "text-kpi-green" : "text-kpi-amber"}`}>
              {kpi.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default KpiCards