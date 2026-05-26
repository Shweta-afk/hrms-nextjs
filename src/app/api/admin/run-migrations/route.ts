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
