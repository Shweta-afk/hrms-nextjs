-- Add HR approval fields to payslips
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "hr_approved_by" TEXT;
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "hr_approved_at" TIMESTAMP(3);

-- Add FK for payslip approver
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payslips_hr_approved_by_fkey') THEN
    ALTER TABLE "payslips" ADD CONSTRAINT "payslips_hr_approved_by_fkey"
    FOREIGN KEY ("hr_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create reimbursements table
CREATE TABLE IF NOT EXISTS "reimbursements" (
  "id"               TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "org_id"           TEXT         NOT NULL,
  "employee_id"      TEXT         NOT NULL,
  "title"            TEXT         NOT NULL,
  "description"      TEXT,
  "amount"           DECIMAL(10,2) NOT NULL,
  "bill_url"         TEXT,
  "status"           TEXT         NOT NULL DEFAULT 'pending',
  "approved_by"      TEXT,
  "approved_at"      TIMESTAMP(3),
  "rejection_reason" TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

-- FKs for reimbursements
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reimbursements_org_id_fkey') THEN
    ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reimbursements_employee_id_fkey') THEN
    ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reimbursements_approved_by_fkey') THEN
    ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "reimbursements_org_id_status_idx" ON "reimbursements"("org_id", "status");
CREATE INDEX IF NOT EXISTS "reimbursements_employee_id_status_idx" ON "reimbursements"("employee_id", "status");
