'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  Home, CalendarDays, Clock, Download, User,
  LogOut, Settings, ChevronDown, Sun, Moon,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Home',       href: '/portal',             icon: Home },
  { label: 'Leave',      href: '/portal/leave',        icon: CalendarDays },
  { label: 'Attendance', href: '/portal/attendance',   icon: Clock },
  { label: 'Payslips',   href: '/payslip',             icon: Download },
  { label: 'Profile',    href: '/portal/profile',      icon: User },
]

function ThemeBtn() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === 'dark'
  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
    >
      <Sun className={`h-[18px] w-[18px] text-muted-foreground transition-all ${isDark ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`} />
      <Moon className={`absolute h-[18px] w-[18px] text-muted-foreground transition-all ${isDark ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
    </button>
  )
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  const email = session?.user?.email ?? ''
  const firstName = email.split('@')[0] ?? 'Employee'
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-muted/40">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">

          {/* Logo + desktop nav */}
          <div className="flex items-center gap-6">
            <Link href="/portal" className="shrink-0">
              <img src="/lightmodelogo.webp" alt="Axiotta HRMS" className="h-7 w-auto object-contain dark:hidden" />
              <img src="/darkmodelogo.webp"  alt="Axiotta HRMS" className="h-7 w-auto object-contain hidden dark:block" />
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(l => {
                const active = l.href === '/portal'
                  ? pathname === '/portal'
                  : pathname?.startsWith(l.href)
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {l.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right side: theme + user menu */}
          <div className="flex items-center gap-1">
            <ThemeBtn />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors ml-1">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground hidden sm:inline">{firstName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {session?.user?.role === 'hr_admin' && (
                  <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                    <Settings className="mr-2 h-4 w-4" /> HR Dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => router.push('/portal/profile')}>
                  <User className="mr-2 h-4 w-4" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Page content — padded bottom on mobile for the tab bar ── */}
      <main className="pb-20 md:pb-0">
        {children}
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur md:hidden safe-bottom">
        <div className="flex items-stretch justify-around">
          {NAV_LINKS.map(item => {
            const active = item.href === '/portal'
              ? pathname === '/portal'
              : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 min-w-0 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', active && 'stroke-[2.5]')} />
                <span className={cn('text-[10px] font-medium leading-none', active && 'font-semibold')}>
                  {item.label}
                </span>
                {active && (
                  <span className="absolute bottom-0 block h-0.5 w-10 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
