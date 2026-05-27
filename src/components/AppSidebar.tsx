'use client'

import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Wallet,
  UserPlus,
  BarChart3,
  Settings,
  LogOut,
  CreditCard,
  ChevronDown,
  Radio,
  FileBarChart2,
  Receipt,
  Inbox,
} from 'lucide-react'
import { NavLink } from '@/components/NavLink'
import { signOut, useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const topNavItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', end: true },
  { title: 'Employees',   icon: Users,          path: '/employees' },
]

const bottomNavItems = [
  { title: 'Leave',           icon: CalendarDays,   path: '/leave' },
  { title: 'Requests',        icon: Inbox,          path: '/requests', adminOnly: true },
  { title: 'Payroll',         icon: Wallet,         path: '/payroll' },
  { title: 'Reimbursements',  icon: Receipt,        path: '/reimbursements', adminOnly: true },
  { title: 'Recruitment',     icon: UserPlus,       path: '/recruitment' },
  { title: 'Analytics',       icon: BarChart3,      path: '/analytics' },
  { title: 'Settings',        icon: Settings,       path: '/settings' },
  { title: 'Billing',         icon: CreditCard,     path: '/billing' },
]

const navLinkClass =
  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground'
const navLinkActive =
  'bg-sidebar-active text-primary-foreground border-l-[3px] border-primary-foreground'

const AppSidebar = () => {
  const { data: session } = useSession()
  const pathname = usePathname()

  const isOnAttendance = Boolean(pathname?.startsWith('/attendance'))
  const [attendanceOpen, setAttendanceOpen] = useState(isOnAttendance)
  const [openRequests, setOpenRequests] = useState(0)

  useEffect(() => {
    if (pathname?.startsWith('/attendance')) setAttendanceOpen(true)
  }, [pathname])

  useEffect(() => {
    if (session?.user?.role !== 'hr_admin') return
    fetch('/api/requests?status=open&limit=1')
      .then(r => r.json())
      .then(j => { if (j.success) setOpenRequests(j.data.total) })
      .catch(() => {})
  }, [session?.user?.role])

  const initials = session?.user?.email
    ? session.user.email.substring(0, 2).toUpperCase()
    : 'HR'

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-sidebar text-sidebar-foreground shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-16 border-b border-sidebar-border">
        <span className="text-xl font-bold tracking-tight">KYZEN</span>
        <span className="text-[10px] font-semibold bg-primary px-1.5 py-0.5 rounded text-primary-foreground uppercase tracking-wider">
          Pro
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Top items: Dashboard, Employees */}
        {topNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={navLinkClass}
            activeClassName={navLinkActive}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span>{item.title}</span>
          </NavLink>
        ))}

        {/* Attendance — collapsible group */}
        <div>
          <button
            onClick={() => setAttendanceOpen((v) => !v)}
            className={cn(
              navLinkClass,
              'w-full justify-between',
              isOnAttendance && 'text-sidebar-foreground'
            )}
          >
            <div className="flex items-center gap-3">
              <Clock className="h-[18px] w-[18px] shrink-0" />
              <span>Attendance</span>
            </div>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200 opacity-60',
                attendanceOpen && 'rotate-180'
              )}
            />
          </button>

          {attendanceOpen && (
            <div className="ml-7 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
              {/* Monthly View */}
              <NavLink
                to="/attendance"
                end
                className="flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/60 hover:bg-sidebar-hover hover:text-sidebar-foreground"
                activeClassName="text-sidebar-foreground bg-sidebar-hover"
              >
                <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" />
                Monthly View
              </NavLink>

              {/* Live View with pulsing red dot */}
              <NavLink
                to="/attendance/live"
                end
                className="flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/60 hover:bg-sidebar-hover hover:text-sidebar-foreground"
                activeClassName="text-sidebar-foreground bg-sidebar-hover"
              >
                <Radio className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span>Live View</span>
                <span className="ml-auto relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
              </NavLink>

              {/* Reports */}
              <NavLink
                to="/attendance/reports"
                end
                className="flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/60 hover:bg-sidebar-hover hover:text-sidebar-foreground"
                activeClassName="text-sidebar-foreground bg-sidebar-hover"
              >
                <FileBarChart2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                Reports
              </NavLink>
            </div>
          )}
        </div>

        {/* Remaining nav items */}
        {bottomNavItems
          .filter(item => !('adminOnly' in item && item.adminOnly) || session?.user?.role === 'hr_admin')
          .map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={navLinkClass}
            activeClassName={navLinkActive}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1">{item.title}</span>
            {item.path === '/requests' && openRequests > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                {openRequests > 99 ? '99+' : openRequests}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User area */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {session?.user?.email ?? 'HR Admin'}
            </p>
            <span className="text-[10px] bg-sidebar-hover px-1.5 py-0.5 rounded font-medium text-sidebar-foreground/80">
              {session?.user?.role ?? 'hr_admin'}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 rounded hover:bg-sidebar-hover transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default AppSidebar
