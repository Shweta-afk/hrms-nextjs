-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Policies — tenant isolation enforcement
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Context:
--   The previous migration (20260603000001_enable_rls) enabled RLS on all
--   tables but created zero policies. In PostgreSQL, "RLS enabled + no policy"
--   means the default-deny rule blocks ALL rows for non-superuser roles.
--   The Prisma connection uses a role that is typically granted BYPASSRLS (or is
--   the table owner), so the app worked — but any analytics role, read-only
--   replica user, or accidental direct-DB access would see zero rows rather
--   than an isolated view.
--
-- This migration adds two layers of policy:
--
--   1. BYPASSRLS grant for the app role ("app_user")  — Prisma keeps working
--      regardless of which connection it uses.
--
--   2. Explicit tenant-isolation policies for a "readonly_user" role that
--      analytics dashboards or support tooling would use.  These policies
--      enforce org_id filtering at the database level, so even a compromised
--      read-only credential cannot read another tenant's data.
--
-- Safe to run multiple times: all statements use IF EXISTS / IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. App role — bypass RLS so Prisma is unaffected ─────────────────────────
DO $$
BEGIN
  -- Create the role if it doesn't exist yet.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
END
$$;

-- The Prisma DATABASE_URL user should be granted this role. After applying this
-- migration run:
--   GRANT app_user TO <your_prisma_db_user>;
-- (replace <your_prisma_db_user> with the actual Neon / Postgres user)
ALTER ROLE app_user BYPASSRLS;

-- ── 2. Read-only analytics role — sees only its own org's data ───────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'readonly_user') THEN
    CREATE ROLE readonly_user;
  END IF;
END
$$;

-- Grant SELECT on all tables to the readonly role.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;

-- ── 3. Tenant-isolation policies (org_id tables) ─────────────────────────────
--
-- Pattern:
--   USING (org_id = current_setting('app.org_id', true)::uuid)
--
-- Before running any query as readonly_user, the caller sets:
--   SET app.org_id = '<org uuid>';
--
-- This ensures every SELECT, UPDATE, DELETE is automatically scoped to one
-- tenant even if the query forgets a WHERE clause.
--
-- We use DROP POLICY IF EXISTS + CREATE to make this idempotent.

-- Helper: list of tables that carry org_id
DO $$
DECLARE
  tbl text;
  org_tables text[] := ARRAY[
    'employees', 'departments', 'designations',
    'attendance_records', 'devices', 'punch_logs', 'device_enrollments',
    'leave_types', 'leave_requests', 'holidays',
    'payroll_runs', 'payslips', 'salary_structures', 'shift_groups',
    'job_postings', 'candidates',
    'notifications',
    'reimbursements', 'employee_documents', 'hr_requests',
    'org_api_keys'
  ];
BEGIN
  FOREACH tbl IN ARRAY org_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      -- Drop any old policy with this name first (idempotent)
      EXECUTE format(
        'DROP POLICY IF EXISTS readonly_org_isolation ON %I',
        tbl
      );
      -- Create policy: readonly_user may only see rows matching their org
      EXECUTE format(
        $sql$
          CREATE POLICY readonly_org_isolation ON %I
            AS RESTRICTIVE
            FOR SELECT
            TO readonly_user
            USING (org_id = current_setting('app.org_id', true)::uuid)
        $sql$,
        tbl
      );
    END IF;
  END LOOP;
END
$$;

-- ── 4. organisations table — user may only see their own org row ───────────────
DROP POLICY IF EXISTS readonly_org_isolation ON organisations;
CREATE POLICY readonly_org_isolation ON organisations
  AS RESTRICTIVE
  FOR SELECT
  TO readonly_user
  USING (id = current_setting('app.org_id', true)::uuid);

-- ── 5. users table — user may only see users within their org ─────────────────
DROP POLICY IF EXISTS readonly_org_isolation ON users;
CREATE POLICY readonly_org_isolation ON users
  AS RESTRICTIVE
  FOR SELECT
  TO readonly_user
  USING (org_id = current_setting('app.org_id', true)::uuid);

-- ── 6. rate_limit_entries — internal only, no external role access ────────────
-- No policy for readonly_user — rate limit data is implementation detail.
REVOKE SELECT ON rate_limit_entries FROM readonly_user;
