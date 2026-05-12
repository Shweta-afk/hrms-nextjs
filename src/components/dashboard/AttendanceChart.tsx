'use client'

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";

interface MonthData { month: string; attendance: number }

const AttendanceChart = () => {
  const [data, setData] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const now = new Date()
        const months: MonthData[] = []

        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const month = date.getMonth() + 1
          const year = date.getFullYear()
          const label = date.toLocaleDateString('en-IN', { month: 'short' })

          const res = await fetch(`/api/attendance?month=${month}&year=${year}&limit=1`)
          const json = await res.json()

          if (json.success) {
            const { present, absent } = json.data.summary
            const total = present + absent
            const rate = total > 0 ? Math.round((present / total) * 100) : 0
            months.push({ month: label, attendance: rate })
          } else {
            months.push({ month: label, attendance: 0 })
          }
        }

        setData(months)
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
              <Bar dataKey="attendance" fill="hsl(243 75% 59%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default AttendanceChart