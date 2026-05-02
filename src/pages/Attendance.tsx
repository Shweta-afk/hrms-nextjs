import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Upload, Users, UserX, CalendarDays, Clock, Home, Wifi } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const stats = [
  { label: "Present Today", value: 198, icon: Users, color: "text-kpi-green", bg: "bg-kpi-green/10" },
  { label: "Absent", value: 31, icon: UserX, color: "text-kpi-red", bg: "bg-kpi-red/10" },
  { label: "On Leave", value: 12, icon: CalendarDays, color: "text-primary", bg: "bg-primary/10" },
  { label: "Late Arrivals", value: 8, icon: Clock, color: "text-kpi-amber", bg: "bg-kpi-amber/10" },
  { label: "Work from Home", value: 6, icon: Home, color: "text-kpi-purple", bg: "bg-kpi-purple/10" },
];

type AttStatus = "Present" | "Absent" | "Late" | "Half Day" | "WFH" | "Holiday";

const statusVariant: Record<AttStatus, string> = {
  Present: "bg-kpi-green/15 text-kpi-green",
  Absent: "bg-kpi-red/15 text-kpi-red",
  Late: "bg-kpi-amber/15 text-kpi-amber",
  "Half Day": "bg-kpi-amber/25 text-kpi-amber",
  WFH: "bg-kpi-purple/15 text-kpi-purple",
  Holiday: "bg-muted text-muted-foreground",
};

const rows: { name: string; initials: string; dept: string; status: AttStatus; inTime: string; outTime: string; hours: string; ot: string }[] = [
  { name: "Aarav Sharma", initials: "AS", dept: "Engineering", status: "Present", inTime: "09:02", outTime: "18:45", hours: "9.7h", ot: "0.7h" },
  { name: "Priya Patel", initials: "PP", dept: "Sales", status: "Late", inTime: "10:18", outTime: "19:10", hours: "8.9h", ot: "—" },
  { name: "Vikram Singh", initials: "VS", dept: "HR", status: "WFH", inTime: "09:00", outTime: "18:00", hours: "9.0h", ot: "—" },
  { name: "Ananya Reddy", initials: "AR", dept: "Finance", status: "Present", inTime: "08:55", outTime: "18:30", hours: "9.6h", ot: "0.6h" },
  { name: "Rahul Verma", initials: "RV", dept: "Engineering", status: "Absent", inTime: "—", outTime: "—", hours: "—", ot: "—" },
  { name: "Meera Joshi", initials: "MJ", dept: "Operations", status: "Half Day", inTime: "09:10", outTime: "13:15", hours: "4.1h", ot: "—" },
  { name: "Karthik Nair", initials: "KN", dept: "Engineering", status: "Present", inTime: "08:48", outTime: "18:50", hours: "10.0h", ot: "1.0h" },
  { name: "Deepa Menon", initials: "DM", dept: "Sales", status: "Present", inTime: "09:05", outTime: "18:35", hours: "9.5h", ot: "0.5h" },
];

const lateArrivals = [
  { name: "Priya Patel", initials: "PP", time: "10:18", mins: 78 },
  { name: "Suresh Gupta", initials: "SG", time: "09:42", mins: 42 },
  { name: "Neha Kapoor", initials: "NK", time: "09:35", mins: 35 },
  { name: "Amit Desai", initials: "AD", time: "09:28", mins: 28 },
  { name: "Pooja Iyer", initials: "PI", time: "09:16", mins: 16 },
];

const heatmapData: Record<number, AttStatus> = {
  1: "Holiday", 2: "Present", 3: "Present", 4: "Present", 5: "Present", 6: "Present",
  7: "Holiday", 8: "Holiday", 9: "Present", 10: "Late", 11: "Present", 12: "Present",
  13: "Present", 14: "Holiday", 15: "Holiday", 16: "Present", 17: "Present", 18: "Present",
  19: "Absent", 20: "Present", 21: "Holiday", 22: "Holiday", 23: "Present", 24: "Present",
  25: "Present", 26: "Late", 27: "Present", 28: "Holiday", 29: "Holiday", 30: "Present", 31: "Present",
};

const heatmapColors: Record<string, string> = {
  Present: "bg-kpi-green", Absent: "bg-kpi-red", Late: "bg-kpi-amber", Holiday: "bg-muted-foreground/30",
};

const Attendance = () => {
  const [monthOffset, setMonthOffset] = useState(0);
  const current = new Date(2026, 2 + monthOffset, 1);
  const monthLabel = current.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = current.getDay();

  return (
    <AppLayout title="Attendance">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setMonthOffset((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">{monthLabel}</span>
            <Button variant="outline" size="icon" onClick={() => setMonthOffset((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Import ESSL Data</Button>
            <Button variant="outline"><Download className="h-4 w-4 mr-2" />Download Report</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Table — 3/5 */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Today's Attendance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Dept</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>OT</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{r.initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-foreground">{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.dept}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusVariant[r.status]}`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{r.inTime}</TableCell>
                      <TableCell className="text-sm">{r.outTime}</TableCell>
                      <TableCell className="text-sm font-medium">{r.hours}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.ot}</TableCell>
                      <TableCell>
                        <button className="text-xs font-medium text-primary hover:underline">Correct</button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Right panels — 2/5 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Late Arrivals */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Late Arrivals Today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lateArrivals.map((e) => (
                  <div key={e.name} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-[10px] bg-kpi-amber/15 text-kpi-amber">{e.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground">Arrived {e.time}</p>
                    </div>
                    <Badge variant="notice" className="text-[10px]">{e.mins} min late</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ESSL Sync */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ESSL Sync Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Synced</span>
                  <span className="text-sm font-medium text-foreground">12 Mar 2026, 08:30 AM</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sync Method</span>
                  <span className="text-sm font-medium text-foreground">API</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div className="flex items-center gap-1.5">
                    <Wifi className="h-3.5 w-3.5 text-kpi-green" />
                    <Badge variant="active" className="text-[10px]">Connected</Badge>
                  </div>
                </div>
                <Button className="w-full" size="sm">Sync Now</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Heatmap */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Attendance Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 text-[10px] text-muted-foreground mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <span key={d} className="w-8 text-center">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} className="w-8 h-8" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const status = heatmapData[day] || "Present";
                const color = heatmapColors[status] || "bg-muted";
                return (
                  <div
                    key={day}
                    className={`w-8 h-8 rounded-sm ${color} flex items-center justify-center text-[10px] font-medium text-primary-foreground cursor-default`}
                    title={`${day} ${monthLabel} — ${status}`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4">
              {Object.entries(heatmapColors).map(([label, cls]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${cls}`} />
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Attendance;
