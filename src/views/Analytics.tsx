'use client'

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, TrendingDown, TrendingUp, Clock, UserPlus, Download, AlertTriangle, Loader2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";

// Lazy-load recharts — large library, not needed on initial paint
const BarChart = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then(m => m.Bar), { ssr: false });
const LineChart = dynamic(() => import("recharts").then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then(m => m.Line), { ssr: false });
const ReferenceLine = dynamic(() => import("recharts").then(m => m.ReferenceLine), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then(m => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });

const chartAxis = { fill: "hsl(220 9% 46%)", fontSize: 12 }
const formatter = (value: ValueType, name: NameType) => [
  `${Number(value ?? 0)}%`,
  name === "present" ? "Present" : "Late",
]

const COLORS = {
  blue: "hsl(217 91% 60%)",
  sky: "hsl(199 89% 48%)",
  purple: "hsl(263 70% 50%)",
  amber: "hsl(38 92% 50%)",
  red: "hsl(0 84% 60%)",
  teal: "hsl(173 80% 40%)",
}

interface AnalyticsData {
  headcount: { total: number; new_hires_quarter: number }
  departmentData: { dept: string; count: number }[]
  attendanceTrend: { month: string; present: number; late: number }[]
  leaveUtilization: { month: string; [key: string]: any }[]
  funnel: { stage: string; value: number }[]
  attritionRisk: { id: string; name: string; dept: string; score: number; factors: string[] }[]
}

const Analytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchAnalytics() {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics')
      const json = await res.json()
      if (json.success) setData(json.data)
      else toast.error('Failed to load analytics')
    } catch {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAnalytics() }, [])

  function handleExport() {
    if (!data) return
    const rows = [
      ['Metric', 'Value'],
      ['Total Headcount', data.headcount.total],
      ['New Hires This Quarter', data.headcount.new_hires_quarter],
      ['Total Candidates', data.funnel[0]?.value ?? 0],
      ...data.departmentData.map(d => [`Dept: ${d.dept}`, d.count]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hr-analytics-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Analytics report exported')
  }

  if (loading) {
    return (
      <AppLayout title="HR Analytics">
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (!data) return (
    <AppLayout title="HR Analytics">
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Failed to load analytics data.</p>
        <Button onClick={fetchAnalytics} variant="outline" size="sm">Retry</Button>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout title="HR Analytics">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex justify-end">
          <Button className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Headcount', value: String(data.headcount.total), trend: 'Active employees', icon: Users },
            { label: 'Attrition Risk Flags', value: String(data.attritionRisk.length), trend: 'Based on attendance', icon: TrendingDown },
            { label: 'Avg Attendance', value: `${data.attendanceTrend.length > 0 ? Math.round(data.attendanceTrend.reduce((s, m) => s + m.present, 0) / data.attendanceTrend.length) : 0}%`, trend: 'Last 6 months', icon: Clock },
            { label: 'New Hires This Quarter', value: String(data.headcount.new_hires_quarter), trend: 'Joined this quarter', icon: UserPlus },
          ].map(k => (
            <Card key={k.label} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{k.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{k.value}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <k.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-kpi-green" />
                  <span className="text-xs font-medium text-kpi-green">{k.trend}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Headcount + Attendance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Headcount by Department</CardTitle>
            </CardHeader>
            <CardContent>
              {data.departmentData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                  No department data yet
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.departmentData} layout="vertical" barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" horizontal={false} />
                      <XAxis type="number" tick={chartAxis} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="dept" tick={chartAxis} axisLine={false} tickLine={false} width={100} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                      <Bar dataKey="count" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Attendance Trend (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.attendanceTrend.every(m => m.present === 0) ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                  No attendance data yet
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.attendanceTrend} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                      <XAxis dataKey="month" tick={chartAxis} axisLine={false} tickLine={false} />
                      <YAxis tick={chartAxis} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, fontSize: 13 }}
                        formatter={formatter as any}
                      />
                      <Legend formatter={v => v === 'present' ? 'Present %' : 'Late %'} />
                      <Bar dataKey="present" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="late" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Leave Utilization */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Leave Utilization by Type (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.leaveUtilization} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                  <XAxis dataKey="month" tick={chartAxis} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxis} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Legend />
                  <Bar dataKey="CL" stackId="a" fill={COLORS.blue} />
                  <Bar dataKey="SL" stackId="a" fill={COLORS.sky} />
                  <Bar dataKey="EL" stackId="a" fill={COLORS.teal} />
                  <Bar dataKey="ML" stackId="a" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recruitment Funnel */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recruitment Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-0 py-4">
              {data.funnel.map((stage, i) => (
                <div key={stage.stage} className="flex items-center">
                  <div
                    className="flex flex-col items-center justify-center rounded-xl border border-border px-6 py-5 min-w-[120px]"
                    style={{ background: `linear-gradient(135deg, hsl(243 75% ${92 - i * 8}%), hsl(263 70% ${94 - i * 8}%))` }}
                  >
                    <span className="text-2xl font-bold text-foreground">{stage.value}</span>
                    <span className="text-xs font-medium text-muted-foreground mt-1">{stage.stage}</span>
                  </div>
                  {i < data.funnel.length - 1 && (
                    <div className="flex flex-col items-center mx-2">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {stage.value > 0 ? Math.round((data.funnel[i + 1].value / stage.value) * 100) : 0}%
                      </span>
                      <span className="text-muted-foreground">→</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Attrition Risk */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-kpi-amber" />
              {data.attritionRisk.length > 0
                ? `${data.attritionRisk.length} Employee(s) Flagged for Attrition Risk`
                : 'No Attrition Risk Flags'
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.attritionRisk.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No employees flagged. Keep up the good work!
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Risk Score</TableHead>
                        <TableHead>Risk Factors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.attritionRisk.map(emp => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.name}</TableCell>
                          <TableCell>{emp.dept}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={emp.score >= 70 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}
                            >
                              {emp.score >= 70 ? 'High' : 'Medium'} {emp.score}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {emp.factors.map(f => (
                                <Badge key={f} variant="outline" className="text-[10px] font-normal">{f}</Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-[11px] text-muted-foreground mt-4 italic">
                  AI-generated predictions based on attendance patterns. Use as signals, not decisions.
                </p>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  )
}

export default Analytics