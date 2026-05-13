import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { buildS3Key, getPresignedUploadUrl } from '@/lib/s3'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { filename, content_type, category, sub_id, doc_type } = await req.json()

    const key = buildS3Key(
      session.user.org_id,
      category,
      sub_id || 'general',
      `${doc_type || 'document'}-${Date.now()}.${filename.split('.').pop()}`
    )

    const uploadUrl = await getPresignedUploadUrl(key, content_type)

    return NextResponse.json({
      success: true,
      data: { upload_url: uploadUrl, key },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to generate upload URL' }, { status: 500 })
  }
}