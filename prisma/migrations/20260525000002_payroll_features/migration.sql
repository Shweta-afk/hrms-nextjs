-- ── payroll_features migration ──────────────────────────────────────────────
-- Adds fields for per-employee incentives and payroll manual-adjustment workflow.
-- Safe to re-run: all guarded with IF NOT EXISTS / IF EXISTS.

-- 1. Monthly incentive on employees (fixed amount added to every payslip)
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "monthly_incentive" DECIMAL(10,2);

-- 2. Payslip adjustment tracking (for the HR review/edit workflow)
ALTER TABLE "payslips"
  ADD COLUMN IF NOT EXISTS "is_manually_adjusted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "original_earnings"    JSONB,
  ADD COLUMN IF NOT EXISTS "original_deductions"  JSONB,
  ADD COLUMN IF NOT EXISTS "original_net_salary"  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "adjustment_note"      TEXT;
