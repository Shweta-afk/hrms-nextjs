'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    company_name: '',
    subdomain: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
    phone: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleCompanyName(value: string) {
    const subdomain = value.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30)
    setForm(p => ({ ...p, company_name: value, subdomain }))
    setErrors(p => ({ ...p, company_name: '', subdomain: '' }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.company_name.trim()) e.company_name = 'Company name is required'
    if (!form.subdomain.trim()) e.subdomain = 'Subdomain is required'
    if (!/^[a-z0-9-]+$/.test(form.subdomain)) e.subdomain = 'Only lowercase letters, numbers and hyphens'
    if (!form.admin_name.trim()) e.admin_name = 'Your name is required'
    if (!form.admin_email.trim()) e.admin_email = 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email)) e.admin_email = 'Invalid email'
    if (!form.admin_password) e.admin_password = 'Password is required'
    if (form.admin_password.length < 8) e.admin_password = 'Password must be at least 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        setSuccess(true)
        toast.success('Account created! Setting up your workspace...')
        setTimeout(() => router.push('/login?redirect=/onboarding'), 2000)
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
            <p className="text-muted-foreground">
              Your HRMS workspace is ready. Redirecting to login...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">HRMS</h1>
          <p className="text-gray-500 mt-2">Set up your company's HR platform in 2 minutes</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Free to start · No credit card required</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Company */}
              <div className="space-y-1.5">
                <Label>Company Name *</Label>
                <Input
                  placeholder="Acme Technologies Pvt. Ltd."
                  value={form.company_name}
                  onChange={e => handleCompanyName(e.target.value)}
                  className={errors.company_name ? 'border-destructive' : ''}
                />
                {errors.company_name && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {errors.company_name}
                  </p>
                )}
              </div>

              {/* Subdomain */}
              <div className="space-y-1.5">
                <Label>Workspace URL *</Label>
                <div className="flex items-center gap-0">
                  <Input
                    placeholder="acme"
                    value={form.subdomain}
                    onChange={e => { setForm(p => ({ ...p, subdomain: e.target.value.toLowerCase() })); setErrors(p => ({ ...p, subdomain: '' })) }}
                    className={`rounded-r-none ${errors.subdomain ? 'border-destructive' : ''}`}
                  />
                  <div className="px-3 py-2 bg-muted border border-l-0 border-border rounded-r-md text-sm text-muted-foreground whitespace-nowrap">
                    .hrms.in
                  </div>
                </div>
                {errors.subdomain ? (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {errors.subdomain}
                  </p>
                ) : form.subdomain && (
                  <p className="text-xs text-muted-foreground">
                    Your login URL: <span className="font-medium text-foreground">{form.subdomain}.hrms.in</span>
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-foreground mb-4">Your Admin Account</p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Your Full Name *</Label>
                    <Input
                      placeholder="Rahul Sharma"
                      value={form.admin_name}
                      onChange={e => { setForm(p => ({ ...p, admin_name: e.target.value })); setErrors(p => ({ ...p, admin_name: '' })) }}
                      className={errors.admin_name ? 'border-destructive' : ''}
                    />
                    {errors.admin_name && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.admin_name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Work Email *</Label>
                    <Input
                      type="email"
                      placeholder="rahul@acmetech.in"
                      value={form.admin_email}
                      onChange={e => { setForm(p => ({ ...p, admin_email: e.target.value })); setErrors(p => ({ ...p, admin_email: '' })) }}
                      className={errors.admin_email ? 'border-destructive' : ''}
                    />
                    {errors.admin_email && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.admin_email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Password *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Minimum 8 characters"
                        value={form.admin_password}
                        onChange={e => { setForm(p => ({ ...p, admin_password: e.target.value })); setErrors(p => ({ ...p, admin_password: '' })) }}
                        className={`pr-10 ${errors.admin_password ? 'border-destructive' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.admin_password && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.admin_password}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Phone (optional)</Label>
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating your workspace...</>
                  : 'Create Account & Start Free'
                }
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By signing up you agree to our Terms of Service and Privacy Policy.
                Your data is stored securely in India.
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}