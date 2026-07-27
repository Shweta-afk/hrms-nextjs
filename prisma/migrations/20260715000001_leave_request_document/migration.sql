ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "document_url" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "document_name" TEXT;
