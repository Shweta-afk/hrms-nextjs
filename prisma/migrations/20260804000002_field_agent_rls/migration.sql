-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security — extend tenant isolation to field-agent attendance tables
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Same tenant_isolation policy as 20260726000001_rls_tenant_isolation, applied
-- to the three tables added by 20260804000001_field_agent_attendance. See that
-- migration's header comment for the full explanation (safe-by-default when
-- app.current_org_id is unset, enforcement is opt-in via a non-BYPASSRLS role).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  org_tables text[] := ARRAY['geofences', 'employee_geofences', 'field_punches'];
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
END $$;
