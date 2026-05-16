import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null

        const ip = getClientIp(request as unknown as Request)
        const rl = checkRateLimit(`login:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 })
        if (!rl.allowed) return null

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
})

export const { GET, POST } = handlers