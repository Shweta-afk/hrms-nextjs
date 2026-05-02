'use client'

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
} from "lucide-react"
import { NavLink } from "@/components/NavLink"
import { signOut, useSession } from "next-auth/react"

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { title: "Employees", icon: Users, path: "/employees" },
  { title: "Attendance", icon: Clock, path: "/attendance" },
  { title: "Leave", icon: CalendarDays, path: "/leave" },
  { title: "Payroll", icon: Wallet, path: "/payroll" },
  { title: "Recruitment", icon: UserPlus, path: "/recruitment" },
  { title: "Analytics", icon: BarChart3, path: "/analytics" },
  { title: "Settings", icon: Settings, path: "/settings" },
]

const AppSidebar = () => {
  const { data: session } = useSession()

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
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/dashboard"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground"
            activeClassName="bg-sidebar-active text-primary-foreground border-l-[3px] border-primary-foreground"
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span>{item.title}</span>
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