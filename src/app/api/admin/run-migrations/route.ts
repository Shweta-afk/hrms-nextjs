import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// One-shot migration endpoint — protected by MIGRATION_SECRET env var.
// Hit once after deploy to apply pending schema changes, then this route
// does nothing (all statements are idempotent).

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  const expected = process.env.MIGRATION_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const steps: { sql: string; label: string }[] = [
    {
      label: 'employees.monthly_incentive',
      sql: `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "monthly_incentive" DECIMAL(10,2)`,
    },
    {
      label: 'payslips.is_manually_adjusted',
      sql: `ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "is_manually_adjusted" BOOLEAN NOT NULL DEFAULT false`,
    },
    {
      label: 'payslips.original_earnings',
      sql: `ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "original_earnings" JSONB`,
    },
    {
      label: 'payslips.original_deductions',
      sql: `ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "original_deductions" JSONB`,
    },
    {
      label: 'payslips.original_net_salary',
      sql: `ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "original_net_salary" DECIMAL(10,2)`,
    },
    {
      label: 'payslips.adjustment_note',
      sql: `ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "adjustment_note" TEXT`,
    },
    {
      label: 'create shift_groups table',
      sql: `CREATE TABLE IF NOT EXISTS "shift_groups" (
        "id"          TEXT         NOT NULL DEFAULT gen_random_uuid(),
        "org_id"      TEXT         NOT NULL,
        "name"        TEXT         NOT NULL,
        "weekly_offs" INTEGER[]    NOT NULL DEFAULT '{0}',
        "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "shift_groups_pkey" PRIMARY KEY ("id")
      )`,
    },
    {
      label: 'shift_groups_org_id_fkey',
      sql: `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shift_groups_org_id_fkey') THEN
          ALTER TABLE "shift_groups" ADD CONSTRAINT "shift_groups_org_id_fkey"
          FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$`,
    },
    {
      label: 'employees.shift_group_id',
      sql: `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "shift_group_id" TEXT`,
    },
    {
      label: 'employees_shift_group_id_fkey',
      sql: `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_shift_group_id_fkey') THEN
          ALTER TABLE "employees" ADD CONSTRAINT "employees_shift_group_id_fkey"
          FOREIGN KEY ("shift_group_id") REFERENCES "shift_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$`,
    },
    // ── employee_documents ─────────────────────────────────────────────
    {
      label: 'create employee_documents table',
      sql: `CREATE TABLE IF NOT EXISTS "employee_documents" (
        "id"          TEXT         NOT NULL DEFAULT gen_random_uuid(),
        "org_id"      TEXT         NOT NULL,
        "employee_id" TEXT         NOT NULL,
        "type"        TEXT         NOT NULL,
        "file_key"    TEXT         NOT NULL,
        "file_name"   TEXT         NOT NULL,
        "file_size"   INTEGER,
        "mime_type"   TEXT,
        "notes"       TEXT,
        "is_verified" BOOLEAN      NOT NULL DEFAULT false,
        "verified_by" TEXT,
        "verified_at" TIMESTAMP(3),
        "uploaded_by" TEXT         NOT NULL,
        "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
      )`,
    },
    {
      label: 'employee_documents_org_id_fkey',
      sql: `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_documents_org_id_fkey') THEN
          ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_org_id_fkey"
          FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$`,
    },
    {
      label: 'employee_documents_employee_id_fkey',
      sql: `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_documents_employee_id_fkey') THEN
          ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$`,
    },
    {
      label: 'employee_documents index org_id+employee_id',
      sql: `CREATE INDEX IF NOT EXISTS "employee_documents_org_id_employee_id_idx" ON "employee_documents"("org_id", "employee_id")`,
    },
    {
      label: 'employee_documents index employee_id+type',
      sql: `CREATE INDEX IF NOT EXISTS "employee_documents_employee_id_type_idx" ON "employee_documents"("employee_id", "type")`,
    },
    // ── hr_requests ────────────────────────────────────────────────────
    {
      label: 'create hr_requests table',
      sql: `CREATE TABLE IF NOT EXISTS "hr_requests" (
        "id"          TEXT         NOT NULL DEFAULT gen_random_uuid(),
        "org_id"      TEXT         NOT NULL,
        "employee_id" TEXT         NOT NULL,
        "type"        TEXT         NOT NULL,
        "subject"     TEXT         NOT NULL,
        "description" TEXT         NOT NULL,
        "status"      TEXT         NOT NULL DEFAULT 'open',
        "reply"       TEXT,
        "replied_by"  TEXT,
        "replied_at"  TIMESTAMP(3),
        "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "hr_requests_pkey" PRIMARY KEY ("id")
      )`,
    },
    {
      label: 'hr_requests_org_id_fkey',
      sql: `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_requests_org_id_fkey') THEN
          ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_org_id_fkey"
          FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$`,
    },
    {
      label: 'hr_requests_employee_id_fkey',
      sql: `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_requests_employee_id_fkey') THEN
          ALTER TABLE "hr_requests" ADD CONSTRAINT "hr_requests_employee_id_fkey"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$`,
    },
    {
      label: 'hr_requests index org_id+status',
      sql: `CREATE INDEX IF NOT EXISTS "hr_requests_org_id_status_idx" ON "hr_requests"("org_id", "status")`,
    },
    {
      label: 'hr_requests index employee_id+created_at',
      sql: `CREATE INDEX IF NOT EXISTS "hr_requests_employee_id_created_at_idx" ON "hr_requests"("employee_id", "created_at" DESC)`,
    },
  ]

  const results: { label: string; status: string; error?: string }[] = []

  for (const step of steps) {
    try {
      await prisma.$executeRawUnsafe(step.sql)
      results.push({ label: step.label, status: 'ok' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ label: step.label, status: 'error', error: msg })
    }
  }

  const failed = results.filter(r => r.status === 'error')
  return NextResponse.json({
    success: failed.length === 0,
    results,
    summary: `${results.length - failed.length}/${results.length} steps succeeded`,
  })
}
