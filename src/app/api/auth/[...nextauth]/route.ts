import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from '@/lib/rateLimit'
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

        // Rate limit by IP
        const forwarded = req.headers?.['x-forwarded-for'] as string | undefined
        const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
        const rl = await checkRateLimit(`login:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 })
        if (!rl.allowed) {
          // Surface a distinct error so the client can display "too many attempts"
          throw new Error('RATE_LIMITED')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { organisation: true },
        })

        if (!user || !user.is_active) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        if (!isValid) return null

        // Hard-block unverified emails. Throw a typed error so the login page
        // can show "verify your email" + a resend button instead of the generic
        // "invalid email or password" message.
        if (!user.email_verified_at) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }

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
