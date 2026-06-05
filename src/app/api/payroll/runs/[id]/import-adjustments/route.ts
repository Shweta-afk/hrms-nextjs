import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
// XLSX loaded lazily inside handler — keeps cold-start lean

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const XLSX = await import('xlsx')
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const run = await prisma.payrollRun.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!run) return NextResponse.json({ success: false, error: 'Payroll run not found' }, { status: 404 })
    if (run.status === 'approved') {
      return NextResponse.json({ success: false, error: 'Cannot modify an approved payroll run' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', raw: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]

    if (rows.length < 2) return NextResponse.json({ success: false, error: 'File is empty' }, { status: 400 })

    const headers = (rows[0] as string[]).map(h => String(h).trim())

    // Header detection — accept BOTH templates HR may use:
    //
    //   1) The simple adjustment template (basic, HRA, PF, etc. as columns)
    //      uses "Emp Code", "Net Salary", "Gross Salary", "Total Deductions",
    //      "LOP Days".
    //
    //   2) The "Export for Review" template (attendance-based payroll report)
    //      uses just "Code" for the employee, and has TWO net-like columns:
    //      "Net Salary" (formula from attendance — doesn't reflect HR's
    //      adjustments) and "To be Credited" (formula AFTER HR's deductions/
    //      advances — the amount they actually want to pay). We prefer "To
    //      be Credited" when present.
    //
    // Without this, the importer matched no rows from the export template
    // and every row got marked "unchanged" — nothing in the DB updated.
    const empCodeIdx  = headers.findIndex(h => /^(emp(loyee)?[\s_]*)?code$/i.test(h))
    const toCredIdx   = headers.findIndex(h => /to.?be.?credited/i.test(h))
    const netSalRaw   = headers.findIndex(h => /^net.?(salary|pay)$/i.test(h))
    const netSalIdx   = toCredIdx !== -1 ? toCredIdx : netSalRaw
    const grossIdx    = headers.findIndex(h => /^(gross.?salary|total.?salary)$/i.test(h))
    const lopIdx      = headers.findIndex(h => /^(lop.?days|loss.?of.?pay)$/i.test(h))
    const totalDedIdx = headers.findIndex(h => /^total.?deductions?$/i.test(h))
    // The Export-for-Review template uses "Remark Details" for the note;
    // the simple template uses "Adjustment Note". Accept either.
    const adjNoteIdx  = headers.findIndex(h => /^(adjustment.?note|remark.?details)$/i.test(h))

    if (empCodeIdx === -1 || netSalIdx === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'File must have an employee-ID column ("Code" or "Emp Code") and a target-net column ("To be Credited" or "Net Salary"). Use the "Export for Review" button to get a valid template.',
        },
        { status: 400 }
      )
    }

    // Dynamic earning column names: between LOP Days and Gross Salary
    const earnHeaders = (lopIdx !== -1 && grossIdx > lopIdx)
      ? headers.slice(lopIdx + 1, grossIdx)
      : []
    // Dynamic deduction column names: between Gross Salary and Total Deductions
    const dedHeaders = (grossIdx !== -1 && totalDedIdx > grossIdx)
      ? headers.slice(grossIdx + 1, totalDedIdx)
      : []

    const payslips = await prisma.payslip.findMany({
      where: { org_id: session.user.org_id, payroll_run_id: id },
      include: { employee: { select: { emp_code: true, first_name: true, last_name: true } } },
    })
    const payslipMap = new Map(payslips.map(p => [p.employee.emp_code, p]))

    let adjusted = 0
    let unchanged = 0
    let notFound = 0
    const diffs: Array<{ emp_code: string; name: string; original_net: number; adjusted_net: number }> = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as any[]
      const empCode = String(row[empCodeIdx] ?? '').trim()
      if (!empCode) continue

      const payslip = payslipMap.get(empCode)
      if (!payslip) { notFound++; continue }

      let newNetSalary = Math.round(Number(row[netSalIdx]) || 0)
      const oldNetSalary = Math.round(Number(payslip.net_salary))

      // Fallback: if "To be Credited" came back empty/zero, the file was
      // probably downloaded and re-uploaded without being opened in Excel,
      // so the formula never evaluated. Reconstruct from the constituent
      // columns HR types as constants:
      //   To be Credited = Net Salary − Deductions if any − Salary Advance
      //                  + Previous Salary add
      if (toCredIdx !== -1 && newNetSalary === 0) {
        const netSalCol  = headers.findIndex(h => /^net.?salary$/i.test(h))
        const dedAnyCol  = headers.findIndex(h => /deductions?.?if.?any/i.test(h))
        const advCol     = headers.findIndex(h => /salary.?advance/i.test(h))
        const prevSalCol = headers.findIndex(h => /previous.?salary/i.test(h))
        if (netSalCol !== -1) {
          const netSal  = Math.round(Number(row[netSalCol])  || 0)
          const dedAny  = dedAnyCol  !== -1 ? Math.round(Number(row[dedAnyCol])  || 0) : 0
          const adv     = advCol     !== -1 ? Math.round(Number(row[advCol])     || 0) : 0
          const prevSal = prevSalCol !== -1 ? Math.round(Number(row[prevSalCol]) || 0) : 0
          const reconstructed = netSal - dedAny - adv + prevSal
          if (reconstructed > 0) newNetSalary = reconstructed
        }
      }

      // Read earnings from file columns
      const newEarnings: Record<string, number> = { ...(payslip.earnings as Record<string, number>) }
      for (let j = 0; j < earnHeaders.length; j++) {
        const val = Math.round(Number(row[lopIdx + 1 + j]) || 0)
        if (earnHeaders[j]) newEarnings[earnHeaders[j]] = val
      }

      // Read deductions from file columns
      const newDeductions: Record<string, number> = { ...(payslip.deductions as Record<string, number>) }
      for (let j = 0; j < dedHeaders.length; j++) {
        const val = Math.round(Number(row[grossIdx + 1 + j]) || 0)
        if (dedHeaders[j]) newDeductions[dedHeaders[j]] = val
      }

      // ── Reconcile net against line items ──────────────────────────────
      // The natural HR workflow is: download the export, change ONLY the
      // Net Salary column (or "To be Credited") to the amount they want to
      // pay, re-upload. The earning/deduction columns are still the
      // original values, so blindly trusting them would leave the payslip
      // showing OLD Basic/HRA/PF/etc. with a NEW net at the bottom — math
      // broken.
      //
      // Compute what the net WOULD be from the line items HR submitted,
      // then reconcile the gap:
      //   delta > 0  (HR pays MORE) — typically because they're reversing
      //               a performance-based deduction (Loss of Pay, Late
      //               Penalty, Half Day). Reduce those deductions in
      //               priority order before falling back to a positive
      //               "Adjustment" earning. This way the payslip visibly
      //               shows the deduction gone, matching HR's intent
      //               (not just a counter-earning that hides the original
      //               deduction).
      //   delta < 0  (HR pays LESS) — add a negative "Adjustment" entry
      //               as a deduction.
      const sum = (obj: Record<string, number>) =>
        Math.round(Object.values(obj).reduce((a, b) => a + b, 0))

      const grossFromLines = sum(newEarnings)
      const dedFromLines   = sum(newDeductions)
      const netFromLines   = grossFromLines - dedFromLines
      let delta            = newNetSalary - netFromLines

      if (delta > 0) {
        // Performance-discretionary deductions, most-reversible first.
        // PF / ESI / Professional Tax / TDS are statutory and intentionally
        // NOT in this list — those should never be auto-reversed.
        const REVERSIBLE_DEDUCTIONS = [
          'Loss of Pay',
          'Late Penalty',
          'Half Day for Late Mark',
          'Half Day Late Mark',
          'Actual Half Day',
          'Half Day',
        ]
        for (const key of REVERSIBLE_DEDUCTIONS) {
          if (delta <= 0) break
          const existing = newDeductions[key] ?? 0
          if (existing <= 0) continue
          const reduceBy = Math.min(delta, existing)
          const remaining = existing - reduceBy
          if (remaining > 0) {
            newDeductions[key] = remaining
          } else {
            // Fully reversed — drop the line so it doesn't show as "₹0" on
            // the payslip. The payslip view skips zero-amount lines anyway,
            // but deleting is cleaner.
            delete newDeductions[key]
          }
          delta -= reduceBy
        }
        if (delta > 0) {
          // Excess after reducing reversible deductions — record as an
          // Adjustment earning so HR's target net is still honored.
          newEarnings['Adjustment'] = (newEarnings['Adjustment'] ?? 0) + delta
        }
      } else if (delta < 0) {
        // HR wants to pay LESS than the line items add up to → deduction
        newDeductions['Adjustment'] = (newDeductions['Adjustment'] ?? 0) + (-delta)
      }

      const newGross    = sum(newEarnings)
      const newTotalDed = sum(newDeductions)
      const adjNote = adjNoteIdx !== -1 ? String(row[adjNoteIdx] ?? '').trim() : ''

      if (newNetSalary === oldNetSalary) { unchanged++; continue }

      // Preserve the original values on first adjustment
      const origEarnings   = payslip.is_manually_adjusted ? payslip.original_earnings   : payslip.earnings
      const origDeductions = payslip.is_manually_adjusted ? payslip.original_deductions : payslip.deductions
      const origNet        = payslip.is_manually_adjusted ? payslip.original_net_salary : payslip.net_salary

      diffs.push({
        emp_code: empCode,
        name: `${payslip.employee.first_name} ${payslip.employee.last_name}`,
        original_net: oldNetSalary,
        adjusted_net: newNetSalary,
      })

      await prisma.payslip.update({
        where: { id: payslip.id },
        data: {
          earnings:          newEarnings,
          deductions:        newDeductions,
          gross_salary:      newGross,
          total_deductions:  newTotalDed,
          net_salary:        newNetSalary,
          is_manually_adjusted: true,
          original_earnings:    origEarnings   ?? Prisma.DbNull,
          original_deductions:  origDeductions ?? Prisma.DbNull,
          original_net_salary:  origNet,
          adjustment_note:      adjNote || null,
        },
      })
      adjusted++
    }

    return NextResponse.json({
      success: true,
      data: { adjusted, unchanged, not_found: notFound, diffs },
    })
  } catch (error) {
    console.error('Import adjustments error:', error)
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 })
  }
}
