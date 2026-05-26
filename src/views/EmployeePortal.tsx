'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell, CalendarDays, Download, Clock, FileText, User, HelpCircle,
  CheckCircle2, ChevronDown, LogOut, Settings, Megaphone, ArrowRight,
  CalendarCheck, CreditCard, Shield, Loader2, X,
} from "lucide-react";
import { toast } from "sonner";
import { signOut, useSession } from "next-auth/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface LeaveBalance {
  leave_type_id: string;
  name: string;
  code: string;
  total: number;
  taken: number;
  available: number;
  is_paid: boolean;
}

interface AttendanceRecord {
  id: string;
  date: string;
  first_in: string | null;
  last_out: string | null;
  status: string;
  is_late: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  link: string | null;
}

interface Payslip {
  id: string;
  month: number;
  year: number;
  net_salary: number;
  is_published: boolean;
}

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const StatusChip = ({ status, isLate }: { status: string; isLate: boolean }) => {
  const label = isLate ? 'Late' : status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
  const map: Record<string, string> = {
    present: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300',
    late: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400',
    absent: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400',
    Leave: 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400',
  }
  const key = isLate ? 'late' : status
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${map[key] ?? 'bg-muted text-muted-foreground'}`}>
      {label}
    </span>
  )
}

const colorMap: Record<string, string> = {
  CL: 'bg-blue-500', SL: 'bg-green-500', EL: 'bg-orange-500', ML: 'bg-pink-500', LOP: 'bg-red-400',
}

const EmployeePortal = () => {
  const { data: session } = useSession()
  const router = useRouter()

  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [latestPayslip, setLatestPayslip] = useState<Payslip | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileIncomplete, setProfileIncomplete] = useState<string[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [requestModal, setRequestModal] = useState(false)
  const [requestType, setRequestType] = useState('')
  const [requestSubject, setRequestSubject] = useState('')
  const [requestDesc, setRequestDesc] = useState('')
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [holidays, setHolidays] = useState<{ id: string; name: string; date: string; type: string }[]>([])

  const now = new Date()
  const dayName = now.toLocaleDateString('en-IN', { weekday: 'long' })
  const fullDate = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  async function fetchPortalData() {
    setLoading(true)
    try {
      const [balanceRes, attendanceRes, notifRes, payslipRes] = await Promise.all([
        fetch('/api/leave/balance'),
        fetch(`/api/attendance?month=${now.getMonth() + 1}&year=${now.getFullYear()}&limit=7`),
        fetch('/api/notifications'),
        fetch('/api/payroll/payslips?limit=1'),
      ])
      // Profile completeness check
      if (session?.user?.employee_id) {
        try {
          const empRes = await fetch(`/api/employees/${session.user.employee_id}`)
          const empJson = await empRes.json()
          if (empJson.success) {
            const missing: string[] = []
            if (!empJson.data.bank_details?.account_number) missing.push('Bank details')
            if (!empJson.data.statutory_info?.pan) missing.push('PAN / Statutory info')
            if (!empJson.data.phone) missing.push('Phone number')
            setProfileIncomplete(missing)
          }
        } catch { /* non-critical */ }
      }
      const holidayRes = await fetch('/api/holidays')
      const holidayJson = await holidayRes.json()
      if (holidayJson.success) setHolidays(holidayJson.data.slice(0, 3))
      const [balanceJson, attendanceJson, notifJson, payslipJson] = await Promise.all([
        balanceRes.json(), attendanceRes.json(), notifRes.json(), payslipRes.json(),
      ])

      if (balanceJson.success) setLeaveBalances(balanceJson.data.filter((l: LeaveBalance) => l.is_paid && l.total > 0))
      if (attendanceJson.success) setAttendance(attendanceJson.data.records.slice(0, 7))
      if (notifJson.success) {
        setNotifications(notifJson.data.notifications)
        setUnreadCount(notifJson.data.unread_count)
      }
      if (payslipJson.success && payslipJson.data.length > 0) {
        setLatestPayslip(payslipJson.data[0])
      }
    } catch {
      toast.error('Failed to load portal data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPortalData() }, [])

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function handleSubmitRequest() {
      if (!requestType || !requestSubject || !requestDesc) {
        toast.error('Please fill all fields')
        return
      }
      setRequestSubmitting(true)
      try {
        const res = await fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: requestType, subject: requestSubject, description: requestDesc }),
        })
        const json = await res.json()
        if (json.success) {
          toast.success('Request submitted — HR will get back to you shortly')
          setRequestModal(false)
          setRequestType('')
          setRequestSubject('')
          setRequestDesc('')
        } else {
          toast.error('Failed to submit request')
        }
      } catch {
        toast.error('Failed to submit request')
      } finally {
        setRequestSubmitting(false)
      }
    }

  const todayAttendance = attendance.find(a =>
    new Date(a.date).toDateString() === now.toDateString()
  )

  // Get last 5 weekdays for attendance display
  const weekDays = []
  let d = new Date(now)
  let count = 0
  while (count < 5) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      const rec = attendance.find(a => new Date(a.date).toDateString() === d.toDateString())
      weekDays.unshift({
        day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        status: rec ? (rec.is_late ? 'Late' : rec.status) : 'Absent',
        isLate: rec?.is_late ?? false,
        inTime: rec ? formatTime(rec.first_in) : '—',
        outTime: rec ? formatTime(rec.last_out) : '—',
        isToday: d.toDateString() === now.toDateString(),
        rawStatus: rec?.status ?? 'absent',
      })
      count++
    }
    d = new Date(d)
    d.setDate(d.getDate() - 1)
  }

  const quickActions = [
    { label: 'Apply for Leave', icon: CalendarDays, href: '/leave/apply', color: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800' },
    { label: 'Download Payslip', icon: Download, href: '/payslip', color: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-400', ring: 'ring-green-200 dark:ring-green-800' },
    { label: 'View Attendance', icon: Clock, href: '/portal/attendance', color: 'bg-indigo-50 dark:bg-indigo-900/20', iconColor: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-200 dark:ring-indigo-800' },
    { label: 'Company Policies', icon: FileText, href: '/portal/policy', color: 'bg-orange-50 dark:bg-orange-900/20', iconColor: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-200 dark:ring-orange-800' },
    { label: 'Update Profile', icon: User, href: '/portal/profile', color: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600 dark:text-purple-400', ring: 'ring-purple-200 dark:ring-purple-800' },
    { label: 'Raise a Request', icon: HelpCircle, href: '#request', color: 'bg-muted', iconColor: 'text-muted-foreground', ring: 'ring-border' },
  ]

  const userInitials = session?.user?.email
    ? session.user.email.substring(0, 2).toUpperCase()
    : 'HR'

  const userName = session?.user?.email?.split('@')[0] ?? 'User'

  return (
    <div className="min-h-screen bg-muted/40">

      {/* Top Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold tracking-tight text-foreground">HRMS Portal</span>
            <nav className="hidden md:flex items-center gap-1">
              {[
                { label: 'Home', href: '/portal' },
                { label: 'Leave', href: '/leave/apply' },
                { label: 'Attendance', href: '/attendance' },
                { label: 'Payslips', href: '/payslip' },
              ].map(l => (
                <Link key={l.label} href={l.href}
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(p => !p)}
                className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              >
                <Bell className="h-[18px] w-[18px] text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-[9px] text-white flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="font-semibold text-sm">Notifications</span>
                    <div className="flex gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
                      )}
                      <button onClick={() => setNotifOpen(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id}
                          className={`px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted ${!n.is_read ? 'bg-muted/40' : ''}`}
                          onClick={() => { if (n.link) router.push(n.link); setNotifOpen(false) }}
                        >
                          <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">{userInitials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground hidden sm:inline capitalize">{userName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                  <Settings className="mr-2 h-4 w-4" /> HR Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => signOut({ callbackUrl: '/login' })}>
                  <LogOut className="mr-2 h-4 w-4" /> Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Hero */}
            <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 via-card to-card">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}, {userName} 👋
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {dayName}, {fullDate}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {todayAttendance && (
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Present today
                      </Badge>
                    )}
                    {leaveBalances[0] && (
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                        <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                        {leaveBalances[0].available} {leaveBalances[0].code} days remaining
                      </Badge>
                    )}
                    {latestPayslip && (
                      <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Payslip for {monthNames[latestPayslip.month - 1]} {latestPayslip.year} available
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile completeness banner */}
            {profileIncomplete.length > 0 && (
              <Link href="/portal/profile">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-kpi-amber/40 bg-kpi-amber/8 px-4 py-3 cursor-pointer hover:bg-kpi-amber/15 transition-colors">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-kpi-amber shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Complete your profile</p>
                      <p className="text-xs text-muted-foreground">Missing: {profileIncomplete.join(', ')} — required for salary processing</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            )}

            {/* Quick Actions */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {quickActions.map(a => (
                  <div key={a.label} onClick={() => a.href === '#request' ? setRequestModal(true) : null}>
                    <Link href={a.href === '#request' ? '#' : a.href}>
                      <Card className={`h-full border hover:shadow-md transition-shadow cursor-pointer group ring-1 ${a.ring} border-transparent`}>
                        <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                          <div className={`h-12 w-12 rounded-xl ${a.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <a.icon className={`h-6 w-6 ${a.iconColor}`} />
                          </div>
                          <span className="text-sm font-medium text-foreground leading-tight">{a.label}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                ))}
              </div>
            </section>

            {/* Attendance This Week */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">My Attendance This Week</h2>
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-5 gap-2">
                    {weekDays.map((d, i) => (
                      <div key={i}
                        className={`rounded-xl p-3 text-center space-y-1.5 border-2 transition-colors ${d.isToday ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50'}`}
                      >
                        <p className="text-xs font-semibold text-muted-foreground">{d.day}</p>
                        <p className="text-sm font-bold text-foreground">{d.date}</p>
                        <StatusChip status={d.rawStatus} isLate={d.isLate} />
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

            {/* Leave Balance + Notifications */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">My Leave Balance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {leaveBalances.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No leave types configured</p>
                  ) : (
                    leaveBalances.map(l => (
                      <div key={l.leave_type_id} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground font-medium">{l.name}</span>
                          <span className="text-muted-foreground">{l.available} / {l.total} available</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colorMap[l.code] ?? 'bg-primary'} transition-all`}
                            style={{ width: `${l.total > 0 ? (l.available / l.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recent Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No notifications</p>
                  ) : (
                    <div className="space-y-3">
                      {notifications.slice(0, 5).map((n, i) => (
                        <div key={n.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <Bell className={`h-4 w-4 ${n.type === 'success' ? 'text-green-600' : n.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}`} />
                            </div>
                            {i < Math.min(notifications.length, 5) - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                          </div>
                          <div className="pb-3">
                            <p className={`text-sm ${!n.is_read ? 'font-semibold' : ''} text-foreground`}>{n.title}</p>
                            <p className="text-xs text-muted-foreground">{n.message}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Announcements */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" /> Upcoming Holidays
              </h2>
              {holidays.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    No upcoming holidays
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {holidays.map((h: any) => (
                    <Card key={h.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                            <h3 className="text-sm font-semibold text-foreground">{h.name}</h3>
                          </div>
                          <Badge variant="secondary" className="text-[10px] capitalize">{h.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {Math.ceil((new Date(h.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days away
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <footer className="text-center py-4 text-xs text-muted-foreground border-t">
              © 2026 HRMS · Need help? Contact hr@company.in
            </footer>

            {/* Raise a Request Modal */}
            <Dialog open={requestModal} onOpenChange={setRequestModal}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Raise a Request</DialogTitle>
                  <DialogDescription>Submit a request to HR. They'll get back to you shortly.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Request Type *</Label>
                    <Select value={requestType} onValueChange={setRequestType}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Salary Query">Salary Query</SelectItem>
                        <SelectItem value="Leave Query">Leave Query</SelectItem>
                        <SelectItem value="Document Request">Document Request</SelectItem>
                        <SelectItem value="IT Declaration">IT Declaration Help</SelectItem>
                        <SelectItem value="Policy Query">Policy Query</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subject *</Label>
                    <Input value={requestSubject} onChange={e => setRequestSubject(e.target.value)} placeholder="Brief subject of your request" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description *</Label>
                    <Textarea value={requestDesc} onChange={e => setRequestDesc(e.target.value)} placeholder="Describe your request in detail..." rows={4} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRequestModal(false)}>Cancel</Button>
                  <Button onClick={handleSubmitRequest} disabled={requestSubmitting}>
                    {requestSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : 'Submit Request'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>
    </div>
  )
}

export default EmployeePortal