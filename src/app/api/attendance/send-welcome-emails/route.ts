import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import bcrypt from 'bcryptjs'
import { BCRYPT_COST } from '@/lib/auth'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    // Expects: { employee_ids: string[] }
    const { employee_ids } = await req.json()
    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'No employee IDs provided' }, { status: 400 })
    }

    const org = await prisma.organisation.findUnique({
      where: { id: session.user.org_id },
      select: { name: true, settings: true },
    })
    const orgName = org?.name ?? 'Company'

    const employees = await prisma.employee.findMany({
      where: { id: { in: employee_ids }, org_id: session.user.org_id },
      include: { user: true },
    })

    const results: { emp_code: string; name: string; status: string; error?: string }[] = []

    for (const emp of employees) {
      const fullName = `${emp.first_name} ${emp.last_name}`

      if (!emp.email || emp.email.endsWith('@imported.local')) {
        results.push({ emp_code: emp.emp_code, name: fullName, status: 'skipped', error: 'No real email address — update in Employees first' })
        continue
      }

      try {
        if (emp.user) {
          // User account already exists — just send a portal link reminder
          await sendWelcomeEmail({
            to: emp.email,
            name: emp.first_name,
            company: orgName,
            tempPassword: '(use your existing password)',
          })
        } else {
          // Create a user account for this employee
          const tempPassword = generateTempPassword()
          const hashed = await bcrypt.hash(tempPassword, BCRYPT_COST)

          const user = await prisma.user.create({
            data: {
              org_id:              session.user.org_id,
              employee_id:         emp.id,
              email:               emp.email,
              password:            hashed,
              role:                'employee',
              email_verified_at:   new Date(), // pre-verified by HR
            },
          })

          // Link employee → user
          await prisma.employee.update({
            where: { id: emp.id },
            data: { /* user relation auto-linked via user.employee_id */ },
          })

          await sendWelcomeEmail({
            to: emp.email,
            name: emp.first_name,
            company: orgName,
            tempPassword,
          })
        }
        results.push({ emp_code: emp.emp_code, name: fullName, status: 'sent' })
      } catch (emailErr) {
        const msg = emailErr instanceof Error ? emailErr.message : 'Send failed'
        results.push({ emp_code: emp.emp_code, name: fullName, status: 'error', error: msg })
      }
    }

    const sent    = results.filter(r => r.status === 'sent').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors  = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success: true,
      data: {
        sent, skipped, errors, results,
        message: `Emails sent: ${sent}${skipped ? `, skipped (no email): ${skipped}` : ''}${errors ? `, failed: ${errors}` : ''}`,
      },
    })
  } catch (error) {
    console.error('send_welcome_emails_failed', error)
    return NextResponse.json({ success: false, error: 'Failed to send emails' }, { status: 500 })
  }
}
