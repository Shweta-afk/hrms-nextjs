'use client'

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Lazy-load recharts — keeps it out of the initial JS bundle
const BarChart = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });

interface MonthData { month: string; attendance: number }

const AttendanceChart = () => {
  // Single endpoint returns all 6 months in one DB roundtrip. Cached via
  // TanStack — re-mounting the dashboard within 30s is free.
  const { data = [], isLoading: loading } = useQuery<MonthData[]>({
    queryKey: ['attendance-trend', 6],
    queryFn: async () => {
      const res = await fetch('/api/attendance/trend?months=6')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'fetch failed')
      return json.data as MonthData[]
    },
    // Monthly attendance is even more stable than KPIs — bump staleTime up
    // so navigating around the app doesn't refetch.
    staleTime: 5 * 60_000,
  })

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Attendance %</h3>
      {loading ? (
        <div className="h-[260px] flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : data.every(d => d.attendance === 0) ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
          No attendance data yet
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "hsl(220 9% 46%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "hsl(220 9% 46%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(220 13% 91%)", fontSize: 13 }}
                formatter={(value) => [`${Number(value ?? 0)}%`, "Attendance"]}
              />
              <Bar dataKey="attendance" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default AttendanceChart
