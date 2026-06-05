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

    const empCodeIdx  = headers.findIndex(h => /emp.?code/i.test(h))
    const netSalIdx   = headers.findIndex(h => /net.?salary/i.test(h))
    const grossIdx    = headers.findIndex(h => /gross.?salary/i.test(h))
    const lopIdx      = headers.findIndex(h => /lop.?days/i.test(h))
    const totalDedIdx = headers.findIndex(h => /total.?deductions/i.test(h))
    const adjNoteIdx  = headers.findIndex(h => /adjustment.?note/i.test(h))

    if (empCodeIdx === -1 || netSalIdx === -1) {
      return NextResponse.json(
        { success: false, error: 'File must have "Emp Code" and "Net Salary" columns. Use the "Export for Review" button to get the correct template.' },
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

      const newNetSalary = Math.round(Number(row[netSalIdx]) || 0)
      const oldNetSalary = Math.round(Number(payslip.net_salary))

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
      // Net Salary column to the amount they want to pay, re-upload. In
      // that case the earnings/deductions columns are still the original
      // values, so blindly trusting them would leave the payslip showing
      // OLD Basic/HRA/PF/etc. with a NEW net at the bottom — math broken.
      //
      // Instead: compute what the net WOULD be from the line items HR
      // submitted, then synthesize an "Adjustment" line to absorb the
      // gap so the payslip math balances and the change is visible.
      //
      // If HR did edit the line items AND set net consistently, the gap
      // is zero and no Adjustment line is added.
      const sum = (obj: Record<string, number>) =>
        Math.round(Object.values(obj).reduce((a, b) => a + b, 0))

      const grossFromLines = sum(newEarnings)
      const dedFromLines   = sum(newDeductions)
      const netFromLines   = grossFromLines - dedFromLines
      const delta          = newNetSalary - netFromLines

      if (delta > 0) {
        // HR wants to pay MORE than the line items add up to → positive earning
        newEarnings['Adjustment'] = (newEarnings['Adjustment'] ?? 0) + delta
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
