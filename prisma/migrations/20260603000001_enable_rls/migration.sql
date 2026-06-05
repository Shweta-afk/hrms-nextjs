-- Enable Row-Level Security on all public tables.
-- Uses IF EXISTS guards so the migration is safe even if a table was not yet
-- created (e.g. on a partially-migrated database).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'organisations','users','sessions','departments','designations',
    'employees','attendance_records','devices','punch_logs',
    'device_enrollments','leave_types','leave_requests','holidays',
    'payroll_runs','payslips','job_postings','candidates','notifications',
    'salary_structures','shift_groups','rate_limit_entries','reimbursements',
    'employee_documents','hr_requests','org_api_keys'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Only act on tables that actually exist in the public schema
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END;
$$;
