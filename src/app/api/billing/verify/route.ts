import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { getPlan } from '@/lib/plans'

export async function POST(req: NextRequest) {
  try {
    // Only admins can finalize payment / plan upgrade.
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id,
    } = await req.json()

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ success: false, error: 'Invalid payment signature' }, { status: 400 })
    }

    const plan = getPlan(plan_id)

    // Update org plan name
    await prisma.organisation.update({
      where: { id: session.user.org_id },
      data: { plan: plan_id },
    })

    // Update billing fields on the admin employee record (where they actually live in schema)
    if (session.user.employee_id) {
      await prisma.employee.update({
        where: { id: session.user.employee_id },
        data: {
          plan: plan_id,
          plan_employee_limit: plan.employee_limit,
          subscription_status: 'active',
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: { message: `Successfully upgraded to ${plan.name} plan` },
    })
  } catch (error) {
    console.error('Verify payment error:', error)
    return NextResponse.json({ success: false, error: 'Payment verification failed' }, { status: 500 })
  }
}