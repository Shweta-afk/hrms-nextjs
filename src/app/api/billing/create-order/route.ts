import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import Razorpay from 'razorpay'
import { getPlan } from '@/lib/plans'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { plan_id } = await req.json()
    const plan = getPlan(plan_id)

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: plan.price_monthly * 100, // paise
      currency: 'INR',
      receipt: `order_${session.user.org_id}_${Date.now()}`,
      notes: {
        org_id: session.user.org_id,
        plan_id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        plan,
      },
    })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create order' }, { status: 500 })
  }
}