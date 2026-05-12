import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const SignupSchema = z.object({
  company_name: z.string().min(2),
  subdomain: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
  admin_email: z.string().email(),
  admin_password: z.string().min(8),
  admin_name: z.string().min(2),
  phone: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = SignupSchema.parse(body)

    // Check subdomain is unique
    const existing = await prisma.organisation.findUnique({
      where: { subdomain: data.subdomain },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'This company subdomain is already taken' },
        { status: 400 }
      )
    }

    // Check email is unique
    const existingUser = await prisma.user.findUnique({
      where: { email: data.admin_email },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(data.admin_password, 10)

    // Create org + admin user + default data in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organisation
      const org = await tx.organisation.create({
        data: {
          name: data.company_name,
          subdomain: data.subdomain,
          plan: 'starter',
          settings: {
            pt_state: 'maharashtra',
            tds_regime: 'new',
            payroll_day: 28,
            pf_applicable: true,
            esi_applicable: true,
          },
        },
      })

      // Create HR admin user
      const [firstName, ...lastParts] = data.admin_name.split(' ')
      const lastName = lastParts.join(' ') || 'Admin'

      const user = await tx.user.create({
        data: {
          org_id: org.id,
          email: data.admin_email,
          password: hashedPassword,
          role: 'hr_admin',
        },
      })

      // Create admin employee record
      const employee = await tx.employee.create({
        data: {
          org_id: org.id,
          emp_code: 'EMP0001',
          first_name: firstName,
          last_name: lastName,
          email: data.admin_email,
          phone: data.phone,
          date_of_joining: new Date(),
          employment_type: 'full_time',
          status: 'active',
        },
      })

      // Link user to employee
      await tx.user.update({
        where: { id: user.id },
        data: { employee_id: employee.id },
      })

      // Create default departments
      await tx.department.createMany({
        data: [
          { org_id: org.id, name: 'Engineering', code: 'ENG' },
          { org_id: org.id, name: 'Sales', code: 'SAL' },
          { org_id: org.id, name: 'HR', code: 'HR' },
          { org_id: org.id, name: 'Finance', code: 'FIN' },
          { org_id: org.id, name: 'Operations', code: 'OPS' },
        ],
      })

      // Create default leave types
      await tx.leaveType.createMany({
        data: [
          { org_id: org.id, name: 'Casual Leave', code: 'CL', days_per_year: 12, is_paid: true },
          { org_id: org.id, name: 'Sick Leave', code: 'SL', days_per_year: 12, is_paid: true },
          { org_id: org.id, name: 'Earned Leave', code: 'EL', days_per_year: 18, carry_forward_limit: 15, is_paid: true },
          { org_id: org.id, name: 'Maternity Leave', code: 'ML', days_per_year: 180, is_paid: true, applicable_gender: 'female' },
          { org_id: org.id, name: 'Loss of Pay', code: 'LOP', days_per_year: 0, is_paid: false },
        ],
      })

      // Create default salary structure
      await tx.salaryStructure.create({
        data: {
          org_id: org.id,
          name: 'Standard Structure',
          description: 'Default salary structure',
          is_default: true,
          components: [
            { name: 'Basic', type: 'earning', calc_type: 'percentage_of_ctc', value: 40 },
            { name: 'HRA', type: 'earning', calc_type: 'percentage_of_basic', value: 50 },
            { name: 'Special Allowance', type: 'earning', calc_type: 'remainder', value: null },
          ],
        },
      })

      // Welcome notification
      await tx.notification.create({
        data: {
          org_id: org.id,
          user_id: user.id,
          title: 'Welcome to HRMS!',
          message: `Your workspace for ${data.company_name} is ready. Start by adding your employees.`,
          type: 'success',
        },
      })

      return { org, user }
    })

    return NextResponse.json({
      success: true,
      data: {
        message: 'Account created successfully',
        org_id: result.org.id,
        email: data.admin_email,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues[0].message }, { status: 400 })
    }
    console.error('Signup error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create account' }, { status: 500 })
  }
}