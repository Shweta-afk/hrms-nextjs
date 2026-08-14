-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security — tenant isolation backstop
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Defence-in-depth for multi-tenancy. The application already filters every
-- query by org_id; these policies are a *backstop* so that a future missed
-- filter cannot leak one tenant's rows to another.
--
-- HOW IT WORKS
--   Each tenant table gets a policy that admits a row only when the request's
--   org context matches the row's org_id. The context is a transaction-local
--   GUC, `app.current_org_id`, set by the app on every authenticated request
--   (see src/lib/prisma.ts + the auth() wrapper).
--
-- SAFE BY DEFAULT
--   When `app.current_org_id` is unset or empty the policy admits everything.
--   This keeps pre-auth / system paths working unchanged — login (look up a user
--   before we know their org), signup (create a brand-new org), device push,
--   iclock and cron all run WITHOUT an org context and must see across orgs.
--   Enforcement kicks in only once a request sets the GUC, which authenticated
--   tenant requests always do.
--
-- IMPORTANT — this does NOT need superuser (unlike the earlier deferred attempt
--   that tried to CREATE ROLE / ALTER ROLE ... BYPASSRLS). ENABLE/FORCE RLS and
--   CREATE POLICY are owner privileges, which the Prisma connection already has.
--
-- ⚠️  ENFORCEMENT CAVEAT — READ THIS
--   A role with the BYPASSRLS attribute (or a superuser) bypasses these policies
--   entirely, even with FORCE. On Supabase the default `postgres` role has
--   BYPASSRLS, and local superuser roles bypass too — so with those roles these
--   policies are defined but INERT. To actually enforce isolation, the app must
--   connect as a dedicated role WITHOUT superuser/BYPASSRLS. One-time setup, run
--   in the Supabase SQL editor as an admin (see prisma/migrations/README-rls.md):
--
--     CREATE ROLE hrms_app LOGIN PASSWORD '…';
--     GRANT hrms_app TO postgres;                      -- so Prisma can assume it
--     GRANT USAGE ON SCHEMA public TO hrms_app;
--     GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hrms_app;
--     GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hrms_app;
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public
--       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hrms_app;
--   …then point DATABASE_URL at hrms_app. DIRECT_URL (migrations) stays on the
--   owner role. hrms_app must NOT have BYPASSRLS.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  -- Every table that carries an org_id column.
  org_tables text[] := ARRAY[
    'users', 'departments', 'designations', 'employees',
    'attendance_records', 'devices', 'punch_logs', 'device_enrollments',
    'leave_types', 'leave_requests', 'holidays',
    'payroll_runs', 'payslips', 'salary_structures', 'shift_groups',
    'job_postings', 'candidates', 'notifications',
    'reimbursements', 'employee_documents', 'hr_requests', 'org_api_keys'
  ];
BEGIN
  FOREACH t IN ARRAY org_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (
          current_setting('app.current_org_id', true) IS NULL
          OR current_setting('app.current_org_id', true) = ''
          OR org_id = current_setting('app.current_org_id', true)
        )
        WITH CHECK (
          current_setting('app.current_org_id', true) IS NULL
          OR current_setting('app.current_org_id', true) = ''
          OR org_id = current_setting('app.current_org_id', true)
        )
    $f$, t);
  END LOOP;

  -- organisations has no org_id column — it is keyed by id.
  EXECUTE 'ALTER TABLE organisations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE organisations FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON organisations';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON organisations
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR current_setting('app.current_org_id', true) = ''
        OR id = current_setting('app.current_org_id', true)
      )
      WITH CHECK (
        current_setting('app.current_org_id', true) IS NULL
        OR current_setting('app.current_org_id', true) = ''
        OR id = current_setting('app.current_org_id', true)
      )
  $f$;
END $$;
