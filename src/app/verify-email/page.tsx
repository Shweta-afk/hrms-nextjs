'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react'

type Status = 'loading' | 'success' | 'error' | 'no-token'

function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') ?? ''
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'no-token')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const json = await res.json()
        if (cancelled) return

        if (res.ok && json.success) {
          setStatus('success')
        } else {
          setStatus('error')
          setError(json.error ?? 'Verification failed')
        }
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setError('Network error — please try again')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-10 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-indigo-600 mx-auto animate-spin" />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Verifying your email…
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This will just take a moment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" strokeWidth={2} />
            </div>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Email verified
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Your account is ready. Sign in to get started.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Go to sign in →
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-red-100 dark:bg-red-900/40">
              <XCircle className="h-7 w-7 text-red-600" strokeWidth={2} />
            </div>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Verification failed
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
            <p className="mt-1 text-xs text-zinc-500">
              The link may have expired (24h limit) or already been used.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Back to sign in
            </Link>
          </>
        )}

        {status === 'no-token' && (
          <>
            <div className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Mail className="h-7 w-7 text-zinc-600 dark:text-zinc-400" strokeWidth={2} />
            </div>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Check your inbox
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              We've sent you a verification link. Click it from your email to activate your account.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen grid place-items-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  )
}
