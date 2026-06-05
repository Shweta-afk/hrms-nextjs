'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get('redirect')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errorKind, setErrorKind] = useState<'generic' | 'unverified' | 'rate_limited'>('generic')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResendMsg('')
    setErrorKind('generic')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      // NextAuth surfaces the error message we threw from authorize() in result.error
      if (result.error === 'EMAIL_NOT_VERIFIED') {
        setErrorKind('unverified')
        setError('Please verify your email before signing in.')
      } else if (result.error === 'RATE_LIMITED') {
        setErrorKind('rate_limited')
        setError('Too many sign-in attempts. Please wait 15 minutes and try again.')
      } else {
        setErrorKind('generic')
        setError('Invalid email or password')
      }
      setLoading(false)
    } else {
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        const sessionRes = await fetch('/api/auth/session')
        const sessionData = await sessionRes.json()
        if (sessionData?.user?.role === 'employee') {
          router.push('/portal')
        } else {
          router.push('/dashboard')
        }
      }
    }
  }

  async function handleResendVerification() {
    if (!email || resending) return
    setResending(true)
    setResendMsg('')
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      setResendMsg(
        res.ok
          ? '✓ If an unverified account exists for this email, a fresh verification link has been sent.'
          : (json.error ?? 'Failed to resend')
      )
    } catch {
      setResendMsg('Network error — please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="bg-card text-card-foreground p-8 rounded-lg shadow-md w-full max-w-md border border-border">
      <div className="flex justify-center mb-5">
        <img src="/lightmodelogo.webp" alt="Axiotta HRMS" className="h-10 w-auto object-contain dark:hidden" />
        <img src="/darkmodelogo.webp" alt="Axiotta HRMS" className="h-10 w-auto object-contain hidden dark:block" />
      </div>
      <p className="text-muted-foreground mb-6 text-center">Sign in to your account</p>

      {error && (
        <div className={`${errorKind === 'unverified' ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'} px-4 py-3 rounded mb-4 text-sm`}>
          <p>{error}</p>
          {errorKind === 'unverified' && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending || !email}
                className="underline underline-offset-2 hover:no-underline disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
            </div>
          )}
          {resendMsg && (
            <p className="mt-2 text-xs text-zinc-700">{resendMsg}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-input bg-background text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="admin@demo.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-input bg-background text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="••••••••"
            required
          />
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Employee note */}
      <div className="mt-5 rounded-md bg-blue-50 border border-blue-100 px-4 py-3 dark:bg-blue-900/20 dark:border-blue-800">
        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-0.5">Employee?</p>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Use the <strong>same login page</strong> with the email and password sent by your HR admin.
          You'll be taken to your employee portal automatically after signing in.
        </p>
      </div>

      <p className="text-xs text-center text-muted-foreground mt-4">
        Don't have an account?{' '}
        <Link href="/signup" className="text-blue-600 hover:underline font-medium">
          Create one free
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Suspense fallback={<div className="animate-pulse h-96 w-full max-w-md bg-white rounded-lg shadow-md" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
