import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendWelcomeEmail } from '@/lib/email'
import { BCRYPT_COST } from '@/lib/auth'

/**
 * POST /api/employees/[id]/invite
 *
 * Creates (or resets) a portal User account for the employee and sends
 * a welcome email with their login credentials.
 *
 * - If no User exists: creates one with a temp password.
 * - If User already exists: resets to a new temp password and resends.
 * - Fails if employee email is a placeholder (@company.com).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Only HR admins can send invites' }, { status: 403 })
    }

    const { id: employeeId } = await params
    const org_id = session.user.org_id

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, org_id },
      select: {
        id: true, first_name: true, last_name: true,
        email: true, emp_code: true, status: true,
      },
    })

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }
    if (employee.status === 'terminated') {
      return NextResponse.json({ success: false, error: 'Cannot invite a terminated employee' }, { status: 400 })
    }

    // Reject placeholder emails
    if (!employee.email || employee.email.endsWith('@company.com') || !employee.email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Please update the employee\'s real email address before sending an invite' },
        { status: 400 }
      )
    }

    // Get org name for the email
    const org = await prisma.organisation.findUnique({
      where: { id: org_id },
      select: { name: true },
    })

    // Generate a human-friendly temp password: Abc1-xyz2
    const rawPassword = generateTempPassword()
    const hashedPassword = await bcrypt.hash(rawPassword, BCRYPT_COST)

    // Generate a fresh verification token so the recipient must prove email ownership
    // before they can log in. Token expires in 24h.
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const existingUser = await prisma.user.findUnique({
      where: { email: employee.email },
    })

    if (existingUser) {
      // Reset their password and re-issue verification (in case the email was wrong)
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          is_active: true,
          employee_id: employeeId,   // ensure linkage
          email_verified_at: existingUser.email_verified_at,  // preserve if already verified
          ...(existingUser.email_verified_at
            ? {} // already verified — no token needed
            : {
                email_verification_token: verificationToken,
                email_verification_expiry: verificationExpiry,
              }),
        },
      })
    } else {
      // Create new User account — UNVERIFIED. Must click verify link before login.
      await prisma.user.create({
        data: {
          org_id,
          employee_id: employeeId,
          email: employee.email,
          password: hashedPassword,
          role: 'employee',
          is_active: true,
          email_verification_token: verificationToken,
          email_verification_expiry: verificationExpiry,
        },
      })
    }

    // Send welcome + verification email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`

    try {
      // Welcome email (with temp password)
      await sendWelcomeEmail({
        to:           employee.email,
        name:         `${employee.first_name} ${employee.last_name}`,
        company:      org?.name ?? session.user.org_name ?? 'Your Company',
        tempPassword: rawPassword,
      })

      // Separate verification email so the link is in its own message
      const { sendVerificationEmail } = await import('@/lib/email')
      const alreadyVerified = existingUser?.email_verified_at != null
      if (!alreadyVerified) {
        await sendVerificationEmail({
          to:        employee.email,
          name:      `${employee.first_name} ${employee.last_name}`,
          verifyUrl,
          company:   org?.name ?? session.user.org_name ?? 'Your Company',
        })
      }
    } catch (emailErr) {
      console.error('Welcome email failed to send:', emailErr)
      // Still return success — user account was created; HR can resend manually
      return NextResponse.json({
        success: true,
        warning: 'Account created but email delivery failed. Please check your Resend configuration.',
        data: { email: employee.email },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        email: employee.email,
        message: existingUser ? 'Password reset and invite resent' : 'Account created and invite sent',
      },
    })
  } catch (error) {
    console.error('POST /api/employees/[id]/invite error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send invite' }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a readable 10-char temp password like  Kx7q-Rm2p
 * Avoids ambiguous chars (0/O, 1/l/I).
 */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const pick = () => chars[crypto.randomInt(chars.length)]
  return `${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`
}
