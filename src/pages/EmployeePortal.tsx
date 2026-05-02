import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  CalendarDays,
  Download,
  Clock,
  FileText,
  User,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  LogOut,
  Settings,
  Megaphone,
  ArrowRight,
  CalendarCheck,
  CreditCard,
  Shield,
} from "lucide-react";

/* ─── data ─── */

const weekDays = [
  { day: "Mon", date: "24 Mar", status: "Present", inTime: "09:02", outTime: "18:15" },
  { day: "Tue", date: "25 Mar", status: "Present", inTime: "08:55", outTime: "18:30" },
  { day: "Wed", date: "26 Mar", status: "Leave", inTime: "—", outTime: "—" },
  { day: "Thu", date: "27 Mar", status: "Present", inTime: "09:10", outTime: "18:05" },
  { day: "Fri", date: "28 Mar", status: "Present", inTime: "09:00", outTime: "—", isToday: true },
];

const leaveBalances = [
  { type: "Casual Leave", used: 4, total: 12, color: "bg-blue-500" },
  { type: "Sick Leave", used: 0, total: 12, color: "bg-green-500" },
  { type: "Earned Leave", used: 2, total: 20, color: "bg-orange-500" },
  { type: "Maternity Leave", used: 0, total: 180, color: "bg-pink-500" },
];

const recentActivity = [
  { icon: CalendarCheck, text: "Leave approved — Casual Leave, 26 Mar", time: "2 hours ago", color: "text-green-600" },
  { icon: CreditCard, text: "Payslip generated for February 2026", time: "3 days ago", color: "text-blue-600" },
  { icon: User, text: "Profile updated — emergency contact added", time: "1 week ago", color: "text-purple-600" },
  { icon: Shield, text: "IT Declaration submitted for FY 2025-26", time: "2 weeks ago", color: "text-orange-600" },
  { icon: CalendarCheck, text: "Leave approved — Sick Leave, 12 Mar", time: "2 weeks ago", color: "text-green-600" },
];

const quickActions = [
  { label: "Apply for Leave", icon: CalendarDays, href: "/leave/apply", color: "bg-blue-50 dark:bg-blue-950/40", iconColor: "text-blue-600", ring: "ring-blue-200 dark:ring-blue-800" },
  { label: "Download Payslip", icon: Download, href: "/payslip", color: "bg-green-50 dark:bg-green-950/40", iconColor: "text-green-600", ring: "ring-green-200 dark:ring-green-800" },
  { label: "View Attendance", icon: Clock, href: "/attendance", color: "bg-indigo-50 dark:bg-indigo-950/40", iconColor: "text-indigo-600", ring: "ring-indigo-200 dark:ring-indigo-800" },
  { label: "Raise IT Declaration", icon: FileText, href: "#", color: "bg-orange-50 dark:bg-orange-950/40", iconColor: "text-orange-600", ring: "ring-orange-200 dark:ring-orange-800" },
  { label: "Update Profile", icon: User, href: "#", color: "bg-purple-50 dark:bg-purple-950/40", iconColor: "text-purple-600", ring: "ring-purple-200 dark:ring-purple-800" },
  { label: "Raise a Request", icon: HelpCircle, href: "#", color: "bg-muted", iconColor: "text-muted-foreground", ring: "ring-border" },
];

const announcements = [
  {
    title: "Holiday on 14 Apr — Dr. Ambedkar Jayanti",
    date: "25 Mar 2026",
    text: "Please note that 14th April 2026 (Tuesday) will be a company holiday on account of Dr. B.R. Ambedkar Jayanti. Plan your deliverables accordingly.",
  },
  {
    title: "Annual Health Check-up Registration Open",
    date: "22 Mar 2026",
    text: "Registrations for the annual health check-up are now open. Visit the HR portal or contact hr@acmetech.in to book your slot before 10th April.",
  },
];

const navLinks = [
  { label: "Home", href: "/portal" },
  { label: "My Profile", href: "#" },
  { label: "Leave", href: "/leave/apply" },
  { label: "Attendance", href: "/attendance" },
  { label: "Payslips", href: "/payslip" },
  { label: "Help", href: "#" },
];

/* ─── status chip ─── */

const StatusChip = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    Present: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    Leave: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    Absent: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
};

/* ─── page ─── */

const EmployeePortal = () => {
  const [activeNav, setActiveNav] = useState("Home");

  return (
    <div className="min-h-screen bg-muted/40">
      {/* ─── Top Nav ─── */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold tracking-tight text-foreground">Acme HRMS</span>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  onClick={() => setActiveNav(l.label)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeNav === l.label
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
              <Bell className="h-[18px] w-[18px] text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">RS</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground hidden sm:inline">Rahul Sharma</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem><User className="mr-2 h-4 w-4" /> My Profile</DropdownMenuItem>
                <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> Log Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* ─── Hero ─── */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 via-card to-card">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Good morning, Rahul 👋</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Senior Software Engineer · Engineering · Saturday, 29 March 2026
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Present today
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> 8 leave days remaining
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Payslip available for Feb 2026
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Quick Actions ─── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((a) => (
              <Link key={a.label} href={a.href}>
                <Card className={`h-full border hover:shadow-md transition-shadow cursor-pointer group ring-1 ${a.ring} border-transparent`}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                    <div className={`h-12 w-12 rounded-xl ${a.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <a.icon className={`h-6 w-6 ${a.iconColor}`} />
                    </div>
                    <span className="text-sm font-medium text-foreground leading-tight">{a.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Attendance This Week ─── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">My Attendance This Week</h2>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-5 gap-2">
                {weekDays.map((d) => (
                  <div
                    key={d.day}
                    className={`rounded-xl p-3 text-center space-y-1.5 border-2 transition-colors ${
                      d.isToday
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/50"
                    }`}
                  >
                    <p className="text-xs font-semibold text-muted-foreground">{d.day}</p>
                    <p className="text-sm font-bold text-foreground">{d.date}</p>
                    <StatusChip status={d.status} />
                    <div className="text-[10px] text-muted-foreground pt-1 space-y-0.5">
                      <p>In: {d.inTime}</p>
                      <p>Out: {d.outTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ─── Leave Balance + Recent Activity ─── */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Leave Balance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">My Leave Balance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {leaveBalances.map((l) => (
                <div key={l.type} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">{l.type}</span>
                    <span className="text-muted-foreground">
                      {l.total - l.used} / {l.total} available
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${l.color} transition-all`}
                      style={{ width: `${((l.total - l.used) / l.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0`}>
                        <a.icon className={`h-4 w-4 ${a.color}`} />
                      </div>
                      {i < recentActivity.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm text-foreground">{a.text}</p>
                      <p className="text-xs text-muted-foreground">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Announcements ─── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Announcements
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {announcements.map((a, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground mb-1">{a.date}</p>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{a.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a.text}</p>
                  <Button variant="link" className="px-0 mt-2 h-auto text-xs">
                    Read more <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-4 text-xs text-muted-foreground border-t">
          © 2026 Acme Technologies Pvt. Ltd. · Need help? Contact hr@acmetech.in
        </footer>
      </main>
    </div>
  );
};

export default EmployeePortal;
