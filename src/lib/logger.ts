/**
 * Structured logger with PII redaction.
 *
 * Why this exists: `console.error(error)` and `console.log({ user, payload })`
 * are everywhere in this codebase, and they happily dump emails, passwords,
 * bank details, AWS keys, and Razorpay secrets into stdout — which becomes
 * the Vercel/Netlify log stream and any downstream log aggregator.
 *
 * What it does:
 *   - Emits JSON lines (key=value structured logs)
 *   - Auto-redacts any key matching the SENSITIVE_KEYS pattern
 *   - Recursively walks objects + arrays (deep redaction)
 *   - Truncates long strings so a stack trace doesn't blow out a log line
 *   - In dev, pretty-prints for readability; in prod, single-line JSON
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('payroll_run_started', { run_id, employees_count })
 *   logger.error('email_send_failed', { to: '<redacted>', error })
 *
 *   // Or just pass an Error directly — it'll capture name/message/stack:
 *   logger.error('signup_failed', err, { ip })
 */

const isProd = process.env.NODE_ENV === 'production'
const MAX_STRING_LEN = 2000

// Keys whose values should NEVER appear in logs. Matched case-insensitive
// against the FULL key name AND any substring (e.g. `bank_details` matches `bank`).
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey', 'api_key',
  'authorization',
  'cookie',
  'session',
  'aws',
  'razorpay',
  'creditCard', 'credit_card',
  'cvv',
  'ssn', 'pan', 'aadhaar', 'aadhar',
  'bank',
  'iban',
  'csrf',
  'rawKey', 'raw_key',
]

function isSensitive(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEYS.some(s => lower.includes(s.toLowerCase()))
}

function truncate(s: string): string {
  return s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) + '…[truncated]' : s
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[max depth]'
  if (value == null) return value
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncate(value.message),
      stack: value.stack ? truncate(value.stack) : undefined,
    }
  }
  if (Array.isArray(value)) {
    return value.map(v => redact(v, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitive(k) ? '[redacted]' : redact(v, depth + 1)
    }
    return out
  }
  if (typeof value === 'string') return truncate(value)
  return value
}

type Level = 'debug' | 'info' | 'warn' | 'error'

function emit(level: Level, event: string, ...extras: unknown[]) {
  // Coalesce multiple extras into one merged context object.
  const ctx: Record<string, unknown> = {}
  for (const extra of extras) {
    if (extra instanceof Error) {
      ctx.error = redact(extra)
    } else if (extra && typeof extra === 'object') {
      Object.assign(ctx, redact(extra) as Record<string, unknown>)
    }
  }

  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...ctx,
  }

  const out = isProd ? JSON.stringify(line) : `[${level.toUpperCase()}] ${event} ${Object.keys(ctx).length ? JSON.stringify(ctx, null, 2) : ''}`

  if (level === 'error') console.error(out)
  else if (level === 'warn') console.warn(out)
  else console.log(out)
}

export const logger = {
  debug: (event: string, ...extras: unknown[]) => emit('debug', event, ...extras),
  info:  (event: string, ...extras: unknown[]) => emit('info',  event, ...extras),
  warn:  (event: string, ...extras: unknown[]) => emit('warn',  event, ...extras),
  error: (event: string, ...extras: unknown[]) => emit('error', event, ...extras),
}
