import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { buildS3Key, uploadFile, getSignedDownloadUrl } from '@/lib/s3'
import { prisma } from '@/lib/prisma'

// Max 5MB
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string
    const sub_id = formData.get('sub_id') as string
    const doc_type = formData.get('doc_type') as string

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Only PDF, JPG and PNG files are allowed' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size must be under 5MB' },
        { status: 400 }
      )
    }

    // Build org-scoped S3 key
    const key = buildS3Key(
      session.user.org_id,
      category as any,
      sub_id || 'general',
      `${doc_type || 'document'}-${Date.now()}.${file.name.split('.').pop()}`
    )

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadFile(key, buffer, file.type)

    // Get signed download URL
    const url = await getSignedDownloadUrl(key)

    return NextResponse.json({
      success: true,
      data: {
        key,
        url,
        filename: file.name,
        size: file.size,
        type: file.type,
      },
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}