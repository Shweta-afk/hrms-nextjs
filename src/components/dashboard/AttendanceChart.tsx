'use client'

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
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
  const [data, setData] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const now = new Date()

        // Build all 6 month params upfront
        const months = Array.from({ length: 6 }, (_, i) => {
          const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
          return {
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            label: date.toLocaleDateString('en-IN', { month: 'short' }),
          }
        })

        // Fire all 6 requests in parallel instead of sequentially
        const results = await Promise.all(
          months.map(({ month, year }) =>
            fetch(`/api/attendance?month=${month}&year=${year}&limit=1`).then(r => r.json())
          )
        )

        const chartData: MonthData[] = results.map((json, i) => {
          if (json.success) {
            const { present, absent } = json.data.summary
            const total = present + absent
            return { month: months[i].label, attendance: total > 0 ? Math.round((present / total) * 100) : 0 }
          }
          return { month: months[i].label, attendance: 0 }
        })

        setData(chartData)
      } catch (err) {
        console.error('Failed to fetch attendance chart data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

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
