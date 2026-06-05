import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import {
  peekRateLimit,
  incrementRateLimit,
  resetRateLimit,
  getClientIpFromHeaders,
} from '@/lib/rateLimit'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        const email = (credentials.email as string).trim().toLowerCase()
        const ip = getClientIpFromHeaders(
          req.headers as Record<string, string | string[] | undefined> | undefined
        )

        // Two-tier rate limit:
        //   1) Per-email: 10 failed attempts per 15 min. Protects individual
        //      accounts from brute-force without punishing co-workers who share
        //      an office IP/NAT.
        //   2) Per-IP: 50 failed attempts per 15 min. Catches one attacker
        //      spraying many accounts from a single source. Set high enough
        //      that an entire office's mistyped passwords won't trip it.
        //
        // IMPORTANT: when the IP can't be identified (no x-forwarded-for /
        // x-real-ip — e.g. localhost, or a misconfigured proxy), we SKIP the
        // IP tier entirely. Otherwise every user without a header lumps into
        // one shared "unknown" bucket and locks the whole product out.
        // We PEEK before verifying credentials, then only increment on failure,
        // so successful logins never consume the bucket.
        const emailKey = `login:email:${email}`
        const emailLimit = { max: 10, windowMs: 15 * 60 * 1000 }
        const ipLimit = { max: 50, windowMs: 15 * 60 * 1000 }
        const hasIp = ip !== 'unknown'
        const ipKey = hasIp ? `login:ip:${ip}` : null

        const [emailPeek, ipPeek] = await Promise.all([
          peekRateLimit(emailKey, emailLimit),
          ipKey ? peekRateLimit(ipKey, ipLimit) : Promise.resolve({ allowed: true, remaining: ipLimit.max, retryAfterSeconds: 0 }),
        ])
        if (!emailPeek.allowed || !ipPeek.allowed) {
          throw new Error('RATE_LIMITED')
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { organisation: true },
        })

        const recordFailure = async () => {
          await Promise.all([
            incrementRateLimit(emailKey, emailLimit),
            ipKey ? incrementRateLimit(ipKey, ipLimit) : Promise.resolve(),
          ])
        }

        if (!user || !user.is_active) {
          await recordFailure()
          return null
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        if (!isValid) {
          await recordFailure()
          return null
        }

        // Hard-block unverified emails. Throw a typed error so the login page
        // can show "verify your email" + a resend button instead of the generic
        // "invalid email or password" message.
        if (!user.email_verified_at) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }

        // Successful login — clear the email bucket so a user who fat-fingered
        // their password a few times then succeeded doesn't carry that count.
        // (Leave the IP bucket alone: a shared IP might still have other users
        // failing legitimately, and we shouldn't wipe their state.)
        await resetRateLimit(emailKey)

        const settings = (user.organisation.settings as Record<string, unknown>) ?? {}
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          org_id: user.org_id,
          org_name: user.organisation.name,
          employee_id: user.employee_id ?? undefined,
          trial_ends_at: (settings.trial_ends_at as string) ?? null,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.org_id = (user as any).org_id
        token.org_name = (user as any).org_name
        token.employee_id = (user as any).employee_id
        token.trial_ends_at = (user as any).trial_ends_at
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.org_id = token.org_id as string
      session.user.org_name = token.org_name as string
      session.user.employee_id = token.employee_id as string | undefined
      session.user.trial_ends_at = token.trial_ends_at as string | null | undefined
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Compatibility shim: all API routes call auth() as if it were NextAuth v5
export const auth = () => getServerSession(authOptions)

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
