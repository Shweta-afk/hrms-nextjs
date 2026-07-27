import { PrismaClient } from '@prisma/client'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Per-request tenant context for Row-Level Security.
 *
 * auth() (src/app/api/auth/[...nextauth]/route.ts) calls `orgContext.enterWith`
 * once it knows the caller's org, so — when RLS enforcement is enabled — every
 * DB query in that request runs with `app.current_org_id` set and the policies
 * from the rls_tenant_isolation migration constrain it to that tenant. This is a
 * backstop for any query that forgets its org_id filter.
 *
 * Pre-auth / system paths (login, signup, device push, iclock, cron) never set
 * this, so their queries run with no GUC and the policies admit everything —
 * exactly what those cross-org paths need.
 */
export const orgContext = new AsyncLocalStorage<{ orgId: string }>()

/**
 * RLS enforcement is OPT-IN via RLS_ENFORCED=1.
 *
 * The policies only actually bite when the app connects as a role WITHOUT
 * superuser / BYPASSRLS (a superuser and Supabase's default `postgres` role
 * both bypass RLS entirely). Setup for that role is in
 * prisma/migrations/README-rls.md. Until you've done that AND set RLS_ENFORCED=1
 * we return the plain client, so there is zero change to the data path — no
 * per-query transaction wrapping, no behaviour or performance surprise.
 *
 * When enabled, each tenant-scoped operation is re-run inside a short
 * transaction that first sets the org GUC. Note: with a pooler pinned to
 * connection_limit=1, prefer sequential queries over large Promise.all fan-outs,
 * or raise the connection limit — see the README.
 */
const RLS_ENFORCED = process.env.RLS_ENFORCED === '1'

const globalForPrisma = globalThis as unknown as {
  basePrisma: PrismaClient | undefined
  prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const base =
    globalForPrisma.basePrisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  if (process.env.NODE_ENV !== 'production') globalForPrisma.basePrisma = base

  if (!RLS_ENFORCED) return base

  const extended = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = orgContext.getStore()
          if (!ctx?.orgId) return query(args)

          // Pin this operation to the tenant with a transaction-local GUC. The
          // set_config and the operation share one connection inside the
          // transaction, so RLS sees `app.current_org_id`. is_local = true means
          // it never leaks to a reused pooled connection. We re-dispatch on `tx`
          // rather than calling query() — query() would run outside this
          // transaction's connection and the GUC wouldn't apply.
          const delegate = model.charAt(0).toLowerCase() + model.slice(1)
          return base.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`
            return (tx as unknown as Record<string, Record<string, (a: unknown) => unknown>>)[
              delegate
            ][operation](args)
          })
        },
      },
    },
  })

  return extended as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
