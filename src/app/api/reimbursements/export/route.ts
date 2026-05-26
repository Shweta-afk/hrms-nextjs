import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { searchParams } = new URL(req.url)
    const status    = searchParams.get('status') ?? undefined  // filter by status
    const fromDate  = searchParams.get('from')   ?? undefined  // YYYY-MM-DD
    const toDate    = searchParams.get('to')     ?? undefined

    const reimbursements = await prisma.reimbursement.findMany({
      where: {
        org_id: session.user.org_id,
        ...(status && { status }),
        ...(fromDate && { created_at: { gte: new Date(fromDate) } }),
        ...(toDate   && { created_at: { lte: new Date(toDate + 'T23:59:59Z') } }),
      },
      include: {
        employee: {
          select: { emp_code: true, first_name: true, last_name: true, email: true,
                    department: { select: { name: true } } },
        },
        approver: { select: { email: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    const rows = reimbursements.map(r => ({
      'Emp Code':        r.employee.emp_code,
      'Employee Name':   `${r.employee.first_name} ${r.employee.last_name}`,
      'Department':      r.employee.department?.name ?? '',
      'Email':           r.employee.email,
      'Title':           r.title,
      'Description':     r.description ?? '',
      'Amount (₹)':      Number(r.amount),
      'Status':          r.status.charAt(0).toUpperCase() + r.status.slice(1),
      'Approved By':     r.approver?.email ?? '',
      'Approved At':     r.approved_at ? new Date(r.approved_at).toLocaleDateString('en-IN') : '',
      'Rejection Reason':r.rejection_reason ?? '',
      'Submitted On':    new Date(r.created_at).toLocaleDateString('en-IN'),
    }))

    const ws = XLSX.utils.json_to_sheet(rows)

    // Column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 28 },
      { wch: 24 }, { wch: 32 }, { wch: 12 }, { wch: 12 },
      { wch: 28 }, { wch: 14 }, { wch: 32 }, { wch: 14 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reimbursements')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const dateLabel = fromDate && toDate ? `_${fromDate}_to_${toDate}` : ''
    const filename  = `reimbursements${dateLabel}.xlsx`

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('reimbursement_export_failed', error)
    return NextResponse.json({ success: false, error: 'Export failed' }, { status: 500 })
  }
}
