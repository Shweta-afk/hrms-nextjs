import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  TrendingDown,
  TrendingUp,
  Clock,
  UserPlus,
  Download,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Legend,
} from "recharts";

/* ── data ───────────────────────────────────────────── */

const departmentData = [
  { dept: "Engineering", count: 82 },
  { dept: "Sales", count: 54 },
  { dept: "Operations", count: 41 },
  { dept: "Finance", count: 28 },
  { dept: "Others", count: 24 },
  { dept: "HR", count: 18 },
];

const attritionTrend = [
  { month: "Apr", rate: 4.8 },
  { month: "May", rate: 5.2 },
  { month: "Jun", rate: 4.5 },
  { month: "Jul", rate: 3.9 },
  { month: "Aug", rate: 4.1 },
  { month: "Sep", rate: 5.5 },
  { month: "Oct", rate: 4.9 },
  { month: "Nov", rate: 3.8 },
  { month: "Dec", rate: 4.3 },
  { month: "Jan", rate: 4.0 },
  { month: "Feb", rate: 3.6 },
  { month: "Mar", rate: 4.2 },
];

const attendanceTrend = [
  { month: "Oct", present: 88, late: 6 },
  { month: "Nov", present: 86, late: 8 },
  { month: "Dec", present: 82, late: 10 },
  { month: "Jan", present: 90, late: 5 },
  { month: "Feb", present: 87, late: 7 },
  { month: "Mar", present: 89, late: 6 },
];

const leaveUtilization = [
  { month: "Oct", CL: 22, SL: 14, PL: 8, ML: 2 },
  { month: "Nov", CL: 18, SL: 20, PL: 10, ML: 1 },
  { month: "Dec", CL: 30, SL: 12, PL: 14, ML: 3 },
  { month: "Jan", CL: 16, SL: 10, PL: 6, ML: 0 },
  { month: "Feb", CL: 20, SL: 16, PL: 9, ML: 2 },
  { month: "Mar", CL: 24, SL: 18, PL: 12, ML: 1 },
];

const funnel = [
  { stage: "Applications", value: 156 },
  { stage: "Screened", value: 89 },
  { stage: "Interviewed", value: 34 },
  { stage: "Offered", value: 12 },
  { stage: "Joined", value: 9 },
];

const attritionRisk = [
  { id: "#4421", dept: "Engineering", score: 85, factors: ["No promotion in 2 years", "Below avg performance"] },
  { id: "#3187", dept: "Sales", score: 78, factors: ["Frequent late arrivals", "No promotion in 2 years"] },
  { id: "#2954", dept: "Operations", score: 72, factors: ["Below avg performance", "Low engagement score"] },
  { id: "#5102", dept: "Engineering", score: 68, factors: ["Frequent late arrivals", "Manager change"] },
  { id: "#4788", dept: "Finance", score: 65, factors: ["No promotion in 2 years"] },
  { id: "#3341", dept: "Sales", score: 62, factors: ["Low engagement score", "Frequent late arrivals"] },
  { id: "#2215", dept: "HR", score: 58, factors: ["Below avg performance"] },
  { id: "#4990", dept: "Operations", score: 55, factors: ["Manager change", "No promotion in 2 years"] },
];

/* ── helpers ────────────────────────────────────────── */

const chartAxis = { fill: "hsl(220 9% 46%)", fontSize: 12 };

const COLORS = {
  indigo: "hsl(243 75% 59%)",
  purple: "hsl(263 70% 50%)",
  blue: "hsl(217 91% 60%)",
  sky: "hsl(199 89% 48%)",
  green: "hsl(152 69% 42%)",
  amber: "hsl(38 92% 50%)",
  red: "hsl(0 84% 60%)",
  slate: "hsl(220 9% 46%)",
};

/* ── component ──────────────────────────────────────── */

const Analytics = () => {
  const [dateRange, setDateRange] = useState("q1-2026");

  return (
    <AppLayout title="HR Analytics">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="q1-2026">Jan 2026 – Mar 2026</SelectItem>
                <SelectItem value="q4-2025">Oct 2025 – Dec 2025</SelectItem>
                <SelectItem value="q3-2025">Jul 2025 – Sep 2025</SelectItem>
              </SelectContent>
            </Select>
            <Button className="gap-2">
              <Download className="h-4 w-4" /> Export Report
            </Button>
          </div>
        </div>

        {/* Section 1 — KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Headcount", value: "247", trend: "+12 from last quarter", up: true, icon: Users },
            { label: "Attrition Rate", value: "4.2%", trend: "↓ 1.1% vs last quarter", up: false, icon: TrendingDown, good: true },
            { label: "Average Tenure", value: "2.4 yrs", trend: "Stable", up: true, icon: Clock },
            { label: "New Hires This Quarter", value: "18", trend: "+5 vs last quarter", up: true, icon: UserPlus },
          ].map((k) => (
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
                  {k.good ? (
                    <TrendingDown className="h-3.5 w-3.5 text-[hsl(var(--kpi-green))]" />
                  ) : k.up ? (
                    <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--kpi-green))]" />
                  ) : null}
                  <span className={`text-xs font-medium ${k.good || k.up ? "text-[hsl(var(--kpi-green))]" : "text-muted-foreground"}`}>
                    {k.trend}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Section 2 — Headcount + Attrition */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Headcount by Department</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" horizontal={false} />
                    <XAxis type="number" tick={chartAxis} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="dept" tick={chartAxis} axisLine={false} tickLine={false} width={90} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220 13% 91%)", fontSize: 13 }} />
                    <Bar dataKey="count" fill={COLORS.indigo} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Monthly Attrition Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={attritionTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                    <XAxis dataKey="month" tick={chartAxis} axisLine={false} tickLine={false} />
                    <YAxis domain={[2, 7]} tick={chartAxis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220 13% 91%)", fontSize: 13 }} formatter={(v) => [`${Number(v ?? 0)}%`, "Attrition"]} />
                    <ReferenceLine y={5} stroke={COLORS.red} strokeDasharray="6 4" label={{ value: "Target 5%", fill: COLORS.red, fontSize: 11, position: "insideTopRight" }} />
                    <Line type="monotone" dataKey="rate" stroke={COLORS.purple} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.purple }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 3 — Attendance + Leave */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Attendance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceTrend} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                    <XAxis dataKey="month" tick={chartAxis} axisLine={false} tickLine={false} />
                    <YAxis tick={chartAxis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220 13% 91%)", fontSize: 13 }} formatter={(v: number, name: string) => [`${v}%`, name === "present" ? "Present" : "Late"]} />
                    <Legend formatter={(value) => (value === "present" ? "Present %" : "Late %")} />
                    <Bar dataKey="present" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Leave Utilization by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaveUtilization} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                    <XAxis dataKey="month" tick={chartAxis} axisLine={false} tickLine={false} />
                    <YAxis tick={chartAxis} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220 13% 91%)", fontSize: 13 }} />
                    <Legend />
                    <Bar dataKey="CL" stackId="a" fill={COLORS.indigo} />
                    <Bar dataKey="SL" stackId="a" fill={COLORS.blue} />
                    <Bar dataKey="PL" stackId="a" fill={COLORS.sky} />
                    <Bar dataKey="ML" stackId="a" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 4 — Recruitment Funnel */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recruitment Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-0 py-4">
              {funnel.map((stage, i) => (
                <div key={stage.stage} className="flex items-center">
                  <div
                    className="flex flex-col items-center justify-center rounded-xl border border-border px-6 py-5 min-w-[120px]"
                    style={{
                      background: `linear-gradient(135deg, hsl(243 75% ${92 - i * 8}%), hsl(263 70% ${94 - i * 8}%))`,
                    }}
                  >
                    <span className="text-2xl font-bold text-foreground">{stage.value}</span>
                    <span className="text-xs font-medium text-muted-foreground mt-1">{stage.stage}</span>
                  </div>
                  {i < funnel.length - 1 && (
                    <div className="flex flex-col items-center mx-2">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {Math.round((funnel[i + 1].value / stage.value) * 100)}%
                      </span>
                      <span className="text-muted-foreground">→</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section 5 — AI Attrition Risk */}
        <Card className="shadow-sm border-[hsl(var(--kpi-amber))]/40 bg-[hsl(38_92%_50%/0.03)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--kpi-amber))]" />
              8 Employees Flagged as High Attrition Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  {attritionRisk.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">Employee {emp.id}</TableCell>
                      <TableCell>{emp.dept}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            emp.score >= 70
                              ? "bg-red-100 text-red-700 hover:bg-red-100"
                              : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                          }
                        >
                          {emp.score >= 70 ? "High" : "Medium"} {emp.score}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {emp.factors.map((f) => (
                            <Badge key={f} variant="outline" className="text-[10px] font-normal">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-4 italic">
              AI-generated predictions. Use as signals, not decisions.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Analytics;
