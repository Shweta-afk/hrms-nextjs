'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Lock } from 'lucide-react'

interface PayrollUnlockState {
  /** Whether a payroll password has been configured for this org yet. */
  isSet: boolean
  /** Whether THIS browser currently has salary views unlocked. */
  unlocked: boolean
  /** True until the first status check completes. */
  loading: boolean
  /** Open the unlock (or first-time setup) prompt. */
  requestUnlock: () => void
  /** Re-lock immediately, without waiting for the 30-min timeout. */
  lock: () => Promise<void>
  refresh: () => Promise<void>
}

const PayrollUnlockCtx = createContext<PayrollUnlockState | null>(null)

export function usePayrollUnlock(): PayrollUnlockState {
  const ctx = useContext(PayrollUnlockCtx)
  if (!ctx) throw new Error('usePayrollUnlock must be used within PayrollUnlockProvider')
  return ctx
}

export function PayrollUnlockProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  // Only the shared hr_admin login needs this gate — employees viewing their
  // own approved payslip never hit it.
  const relevant = status === 'authenticated' && session?.user?.role === 'hr_admin'

  const [isSet, setIsSet] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!relevant) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/payroll-access')
      const json = await res.json()
      if (json.success) {
        setIsSet(json.data.isSet)
        setUnlocked(json.data.unlocked)
      }
    } finally {
      setLoading(false)
    }
  }, [relevant])

  useEffect(() => { refresh() }, [refresh])

  const lock = useCallback(async () => {
    if (!relevant) return
    await fetch('/api/payroll-access', { method: 'DELETE' })
    setUnlocked(false)
  }, [relevant])

  const requestUnlock = useCallback(() => setDialogOpen(true), [])

  return (
    <PayrollUnlockCtx.Provider value={{ isSet, unlocked, loading, requestUnlock, lock, refresh }}>
      {children}
      {relevant && (
        <PayrollUnlockDialog
          open={dialogOpen}
          isSet={isSet}
          onOpenChange={setDialogOpen}
          onUnlocked={() => { setUnlocked(true); setIsSet(true); setDialogOpen(false) }}
        />
      )}
    </PayrollUnlockCtx.Provider>
  )
}

function PayrollUnlockDialog({
  open, isSet, onOpenChange, onUnlocked,
}: {
  open: boolean
  isSet: boolean
  onOpenChange: (open: boolean) => void
  onUnlocked: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) { setPassword(''); setConfirm(''); setSubmitting(false) }
  }, [open])

  const submitUnlock = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/payroll-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (json.success) {
        onUnlocked()
      } else {
        toast.error(json.error || 'Incorrect payroll password')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitFirstTimeSetup = async () => {
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirm) { toast.error("Passwords don't match"); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/payroll-access/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      })
      const json = await res.json()
      if (json.success) {
        // First-time setup implies you know it — go ahead and unlock now too.
        const unlockRes = await fetch('/api/payroll-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })
        const unlockJson = await unlockRes.json()
        if (unlockJson.success) onUnlocked()
        toast.success('Payroll password set')
      } else {
        toast.error(json.error || 'Could not set payroll password')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> {isSet ? 'Unlock payroll access' : 'Set up payroll access'}
          </DialogTitle>
          <DialogDescription>
            {isSet
              ? 'This login is shared. Enter the payroll password to view salary and compensation data.'
              : 'No payroll password is set yet. Set one now — only people who know it will be able to see salary data on this account.'}
          </DialogDescription>
        </DialogHeader>

        {isSet ? (
          <div className="space-y-1.5">
            <Label htmlFor="payroll-password">Payroll password</Label>
            <Input
              id="payroll-password"
              type="password"
              value={password}
              autoFocus
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && password) submitUnlock() }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="payroll-new-password">New payroll password</Label>
              <Input
                id="payroll-new-password"
                type="password"
                value={password}
                autoFocus
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payroll-confirm-password">Confirm password</Label>
              <Input
                id="payroll-confirm-password"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && password && confirm) submitFirstTimeSetup() }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            onClick={isSet ? submitUnlock : submitFirstTimeSetup}
            disabled={submitting || !password || (!isSet && !confirm)}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {isSet ? 'Unlock' : 'Set password & unlock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
