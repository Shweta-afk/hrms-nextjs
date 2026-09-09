/**
 * Payroll step-up lock.
 *
 * The org's HR login is often shared by more than one person, but only some
 * of them should be able to see salary/CTC figures. Role (hr_admin/employee)
 * can't express that, so this adds a second, independent password — set by
 * whoever should control payroll visibility — that gates salary-bearing
 * pages and API responses behind a short-lived unlock, separate from the
 * account login.
 */
import { NextRequest } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { BCRYPT_COST } from '@/lib/auth'

export const PAYROLL_UNLOCK_COOKIE = 'payroll_unlock'

// Step-up sessions are intentionally short — this isn't a login, it's a
// "prove you're allowed to see this right now" gate on a shared account.
export const PAYROLL_UNLOCK_TTL_MS = 30 * 60 * 1000

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return secret
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

// `loginId` is the session's stable per-sign-in id (session.user.login_id /
// token.login_id) — NOT the JWT's iat, which next-auth rotates on routine
// session refreshes. Binding to it means logging out and back in (even on
// the same shared account) invalidates any previous unlock immediately,
// regardless of how much of the 30-min window was left.
export function createUnlockToken(orgId: string, loginId: string): { token: string; maxAgeSec: number } {
  const expiresAt = Date.now() + PAYROLL_UNLOCK_TTL_MS
  const payload = `${orgId}.${loginId}.${expiresAt}`
  return { token: `${payload}.${sign(payload)}`, maxAgeSec: Math.floor(PAYROLL_UNLOCK_TTL_MS / 1000) }
}

export function isUnlockTokenValid(token: string | undefined | null, orgId: string, loginId: string): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 4) return false
  const [tokenOrgId, tokenLoginId, expiresAtStr, sig] = parts
  if (tokenOrgId !== orgId || tokenLoginId !== loginId) return false
  // timing-safe compare — this token gates real salary data
  const expectedSig = sign(`${tokenOrgId}.${tokenLoginId}.${expiresAtStr}`)
  if (expectedSig.length !== sig.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig))) return false
  const expiresAt = Number(expiresAtStr)
  return Number.isFinite(expiresAt) && Date.now() <= expiresAt
}

/** Node-runtime only (uses Node's `crypto`) — safe in proxy.ts and route handlers on this app. */
export function isPayrollUnlocked(req: NextRequest, orgId: string, loginId: string): boolean {
  return isUnlockTokenValid(req.cookies.get(PAYROLL_UNLOCK_COOKIE)?.value, orgId, loginId)
}

type JsonRecord = Record<string, unknown>

export async function getPayrollPasswordHash(orgId: string): Promise<string | null> {
  const org = await prisma.organisation.findUnique({ where: { id: orgId }, select: { settings: true } })
  const settings = (org?.settings ?? {}) as JsonRecord
  const payrollAccess = (settings.payroll_access ?? {}) as JsonRecord
  return (payrollAccess.password_hash as string | undefined) ?? null
}

export async function setPayrollPasswordHash(orgId: string, newPassword: string): Promise<void> {
  const org = await prisma.organisation.findUnique({ where: { id: orgId }, select: { settings: true } })
  const settings = (org?.settings ?? {}) as JsonRecord
  const password_hash = await bcrypt.hash(newPassword, BCRYPT_COST)
  await prisma.organisation.update({
    where: { id: orgId },
    data: { settings: { ...settings, payroll_access: { password_hash } } },
  })
}

export async function verifyPayrollPassword(orgId: string, password: string): Promise<boolean> {
  const hash = await getPayrollPasswordHash(orgId)
  if (!hash) return false
  return bcrypt.compare(password, hash)
}
