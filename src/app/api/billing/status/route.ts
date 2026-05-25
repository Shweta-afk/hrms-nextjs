import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Billing status exposes plan / razorpay / billing_email — admin-only.
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const org = await prisma.organisation.findUnique({
      where: { id: session.user.org_id },
      select: { name: true, plan: true },
    })

    // Billing fields (razorpay, subscription) live on the admin employee record
    const billingEmployee = session.user.employee_id
      ? await prisma.employee.findFirst({
          where: { id: session.user.employee_id, org_id: session.user.org_id },
          select: {
            plan: true,
            plan_employee_limit: true,
            subscription_status: true,
            trial_ends_at: true,
            billing_email: true,
            razorpay_customer_id: true,
            razorpay_subscription_id: true,
          },
        })
      : null

    const activeCount = await prisma.employee.count({
      where: { org_id: session.user.org_id, status: 'active' },
    })

    return NextResponse.json({
      success: true,
      data: {
        name: org?.name,
        plan: billingEmployee?.plan ?? org?.plan ?? 'starter',
        plan_employee_limit: billingEmployee?.plan_employee_limit ?? 25,
        subscription_status: billingEmployee?.subscription_status ?? 'active',
        trial_ends_at: billingEmployee?.trial_ends_at ?? null,
        billing_email: billingEmployee?.billing_email ?? null,
        active_employees: activeCount,
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch billing status' }, { status: 500 })
  }
}