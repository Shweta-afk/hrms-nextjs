ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "period_from" TIMESTAMP(3);
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "period_to"   TIMESTAMP(3);
