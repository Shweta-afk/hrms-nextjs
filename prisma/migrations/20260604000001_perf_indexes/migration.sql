-- Performance indexes for HR dashboard, attendance summary, and on-leave-today queries.
--
-- All use IF NOT EXISTS so re-running on an environment that already has them
-- (e.g. a prod where someone hand-rolled them) is a no-op.
--
-- The composite index that references `exclude_from_payroll` is wrapped in a
-- column-existence check because some long-lived dev databases got out of sync
-- with schema.prisma and don't yet have that column. The check makes this
-- migration safe to run anywhere; the prior migration that adds the column
-- will run first on fresh installs.

-- Employee list filters: active employees, headcount queries
CREATE INDEX IF NOT EXISTS "employees_org_id_status_idx"
  ON "employees" ("org_id", "status");

-- Attendance + payroll summaries scope by (status, exclude_from_payroll)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'exclude_from_payroll'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "employees_org_id_exclude_from_payroll_status_idx"
             ON "employees" ("org_id", "exclude_from_payroll", "status")';
  END IF;
END$$;

-- Today/monthly attendance count() by status — covered by index alone
CREATE INDEX IF NOT EXISTS "attendance_records_org_id_status_date_idx"
  ON "attendance_records" ("org_id", "status", "date");

-- Dashboard "on-leave today" — narrow approved leaves by from_date
CREATE INDEX IF NOT EXISTS "leave_requests_org_id_status_from_date_idx"
  ON "leave_requests" ("org_id", "status", "from_date");
