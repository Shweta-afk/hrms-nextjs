'use client'

import { useQuery } from "@tanstack/react-query";
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
  // Single aggregate endpoint — collapses what was 4 parallel network
  // round-trips + client-side filtering down to one request. Cached via
  // TanStack so going Dashboard → Employees → Dashboard hits the cache.
  const { data, isLoading: loading } = useQuery<KpiData>({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'fetch failed')
      return json.data
    },
  })

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
