# Row-Level Security (tenant isolation) — how to actually turn it on

The `20260726000001_rls_tenant_isolation` migration adds RLS policies to every
tenant table. They are a **backstop**: the app already filters every query by
`org_id`; RLS makes sure a *missed* filter can't leak one company's rows to
another.

By default the policies are **inert** and the app runs its normal, plain data
path. Turning enforcement on is a deliberate two-part step because of how
Postgres RLS interacts with privileged roles.

## Why it isn't on by default

A role with **superuser** or the **BYPASSRLS** attribute skips RLS entirely —
even with `FORCE ROW LEVEL SECURITY`. Two facts make this matter here:

- Local dev roles are usually superusers.
- On Supabase, the default `postgres` role that Prisma connects as has
  `BYPASSRLS` (see `AGENTS.md`).

So with the current connection, the policies exist but never fire. Enforcing
them requires the app to connect as a **dedicated role without superuser /
BYPASSRLS**.

## Step 1 — create the app role (one-time, run as an admin)

Run in the Supabase SQL editor (admins there have elevated rights; `prisma
migrate` does not, which is why this isn't a migration):

```sql
CREATE ROLE hrms_app LOGIN PASSWORD '<strong-password>';
GRANT hrms_app TO postgres;                     -- lets the pooler assume it
GRANT USAGE ON SCHEMA public TO hrms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hrms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hrms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hrms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO hrms_app;
-- hrms_app must NOT have SUPERUSER or BYPASSRLS.
```

## Step 2 — point the app at it and flip the flag

Set these env vars (Vercel dashboard in prod):

- `DATABASE_URL` → the pooled connection **as `hrms_app`** (keep
  `?pgbouncer=true`). Consider `connection_limit=2+` if you have routes that
  fan out queries with `Promise.all` — enforcement wraps each tenant query in a
  short transaction, and a pool pinned to 1 connection can serialise them.
- `DIRECT_URL` → unchanged (migrations keep running as the owner role).
- `RLS_ENFORCED=1` → activates the query-scoping extension in `src/lib/prisma.ts`.

## Verify it's actually enforcing

As `hrms_app`, in one transaction:

```sql
BEGIN;
SELECT set_config('app.current_org_id', '<some-org-uuid>', true);
SELECT count(*) FROM employees;   -- only that org's employees
COMMIT;
```

A different `app.current_org_id` must return 0 of the first org's rows. With no
`set_config`, it returns everything (the safe default that keeps login/signup/
device/cron working).

## Rollback

Unset `RLS_ENFORCED` (back to the plain client) and/or repoint `DATABASE_URL`
at the owner role. The policies can stay — they're inert for a bypassing role.
