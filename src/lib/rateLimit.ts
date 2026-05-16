interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

interface RateLimitOptions {
  max: number       // max requests per window
  windowMs: number  // window size in milliseconds
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const win = store.get(key)

  if (!win || now > win.resetAt) {
    // Start fresh window
    store.set(key, { count: 1, resetAt: now + opts.windowMs })
    return { allowed: true, remaining: opts.max - 1, retryAfterSeconds: 0 }
  }

  if (win.count >= opts.max) {
    const retryAfterSeconds = Math.ceil((win.resetAt - now) / 1000)
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  win.count++
  return { allowed: true, remaining: opts.max - win.count, retryAfterSeconds: 0 }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
