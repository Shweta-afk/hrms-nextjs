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
        .replace(/[()₹$₨.,]/g, '')       // strip currency symbols / parens / dots
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
    // Named adjustment columns in the Export-for-Review template
    const dedIfAnyIdx   = findHeader(h => /deductions?\s*if\s*any/.test(h))
    const salAdvIdx     = findHeader(h => /salary\s*advance/.test(h))
    const prevSalIdx    = findHeader(h => /previous\s*salary/.test(h))

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

      // Read the named adjustment columns HR fills in (Export-for-Review template)
      const dedIfAny  = dedIfAnyIdx !== -1 ? Math.round(Number(row[dedIfAnyIdx]) || 0) : 0
      const salAdv    = salAdvIdx   !== -1 ? Math.round(Number(row[salAdvIdx])   || 0) : 0
      const prevSal   = prevSalIdx  !== -1 ? Math.round(Number(row[prevSalIdx])  || 0) : 0

      // Start from original payslip earnings/deductions
      const newEarnings: Record<string, number>   = { ...(payslip.earnings   as Record<string, number>) }
      const newDeductions: Record<string, number> = { ...(payslip.deductions as Record<string, number>) }

      // Apply named deductions explicitly so payslip line items match exactly
      // what HR entered — not a reconciled "Adjustment" black box.
      if (dedIfAny > 0) {
        newDeductions['Deduction'] = dedIfAny
      } else {
        delete newDeductions['Deduction']
      }
      if (salAdv > 0) {
        newDeductions['Salary Advance'] = salAdv
      } else {
        delete newDeductions['Salary Advance']
      }
      if (prevSal > 0) {
        newEarnings['Previous Salary'] = prevSal
      } else {
        delete newEarnings['Previous Salary']
      }

      // Also read any dynamic earning/deduction columns if present (simple template)
      for (let j = 0; j < earnHeaders.length; j++) {
        const val = Math.round(Number(row[lopIdx + 1 + j]) || 0)
        if (earnHeaders[j]) newEarnings[earnHeaders[j]] = val
      }
      for (let j = 0; j < dedHeaders.length; j++) {
        const val = Math.round(Number(row[grossIdx + 1 + j]) || 0)
        if (dedHeaders[j]) newDeductions[dedHeaders[j]] = val
      }

      const sum = (obj: Record<string, number>) =>
        Math.round(Object.values(obj).reduce((a, b) => a + b, 0))

      // Compute To be Credited from constituent columns when present.
      // This is the authoritative value — HR types Deductions/Advance/PrevSal
      // and the net is derived from those, not from a formula cell that may
      // not have evaluated after re-upload.
      const baseNet = netSalRaw !== -1 ? Math.round(Number(row[netSalRaw]) || 0) : 0
      const hasNamedCols = dedIfAnyIdx !== -1 || salAdvIdx !== -1 || prevSalIdx !== -1
      let newNetSalary: number
      if (hasNamedCols && baseNet > 0) {
        newNetSalary = baseNet - dedIfAny - salAdv + prevSal
      } else {
        // Fall back to To be Credited / Net Salary column directly
        newNetSalary = Math.round(Number(row[netSalIdx]) || 0)
      }
      const oldNetSalary = Math.round(Number(payslip.net_salary))

      // Reconcile: if the line items don't exactly add up to newNetSalary
      // (e.g. simple template with manual net override), absorb the gap
      // as an Adjustment entry rather than silently breaking the math.
      const grossFromLines = sum(newEarnings)
      const dedFromLines   = sum(newDeductions)
      const netFromLines   = grossFromLines - dedFromLines
      const delta          = newNetSalary - netFromLines

      // If the file provided no explicit earning/deduction columns AND the
      // delta is larger than 20% of gross, the existing payslip earnings are
      // stale (wrong CTC from a previous payroll run). Rather than burying a
      // huge "Adjustment" deduction that makes gross look inflated on the
      // payslip and the export, rebuild the earnings so gross = net = target.
      // This keeps the payslip clean and the export readable.
      const fileHasLineItems = earnHeaders.length > 0 || dedHeaders.length > 0 || hasNamedCols
      const deltaIsLarge     = grossFromLines > 0 && Math.abs(delta) / grossFromLines > 0.20
      if (!fileHasLineItems && deltaIsLarge) {
        // Reset earnings to just the target net, preserving the component
        // structure names but scaling them proportionally.
        const scale = grossFromLines > 0 ? newNetSalary / grossFromLines : 1
        for (const k of Object.keys(newEarnings)) {
          newEarnings[k] = Math.round((newEarnings[k] ?? 0) * scale)
        }
        // Clear all existing deductions — HR is signalling "pay this amount, no cuts"
        for (const k of Object.keys(newDeductions)) delete newDeductions[k]
        // Re-apply any named deductions from the file (advance etc.)
        if (dedIfAny > 0) newDeductions['Deduction']       = dedIfAny
        if (salAdv  > 0) newDeductions['Salary Advance']   = salAdv
        if (prevSal > 0) newEarnings['Previous Salary']    = prevSal
      } else if (delta > 0) {
        newEarnings['Adjustment'] = (newEarnings['Adjustment'] ?? 0) + delta
      } else if (delta < 0) {
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
