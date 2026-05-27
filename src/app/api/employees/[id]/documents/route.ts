import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { getSignedDownloadUrl } from '@/lib/s3'

const VALID_TYPES = [
  'aadhaar', 'pan', 'address_proof', 'resume',
  'leaving_certificate', 'offer_letter', 'pcc',
  'education_certificate', 'photo',
  'dra_certificate', 'passbook_or_cancelled_cheque', 'salary_slips', 'bank_statement',
]

// GET — list all documents for this employee (with fresh signed download URLs)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    // Employees can only see their own documents
    if (session.user.role === 'employee' && session.user.employee_id !== id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const docs = await prisma.employeeDocument.findMany({
      where: { employee_id: id, org_id: session.user.org_id },
      orderBy: { created_at: 'desc' },
    })

    // Generate fresh signed URLs for each document
    const withUrls = await Promise.all(
      docs.map(async (d) => {
        try {
          const url = await getSignedDownloadUrl(d.file_key)
          return { ...d, url }
        } catch {
          return { ...d, url: null }
        }
      })
    )

    return NextResponse.json({ success: true, data: withUrls })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch documents' }, { status: 500 })
  }
}

// POST — save a document record after upload
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    // Employees can only upload their own documents
    if (session.user.role === 'employee' && session.user.employee_id !== id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Confirm employee belongs to this org
    const employee = await prisma.employee.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!employee) return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })

    const body = await req.json()
    const { type, file_key, file_name, file_size, mime_type, notes } = body

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid document type' }, { status: 400 })
    }
    if (!file_key || !file_name) {
      return NextResponse.json({ success: false, error: 'file_key and file_name are required' }, { status: 400 })
    }

    // Delete any previous document of the same type (replace semantics)
    await prisma.employeeDocument.deleteMany({
      where: { employee_id: id, org_id: session.user.org_id, type },
    })

    const doc = await prisma.employeeDocument.create({
      data: {
        org_id:      session.user.org_id,
        employee_id: id,
        type,
        file_key,
        file_name,
        file_size:   file_size   ?? null,
        mime_type:   mime_type   ?? null,
        notes:       notes       ?? null,
        uploaded_by: session.user.id,
        is_verified: false,
      },
    })

    const url = await getSignedDownloadUrl(file_key)
    return NextResponse.json({ success: true, data: { ...doc, url } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to save document' }, { status: 500 })
  }
}
