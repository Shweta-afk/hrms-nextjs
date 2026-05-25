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

export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date()

  // Probabilistic cleanup of expired rows. Fire-and-forget so it doesn't
  // block the rate-limit decision.
  if (Math.random() < CLEANUP_PROBABILITY) {
    prisma.rateLimitEntry
      .deleteMany({ where: { expires_at: { lt: now } } })
      .catch(() => {}) // ignore — best effort
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
    const retryAfterSeconds = Math.ceil(
      (existing.expires_at.getTime() - now.getTime()) / 1000
    )
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  // Atomic increment — concurrent callers can't both succeed at the cap boundary.
  const updated = await prisma.rateLimitEntry.update({
    where: { key },
    data: { count: { increment: 1 } },
  })

  return {
    allowed: true,
    remaining: Math.max(opts.max - updated.count, 0),
    retryAfterSeconds: 0,
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
