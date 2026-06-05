import { prisma } from '@/lib/prisma'

/**
 * Postgres-backed rate limiter.
 *
 * Why Postgres (not in-memory):
 *   The previous version used a JS Map. On serverless runtimes (Vercel,
 *   Netlify) each lambda instance has its own memory, so the limit was
 *   effectively never enforced under real traffic.
 *
 * Why not Redis (yet):
 *   Avoids another piece of infra. Postgres handles this volume fine for
 *   auth-class endpoints. If we ever rate-limit hot paths (>50 req/s) we
 *   should swap to Upstash Redis.
 *
 * Atomicity:
 *   Concurrent increments on the same key are handled via Prisma's atomic
 *   `update` with `{ increment: 1 }` — no read-modify-write race.
 *
 * Cleanup:
 *   Expired rows aren't deleted aggressively. A cheap `deleteMany` runs
 *   on a small percentage of calls (sampled) so the table stays bounded
 *   without a separate cron.
 */

const CLEANUP_PROBABILITY = 0.01 // 1% of calls do a sweep

interface RateLimitOptions {
  max: number       // max requests per window
  windowMs: number  // window size in milliseconds
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

// Fail-open result: returned whenever the DB table is unavailable.
// Rate limiting is best-effort — a missing table must never block legitimate users.
const ALLOW: RateLimitResult = { allowed: true, remaining: 999, retryAfterSeconds: 0 }

export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date()

  try {
    // Probabilistic cleanup of expired rows. Fire-and-forget.
    if (Math.random() < CLEANUP_PROBABILITY) {
      prisma.rateLimitEntry
        .deleteMany({ where: { expires_at: { lt: now } } })
        .catch(() => {})
    }

    // Load current entry. If missing or expired, start a fresh window.
    const existing = await prisma.rateLimitEntry.findUnique({ where: { key } })

    if (!existing || existing.expires_at <= now) {
      await prisma.rateLimitEntry.upsert({
        where: { key },
        create: {
          key,
          count: 1,
          expires_at: new Date(now.getTime() + opts.windowMs),
        },
        update: {
          count: 1,
          expires_at: new Date(now.getTime() + opts.windowMs),
        },
      })
      return { allowed: true, remaining: opts.max - 1, retryAfterSeconds: 0 }
    }

    if (existing.count >= opts.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(
          (existing.expires_at.getTime() - now.getTime()) / 1000
        ),
      }
    }

    const updated = await prisma.rateLimitEntry.update({
      where: { key },
      data: { count: { increment: 1 } },
    })

    return {
      allowed: true,
      remaining: Math.max(opts.max - updated.count, 0),
      retryAfterSeconds: 0,
    }
  } catch {
    // Table doesn't exist yet or DB unreachable — fail open so auth still works.
    return ALLOW
  }
}

/**
 * Extract client IP from a Web `Request`. Trusts `x-forwarded-for` when present
 * (Vercel/Netlify set it). Returns `'unknown'` as a fallback — meaning all
 * traffic without a header gets lumped into one bucket. Consider that the
 * floor of rate-limit effectiveness on a misconfigured deployment.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

/**
 * Like getClientIp but accepts NextAuth v4's `authorize(req)` shape, where
 * `headers` is a plain `IncomingHttpHeaders`-like object (lowercase keys).
 */
export function getClientIpFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined
): string {
  if (!headers) return 'unknown'
  const pick = (h: string | string[] | undefined) =>
    Array.isArray(h) ? h[0] : h
  const fwd = pick(headers['x-forwarded-for'])
  if (fwd) return fwd.split(',')[0].trim()
  const real = pick(headers['x-real-ip'])
  if (real) return real.trim()
  return 'unknown'
}

/**
 * Read the current bucket WITHOUT incrementing it. Use this when you want to
 * decide whether to allow an action based on past failures alone — e.g. only
 * count failed login attempts toward the limit, not successful ones.
 *
 * Fails open: a DB / table problem returns { allowed: true }.
 */
export async function peekRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date()
  try {
    const existing = await prisma.rateLimitEntry.findUnique({ where: { key } })
    if (!existing || existing.expires_at <= now) {
      return { allowed: true, remaining: opts.max, retryAfterSeconds: 0 }
    }
    if (existing.count >= opts.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(
          (existing.expires_at.getTime() - now.getTime()) / 1000
        ),
      }
    }
    return {
      allowed: true,
      remaining: Math.max(opts.max - existing.count, 0),
      retryAfterSeconds: 0,
    }
  } catch {
    return ALLOW
  }
}

/**
 * Increment the bucket. Use after a failed action to "spend" one attempt.
 * If the bucket is missing or expired, starts a fresh window at count=1.
 */
export async function incrementRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<void> {
  const now = new Date()
  try {
    const existing = await prisma.rateLimitEntry.findUnique({ where: { key } })
    if (!existing || existing.expires_at <= now) {
      await prisma.rateLimitEntry.upsert({
        where: { key },
        create: {
          key,
          count: 1,
          expires_at: new Date(now.getTime() + opts.windowMs),
        },
        update: {
          count: 1,
          expires_at: new Date(now.getTime() + opts.windowMs),
        },
      })
      return
    }
    await prisma.rateLimitEntry.update({
      where: { key },
      data: { count: { increment: 1 } },
    })
  } catch {
    // fail open
  }
}

/**
 * Wipe a bucket — call on success when you don't want a partially-filled
 * window to penalize the next legitimate attempt.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await prisma.rateLimitEntry.delete({ where: { key } })
  } catch {
    // already gone or table missing — no-op
  }
}
