'use client'

import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePayrollUnlock } from '@/contexts/PayrollUnlockContext'

/** Full-page lock screen — wrap an entire salary-bearing page/tab with this. */
export function PayrollGate({ children }: { children: React.ReactNode }) {
  const { unlocked, loading, requestUnlock } = usePayrollUnlock()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <div className="rounded-full bg-muted p-3"><Lock className="h-6 w-6 text-muted-foreground" /></div>
        <p className="font-medium">Payroll access is locked</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page shows salary and compensation data. Enter the payroll password to continue.
        </p>
        <Button onClick={requestUnlock}>Unlock</Button>
      </div>
    )
  }

  return <>{children}</>
}

/** Small "Lock payroll" action to drop into an already-unlocked salary page/section. */
export function PayrollLockButton({ className }: { className?: string }) {
  const { unlocked, lock } = usePayrollUnlock()
  if (!unlocked) return null
  return (
    <Button variant="ghost" size="sm" onClick={lock} className={className}>
      <Lock className="mr-1 h-3.5 w-3.5" /> Lock
    </Button>
  )
}

/**
 * Inline placeholder for a single salary field/row inside an otherwise-visible
 * page (employee profile, add-employee form). Swap the real field for this
 * when `usePayrollUnlock().unlocked` is false.
 */
export function PayrollLockedInline({ label = 'Locked — click to unlock', className }: { label?: string; className?: string }) {
  const { requestUnlock } = usePayrollUnlock()
  return (
    <button
      type="button"
      onClick={requestUnlock}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md border border-dashed px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <Lock className="h-3.5 w-3.5 shrink-0" /> {label}
    </button>
  )
}
