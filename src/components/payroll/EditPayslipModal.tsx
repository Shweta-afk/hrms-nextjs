'use client'

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Plus, Trash2, Loader2, Save, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

/**
 * Per-payslip line-item editor. Lets HR overwrite Basic / HRA / PF / ESI / PT
 * / TDS or any custom row directly — no Excel round-trip. Sends only the
 * breakdown to the server, which recomputes gross / total_ded / net so the
 * canonical totals are computed once on the server, never duplicated in two
 * places.
 *
 * Reused from Payroll.tsx via a `<EditPayslipModal payslip={p} ... />` mount
 * — controlled `open` state on the parent so closing the dialog doesn't
 * lose half-typed edits if HR accidentally clicks outside (the parent
 * decides when to close).
 */

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

interface PayslipShape {
  id: string
  employee: { first_name: string; last_name: string; emp_code: string }
  month: number
  year: number
  earnings:   Record<string, number>
  deductions: Record<string, number>
  hr_approved_at?: string | null
}

interface Props {
  payslip:     PayslipShape | null
  open:        boolean
  onOpenChange: (open: boolean) => void
  onSaved:     () => void   // parent re-fetches payroll data
}

// Each row is a label + value pair. We use an array (not a Map) so the order
// HR sees stays stable as they type — a Record/Map would re-render with
// reshuffled keys, jumping the focus around.
interface Row { id: number; label: string; amount: string }

let nextRowId = 1
const makeRow = (label: string = '', amount: number | string = ''): Row => ({
  id: nextRowId++,
  label,
  amount: typeof amount === 'number' ? String(amount) : amount,
})

const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const EditPayslipModal = ({ payslip, open, onOpenChange, onSaved }: Props) => {
  const [earningRows,   setEarningRows]   = useState<Row[]>([])
  const [deductionRows, setDeductionRows] = useState<Row[]>([])
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset form state every time a new payslip is loaded into the dialog.
  // Without this, opening the dialog for employee A then closing and
  // reopening for employee B would carry over A's edits.
  useEffect(() => {
    if (!payslip) return
    setEarningRows(
      Object.entries(payslip.earnings)
        .filter(([, v]) => v !== 0) // skip zero lines that survived earlier saves
        .map(([k, v]) => makeRow(k, v))
    )
    setDeductionRows(
      Object.entries(payslip.deductions)
        .filter(([, v]) => v !== 0)
        .map(([k, v]) => makeRow(k, v))
    )
    setReason('')
  }, [payslip])

  // Live totals — recompute on every keystroke so HR sees the new Net
  // before they save. Float-safe: parse, default to 0.
  const totals = useMemo(() => {
    const sumRows = (rows: Row[]) =>
      rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0)
    const gross    = sumRows(earningRows)
    const totalDed = sumRows(deductionRows)
    return { gross, totalDed, net: gross - totalDed }
  }, [earningRows, deductionRows])

  if (!payslip) return null

  const isApproved = !!payslip.hr_approved_at
  const monthLabel = `${monthLabels[payslip.month - 1]} ${payslip.year}`

  function updateRow(side: 'earn' | 'ded', id: number, patch: Partial<Row>) {
    const setter = side === 'earn' ? setEarningRows : setDeductionRows
    setter(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r))
  }
  function removeRow(side: 'earn' | 'ded', id: number) {
    const setter = side === 'earn' ? setEarningRows : setDeductionRows
    setter(rows => rows.filter(r => r.id !== id))
  }
  function addRow(side: 'earn' | 'ded') {
    const setter = side === 'earn' ? setEarningRows : setDeductionRows
    setter(rows => [...rows, makeRow()])
  }

  async function handleSave() {
    // Guard for TS — handleSave is defined before the early `return null` at
    // the JSX boundary, so the compiler can't narrow `payslip` here. In
    // practice the Save button only renders when payslip is non-null, but
    // we re-check explicitly to keep the type-flow honest.
    if (!payslip) return
    if (reason.trim().length < 10) {
      toast.error('Reason is required (at least 10 characters)')
      return
    }
    // Collapse rows to {label: amount}. Server also filters zero / negative
    // / blank labels, but we do it client-side too so the request payload
    // matches what'll actually be stored.
    const collapse = (rows: Row[]) => {
      const out: Record<string, number> = {}
      for (const r of rows) {
        const label = r.label.trim()
        const amt = Number(r.amount)
        if (!label || !Number.isFinite(amt) || amt <= 0) continue
        out[label] = Math.round(amt)
      }
      return out
    }
    const earnings   = collapse(earningRows)
    const deductions = collapse(deductionRows)

    setSaving(true)
    try {
      const res = await fetch(`/api/payroll/payslips/${payslip.id}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ earnings, deductions, reason: reason.trim() }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error); return }
      toast.success(`Payslip updated — Net: ${fmt(json.data.net_salary)}`)
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('Failed to save payslip')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Payslip — {payslip.employee.first_name} {payslip.employee.last_name}
            <span className="ml-2 text-sm text-muted-foreground font-normal">
              ({payslip.employee.emp_code} · {monthLabel})
            </span>
          </DialogTitle>
          <DialogDescription>
            Edit any earning or deduction line item directly. Net Salary
            recomputes automatically from the line items. Changes save
            straight to the payslip — no Excel needed.
          </DialogDescription>
        </DialogHeader>

        {isApproved ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-900/15 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              This payslip is HR-approved. <b>Unapprove it from the payroll
              page</b> (row → status badge → Unapprove) before editing line
              items. This prevents silently mutating a payslip that was
              already shared with the employee.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ── Earnings ───────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Earnings</h3>
                  <Button variant="ghost" size="sm" onClick={() => addRow('earn')}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {earningRows.map(r => (
                    <div key={r.id} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
                      <Input
                        value={r.label}
                        onChange={e => updateRow('earn', r.id, { label: e.target.value })}
                        placeholder="Component (e.g. Basic, HRA)"
                        className="h-9"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={r.amount}
                        onChange={e => updateRow('earn', r.id, { amount: e.target.value })}
                        placeholder="0"
                        className="h-9 text-right tabular-nums"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow('earn', r.id)}
                        title="Remove this line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {earningRows.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No earning components — click Add to create one.</p>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 mt-3">
                  <span className="text-sm font-semibold text-foreground">Gross</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(totals.gross)}</span>
                </div>
              </div>

              {/* ── Deductions ─────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Deductions</h3>
                  <Button variant="ghost" size="sm" onClick={() => addRow('ded')}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {deductionRows.map(r => (
                    <div key={r.id} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
                      <Input
                        value={r.label}
                        onChange={e => updateRow('ded', r.id, { label: e.target.value })}
                        placeholder="Component (e.g. PF Employee)"
                        className="h-9"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={r.amount}
                        onChange={e => updateRow('ded', r.id, { amount: e.target.value })}
                        placeholder="0"
                        className="h-9 text-right tabular-nums"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow('ded', r.id)}
                        title="Remove this line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {deductionRows.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No deduction components — click Add to create one.</p>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 mt-3">
                  <span className="text-sm font-semibold text-foreground">Total Deductions</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(totals.totalDed)}</span>
                </div>
              </div>
            </div>

            {/* ── Net Salary — derived, prominent ─────────────────────── */}
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 px-4 py-3 flex items-center justify-between mt-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Salary</p>
                <p className="text-[10px] text-muted-foreground">Auto-computed: Gross − Total Deductions</p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${totals.net > 0 ? 'text-kpi-green' : 'text-destructive'}`}>
                {fmt(totals.net)}
              </p>
            </div>

            {/* ── Reason ─────────────────────────────────────────────────── */}
            <div className="space-y-1.5 mt-4">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="At least 10 characters — explains why the payslip was edited (e.g. 'Reversed LOP — employee was on approved leave')"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Stored on the payslip&apos;s audit trail. The original values are also snapshotted on the first edit, so you can always see what changed.
              </p>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          {!isApproved && (
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                : <><Save className="h-4 w-4 mr-2" /> Save changes</>
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditPayslipModal
