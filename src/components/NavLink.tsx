'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface NavLinkCompatProps {
  to: string
  className?: string
  activeClassName?: string
  children?: React.ReactNode
  end?: boolean
  [key: string]: any
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, to, end, children, ...props }, ref) => {
    const pathname = usePathname()
    const isActive = end ? pathname === to : (pathname ?? '').startsWith(to)

    return (
      <Link
        ref={ref}
        href={to}
        className={cn(className, isActive && activeClassName)}
        {...props}
      >
        {children}
      </Link>
    )
  }
)

NavLink.displayName = 'NavLink'
export { NavLink }