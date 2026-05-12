'use client'

import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Loader2 } from "lucide-react";

const COLORS = [
  "hsl(243 75% 59%)",
  "hsl(263 70% 50%)",
  "hsl(230 70% 65%)",
  "hsl(280 60% 65%)",
  "hsl(38 92% 50%)",
]

interface LeaveData { name: string; value: number }

const LeaveDistributionChart = () => {
  const [data, setData] = useState<LeaveData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/leave/balance')
        const json = await res.json()

        if (json.success) {
          const paid = json.data.filter((l: any) => l.is_paid && l.taken > 0)

          if (paid.length === 0) {
            // Show total entitlement distribution if nothing taken yet
            const all = json.data.filter((l: any) => l.is_paid && l.total > 0)
            setData(all.map((l: any) => ({ name: l.code, value: l.total })))
          } else {
            setData(paid.map((l: any) => ({ name: l.code, value: l.taken })))
          }
        }
      } catch (err) {
        console.error('Failed to fetch leave distribution', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Leave Distribution</h3>
      {loading ? (
        <div className="h-[260px] flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
          No leave data yet
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(220 13% 91%)", fontSize: 13 }}
                formatter={(value, name) => [value, name]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ color: "hsl(220 9% 46%)", fontSize: 12 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default LeaveDistributionChart