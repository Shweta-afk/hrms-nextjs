<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:database-rules -->
# Database — Supabase PostgreSQL via Prisma

The production database is **Supabase PostgreSQL** (NOT Neon, NOT PlanetScale).
Connection strings live in the **Vercel dashboard** env vars — they are empty in local `.env` files.
Prisma is the ORM. The `postgres` role has BYPASSRLS so Prisma sees all rows regardless of RLS policies.

## ALWAYS create tables through Prisma migrations

**Never create or alter tables directly in the Supabase dashboard.**

Why: Supabase enables RLS on every table it creates. A table with RLS enabled and zero policies
silently returns 0 rows to every non-owner query — Prisma queries appear to work but return no data,
with no error. This is extremely hard to debug.

Correct workflow for any schema change:
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <description>` locally
3. Commit the generated migration file — it applies automatically on `npm run build` (via `prisma migrate deploy`)

If a table was accidentally created in the Supabase dashboard, fix it by:
- Dropping it from the dashboard and recreating via migration, OR
- Running `ALTER TABLE <name> DISABLE ROW LEVEL SECURITY;` in the Supabase SQL Editor as a temporary
  fix, then immediately adding the table to schema.prisma and generating a migration that re-enables
  it with proper policies.

## Edge auth lives in src/proxy.ts — NOT middleware.ts

This project uses Next.js 16 which renamed `middleware.ts` → `proxy.ts`.
**Do NOT create `src/middleware.ts`** — Next 16 refuses to build if both files exist.
All route protection (auth gating, role guards, trial-expiry redirects) is in `src/proxy.ts`.
To change edge auth behaviour, edit `src/proxy.ts` only.

## Connection strings

- `DATABASE_URL` → Supabase **pooled** connection (Supavisor, port **6543**) with `?pgbouncer=true&connection_limit=1` — used by the app at runtime (serverless-safe)
- `DIRECT_URL` → Supabase **direct** connection (port **5432**) — used only by `prisma migrate deploy` during builds
<!-- END:database-rules -->
