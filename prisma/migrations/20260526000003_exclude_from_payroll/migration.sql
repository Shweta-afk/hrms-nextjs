ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "exclude_from_payroll" BOOLEAN NOT NULL DEFAULT false;
