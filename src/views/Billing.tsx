'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Zap, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PLANS } from '@/lib/plans'

declare global {
  interface Window { Razorpay: any }
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

const BillingPage = () => {
  const [currentPlan, setCurrentPlan] = useState('starter')
  const [loading, setLoading] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('Your Company')

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)

    // Fetch current plan
    fetch('/api/billing/status')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setCurrentPlan(json.data.plan)
          setOrgName(json.data.name)
        }
      })
      .catch(console.error)

    return () => { document.body.removeChild(script) }
  }, [])

  async function handleUpgrade(planId: string) {
    if (planId === currentPlan) return
    setLoading(planId)

    try {
      // Create order
      const res = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      })
      const json = await res.json()
      if (!json.success) { toast.error(json.error); return }

      const { order_id, amount, plan } = json.data

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount,
        currency: 'INR',
        name: 'HRMS SaaS',
        description: `${plan.name} Plan — Monthly`,
        order_id,
        handler: async (response: any) => {
          // Verify payment
          const verifyRes = await fetch('/api/billing/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: planId,
            }),
          })
          const verifyJson = await verifyRes.json()
          if (verifyJson.success) {
            toast.success(`Upgraded to ${plan.name} plan!`)
            setCurrentPlan(planId)
          } else {
            toast.error('Payment verification failed')
          }
        },
        prefill: { name: orgName },
        theme: { color: '#4f46e5' },
        modal: { ondismiss: () => setLoading(null) },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch {
      toast.error('Failed to initiate payment')
    } finally {
      setLoading(null)
    }
  }

  return (
    <AppLayout title="Billing">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Plans</h1>
          <p className="text-muted-foreground mt-1">
            Currently on <Badge className="ml-1 capitalize">{currentPlan}</Badge> plan
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan
            const isPopular = plan.popular

            return (
              <Card key={plan.id} className={`relative ${isPopular ? 'ring-2 ring-primary shadow-lg' : ''}`}>
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1 bg-primary text-primary-foreground">
                      <Zap className="h-3 w-3" /> Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{fmt(plan.price_monthly)}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Up to {plan.employee_limit} employees</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-kpi-green mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || loading === plan.id}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {loading === plan.id ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                    ) : isCurrent ? (
                      '✓ Current Plan'
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Billing info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Plan</span>
              <span className="font-medium capitalize">{currentPlan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billing Cycle</span>
              <span className="font-medium">Monthly</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium">Razorpay</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST</span>
              <span className="font-medium">18% applicable</span>
            </div>
            <p className="text-xs text-muted-foreground pt-2 border-t">
              All prices are in INR and exclude GST. Payments are processed securely via Razorpay.
              Cancel anytime — no lock-in.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

export default BillingPage