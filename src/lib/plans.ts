export interface Plan {
  id: string
  name: string
  price_monthly: number
  employee_limit: number
  features: string[]
  razorpay_plan_id?: string
  popular?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price_monthly: 2999,
    employee_limit: 25,
    features: [
      'Up to 25 employees',
      'Attendance management',
      'Leave management',
      'Basic payroll',
      'Employee self-service',
      'Email support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price_monthly: 6999,
    employee_limit: 100,
    popular: true,
    features: [
      'Up to 100 employees',
      'Everything in Starter',
      'Advanced payroll + compliance',
      'Recruitment module',
      'HR analytics',
      'ESSL integration',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_monthly: 14999,
    employee_limit: 500,
    features: [
      'Up to 500 employees',
      'Everything in Growth',
      'Custom salary structures',
      'Form 16 generation',
      'Dedicated account manager',
      'Custom integrations',
      'SLA support',
    ],
  },
]

export function getPlan(planId: string): Plan {
  return PLANS.find(p => p.id === planId) ?? PLANS[0]
}

export function canAddEmployee(currentCount: number, planId: string): boolean {
  const plan = getPlan(planId)
  return currentCount < plan.employee_limit
}