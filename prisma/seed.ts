import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Seeds a demo org with the SAME defaults the /api/auth/signup endpoint
 * creates for a brand-new tenant. Re-runnable: uses upserts everywhere
 * so running it twice is safe.
 *
 * After running: log in with admin@demo.com / admin123 (role: hr_admin).
 */
async function main() {
  // ── 1. Organisation ────────────────────────────────────────────────────
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const org = await prisma.organisation.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      name: 'Demo Company Pvt Ltd',
      subdomain: 'demo',
      plan: 'growth',
      settings: {
        pt_state: 'maharashtra',
        tds_regime: 'new',
        payroll_day: 28,
        pf_applicable: true,
        esi_applicable: true,
        trial_ends_at: trialEndsAt,
      },
    },
  })
  console.log('✓ Organisation:', org.name)

  // ── 2. HR Admin user ───────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {
      // If re-running after adding email verification, make sure the seeded
      // admin is marked verified so dev login keeps working.
      email_verified_at: new Date(),
    },
    create: {
      org_id: org.id,
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'hr_admin',
      email_verified_at: new Date(), // seeded users skip verification
    },
  })
  console.log('✓ Admin user:', user.email)

  // ── 3. Admin's Employee record + link to user ──────────────────────────
  let adminEmployee = await prisma.employee.findFirst({
    where: { org_id: org.id, emp_code: 'EMP0001' },
  })
  if (!adminEmployee) {
    adminEmployee = await prisma.employee.create({
      data: {
        org_id: org.id,
        emp_code: 'EMP0001',
        first_name: 'Demo',
        last_name: 'Admin',
        email: 'admin@demo.com',
        date_of_joining: new Date(),
        employment_type: 'full_time',
        status: 'active',
      },
    })
    await prisma.user.update({
      where: { id: user.id },
      data: { employee_id: adminEmployee.id },
    })
  }
  console.log('✓ Admin employee record (EMP0001) linked')

  // ── 4. Default Departments ─────────────────────────────────────────────
  const departments = [
    { name: 'Engineering', code: 'ENG' },
    { name: 'Sales',       code: 'SAL' },
    { name: 'HR',          code: 'HR'  },
    { name: 'Finance',     code: 'FIN' },
    { name: 'Operations',  code: 'OPS' },
  ]
  for (const d of departments) {
    const exists = await prisma.department.findFirst({
      where: { org_id: org.id, code: d.code },
    })
    if (!exists) await prisma.department.create({ data: { ...d, org_id: org.id } })
  }
  console.log(`✓ ${departments.length} default departments`)

  // ── 5. Default Leave Types ─────────────────────────────────────────────
  const leaveTypes = [
    { name: 'Casual Leave',    code: 'CL',  days_per_year: 12,  is_paid: true,  carry_forward_limit: 0  },
    { name: 'Sick Leave',      code: 'SL',  days_per_year: 12,  is_paid: true,  carry_forward_limit: 0  },
    { name: 'Earned Leave',    code: 'EL',  days_per_year: 18,  is_paid: true,  carry_forward_limit: 15 },
    { name: 'Maternity Leave', code: 'ML',  days_per_year: 182, is_paid: true,  carry_forward_limit: 0, applicable_gender: 'female' }, // Maternity Benefit Act 1961: 26 weeks = 182 days
    { name: 'Loss of Pay',     code: 'LOP', days_per_year: 0,   is_paid: false, carry_forward_limit: 0  },
  ]
  for (const lt of leaveTypes) {
    const exists = await prisma.leaveType.findFirst({
      where: { org_id: org.id, code: lt.code },
    })
    if (!exists) await prisma.leaveType.create({ data: { ...lt, org_id: org.id } })
  }
  console.log(`✓ ${leaveTypes.length} default leave types`)

  // ── 6. Default Salary Structure ────────────────────────────────────────
  const existingStructure = await prisma.salaryStructure.findFirst({
    where: { org_id: org.id, is_default: true },
  })
  if (!existingStructure) {
    await prisma.salaryStructure.create({
      data: {
        org_id: org.id,
        name: 'Standard Structure',
        description: 'Default salary structure',
        is_default: true,
        components: [
          { name: 'Basic',             type: 'earning', calc_type: 'percentage_of_ctc',   value: 40   },
          { name: 'HRA',               type: 'earning', calc_type: 'percentage_of_basic', value: 50   },
          { name: 'Special Allowance', type: 'earning', calc_type: 'remainder',           value: null },
        ],
      },
    })
  }
  console.log('✓ Default salary structure')

  // ── 7. Welcome Notification ────────────────────────────────────────────
  const existingNotif = await prisma.notification.findFirst({
    where: { user_id: user.id, title: 'Welcome to HRMS!' },
  })
  if (!existingNotif) {
    await prisma.notification.create({
      data: {
        org_id: org.id,
        user_id: user.id,
        title: 'Welcome to HRMS!',
        message: `Your workspace for ${org.name} is ready. Start by adding your employees.`,
        type: 'success',
      },
    })
  }
  console.log('✓ Welcome notification')

  // ── 8. Sample attendance for the current month ─────────────────────────
  // Without this, payroll for the demo admin shows full LOP (since they have
  // no biometric punches). We seed a "present at 9:05 AM, out at 6:30 PM"
  // record for every weekday in the current month up to today.
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  let attendanceCreated = 0
  for (let d = new Date(monthStart); d <= todayUTC; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay()
    if (dow === 0 || dow === 6) continue // skip weekends

    const date = new Date(d)
    const firstIn = new Date(date); firstIn.setUTCHours(9, 5, 0, 0)
    const lastOut = new Date(date); lastOut.setUTCHours(18, 30, 0, 0)

    const exists = await prisma.attendanceRecord.findUnique({
      where: {
        org_id_employee_id_date: {
          org_id: org.id,
          employee_id: adminEmployee.id,
          date,
        },
      },
    })
    if (!exists) {
      await prisma.attendanceRecord.create({
        data: {
          org_id: org.id,
          employee_id: adminEmployee.id,
          date,
          first_in: firstIn,
          last_out: lastOut,
          total_hours: 9.42,
          status: 'present',
          is_late: false,
          source: 'seed',
        },
      })
      attendanceCreated++
    }
  }
  console.log(`✓ ${attendanceCreated} sample attendance records for current month`)

  console.log('\n────────────────────────────────────────')
  console.log('Login credentials:')
  console.log('  Email:    admin@demo.com')
  console.log('  Password: admin123')
  console.log('  Role:     hr_admin')
  console.log('────────────────────────────────────────')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
