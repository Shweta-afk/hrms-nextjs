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

    // Find the header row. Most files have headers in row 1, but a common
    // failure mode is HR opening the export in Excel, accidentally inserting
    // a title or blank row, and re-saving — pushing the real headers to row
    // 2 or 3. The importer was rejecting these as "missing Code column"
    // because it only looked at row 1. We now scan the first 5 rows and
    // pick whichever one actually has a `Code`/`Emp Code` cell — that's
    // unambiguous enough to identify the header row even when something
    // else is above it.
    const looksLikeHeaderRow = (row: any[]): boolean => {
      if (!row || row.length < 2) return false
      // Use the same normalization the column detection below uses, just
      // limited here to the employee-code check.
      const cleaned = row
        .map(c => String(c ?? '')
          .replace(/ /g, ' ')   // strip non-breaking spaces Excel sometimes inserts
          .toLowerCase()
          .replace(/[(₹$₨inr).,]/g, '')
          .replace(/[_-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        )
      return cleaned.some(c => c === 'code' || c === 'emp code' || c === 'employee code')
    }

    let headerRowIdx = -1
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      if (looksLikeHeaderRow(rows[i])) { headerRowIdx = i; break }
    }
    if (headerRowIdx === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'File must have an employee-ID column ("Code" or "Emp Code") in the first 5 rows. Use the "Export for Review" button to get a valid template.',
        },
        { status: 400 }
      )
    }
    // Also remember the data rows start AFTER the detected header row, not
    // at row 1 — otherwise the loop below would mis-treat the rows between
    // a title and the headers as data.
    const headers = (rows[headerRowIdx] as string[])
      .map(h => String(h).replace(/ /g, ' ').trim())
    const dataStartIdx = headerRowIdx + 1

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
    //   3) The attendance-report template uses "Emp Code", "Net Salary (₹)",
    //      etc. with currency suffixes.
    //
    // Regexes use `.test()` against trimmed/lowercased header strings, with
    // generous whitespace tolerance, currency-symbol stripping, and partial
    // matching. Without this, the importer matched no rows on some
    // templates and every row got marked "unchanged" — nothing updated.
    const norm = (s: string) =>
      s.toLowerCase()
        .replace(/[(₹$₨inr).,]/g, '')   // strip currency symbols / parens / dots
        .replace(/[_-]/g, ' ')           // treat _ and - as space
        .replace(/\s+/g, ' ')            // collapse whitespace
        .trim()
    const findHeader = (predicate: (h: string) => boolean) =>
      headers.findIndex(h => predicate(norm(h)))

    const empCodeIdx  = findHeader(h => h === 'code' || h === 'emp code' || h === 'employee code')
    const toCredIdx   = findHeader(h => /to\s*be\s*credited/.test(h))
    const netSalRaw   = findHeader(h => /^net\s*(salary|pay)$/.test(h) || /^net\s*(salary|pay)\s/.test(h))
    const netSalIdx   = toCredIdx !== -1 ? toCredIdx : netSalRaw
    const grossIdx    = findHeader(h => /^(gross|total)\s*salary$/.test(h) || /^(gross|total)\s*salary\s/.test(h))
    const lopIdx      = findHeader(h => /^lop\s*days?$/.test(h) || /^loss\s*of\s*pay/.test(h))
    const totalDedIdx = findHeader(h => /^total\s*deductions?$/.test(h) || /^total\s*deductions?\s/.test(h))
    // Export-for-Review uses "Remark Details"; simple template uses "Adjustment Note".
    const adjNoteIdx  = findHeader(h => h === 'adjustment note' || h === 'remark details' || h === 'remarks')

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
    // Normalize emp_code for lookup: lowercase, strip whitespace and leading
    // zeros. Excel sometimes converts "0001" to integer 1, and HR may copy
    // codes with different casing. Without this normalization a perfectly
    // valid spreadsheet row silently falls through as not_found.
    const normCode = (s: unknown) =>
      String(s ?? '').trim().toLowerCase().replace(/^0+/, '')
    const payslipMap = new Map(payslips.map(p => [normCode(p.employee.emp_code), p]))

    let adjusted = 0
    let unchanged = 0
    let notFound = 0
    const diffs: Array<{ emp_code: string; name: string; original_net: number; adjusted_net: number }> = []
    // Per-row reason, so HR can see WHY a row didn't update when the totals
    // surprise them. Capped to avoid blowing up the response on huge files.
    const skipped: Array<{ row: number; emp_code: string; reason: string }> = []
    const noteSkip = (row: number, emp_code: string, reason: string) => {
      if (skipped.length < 100) skipped.push({ row, emp_code, reason })
    }

    for (let i = dataStartIdx; i < rows.length; i++) {
      const row = rows[i] as any[]
      const rawCode = String(row[empCodeIdx] ?? '').trim()
      if (!rawCode) continue   // blank row — silent skip is OK

      const payslip = payslipMap.get(normCode(rawCode))
      if (!payslip) {
        notFound++
        noteSkip(i + 1, rawCode, 'no payslip in this run for this employee code')
        continue
      }

      // Refuse to silently overwrite a payslip that's already been HR-approved.
      // Without this guard, HR could approve Alice's payslip and later upload
      // an adjustments file that mutates Alice's row — the audit trail
      // (hr_approved_at) would still claim "approved at T0" while the numbers
      // had quietly drifted. Force HR to unapprove first if they really want
      // to re-adjust.
      if (payslip.hr_approved_at) {
        unchanged++ // count it under unchanged so it shows up in the modal totals
        noteSkip(i + 1, rawCode, 'payslip already HR-approved — unapprove it from the employee\'s payslip page before re-adjusting')
        continue
      }

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

      if (newNetSalary === oldNetSalary) {
        unchanged++
        noteSkip(i + 1, rawCode, `net unchanged (₹${oldNetSalary}). If you edited the file, make sure the "To be Credited" or "Net Salary" column reflects the new amount — open in Excel to let the formula re-evaluate, or type the new value directly.`)
        continue
      }

      // Preserve the original values on first adjustment
      const origEarnings   = payslip.is_manually_adjusted ? payslip.original_earnings   : payslip.earnings
      const origDeductions = payslip.is_manually_adjusted ? payslip.original_deductions : payslip.deductions
      const origNet        = payslip.is_manually_adjusted ? payslip.original_net_salary : payslip.net_salary

      diffs.push({
        // Use the DB's canonical emp_code for display, not the spreadsheet's
        // raw value — Excel may have stripped leading zeros or changed case.
        emp_code: payslip.employee.emp_code,
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
      data: { adjusted, unchanged, not_found: notFound, diffs, skipped },
    })
  } catch (error) {
    console.error('Import adjustments error:', error)
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 })
  }
}
