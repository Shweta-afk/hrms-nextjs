import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET!

export type FileCategory =
  | 'employees'
  | 'payslips'
  | 'company'
  | 'recruitment'
  | 'leave'

// Build a scoped file path: org_id/category/sub_id/filename
export function buildS3Key(
  org_id: string,
  category: FileCategory,
  sub_id: string,
  filename: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9.-_]/g, '-').toLowerCase()
  return `${org_id}/${category}/${sub_id}/${sanitized}`
}

// Upload a file buffer to S3
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  }))
  return key
}

// Get a signed URL for downloading (expires in 1 hour by default)
export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  )
}

// Get a presigned URL for direct browser upload (expires in 15 min)
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 900
): Promise<string> {
  const { createPresignedPost } = await import('@aws-sdk/s3-presigned-post')
  // Use PutObject presigned URL instead
  const { PutObjectCommand } = await import('@aws-sdk/client-s3')
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  )
}

// Delete a file
export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}