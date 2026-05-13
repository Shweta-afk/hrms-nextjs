import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'hr@hrms.in'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ── Welcome email when employee is added ──
export async function sendWelcomeEmail({
  to,
  name,
  company,
  tempPassword,
}: {
  to: string
  name: string
  company: string
  tempPassword: string
}) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to ${company} HRMS — Your Login Details`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1e1b4b">Welcome to ${company} HRMS 👋</h2>
        <p>Hi ${name},</p>
        <p>Your HRMS account has been created. Here are your login details:</p>
        <div style="background:#f5f5ff;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0"><strong>Login URL:</strong> <a href="${APP_URL}/login">${APP_URL}/login</a></p>
          <p style="margin:8px 0 0"><strong>Email:</strong> ${to}</p>
          <p style="margin:8px 0 0"><strong>Temporary Password:</strong> <code style="background:#e8e8ff;padding:2px 6px;border-radius:4px">${tempPassword}</code></p>
        </div>
        <p style="color:#ef4444"><strong>Important:</strong> Please change your password after first login.</p>
        <p>You can use the employee portal to view your payslips, apply for leave, and check attendance.</p>
        <p>Best regards,<br/>HR Team — ${company}</p>
      </div>
    `,
  })
}

// ── Leave approval/rejection email ──
export async function sendLeaveStatusEmail({
  to,
  name,
  status,
  leaveType,
  fromDate,
  toDate,
  days,
  reason,
  company,
}: {
  to: string
  name: string
  status: 'approved' | 'rejected'
  leaveType: string
  fromDate: string
  toDate: string
  days: number
  reason?: string
  company: string
}) {
  const isApproved = status === 'approved'
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Leave ${isApproved ? 'Approved' : 'Rejected'} — ${leaveType}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:${isApproved ? '#16a34a' : '#dc2626'}">
          Leave ${isApproved ? '✅ Approved' : '❌ Rejected'}
        </h2>
        <p>Hi ${name},</p>
        <p>Your leave request has been <strong>${status}</strong>.</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0"><strong>Leave Type:</strong> ${leaveType}</p>
          <p style="margin:8px 0 0"><strong>From:</strong> ${fromDate}</p>
          <p style="margin:8px 0 0"><strong>To:</strong> ${toDate}</p>
          <p style="margin:8px 0 0"><strong>Days:</strong> ${days}</p>
          ${reason ? `<p style="margin:8px 0 0"><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
        ${!isApproved ? '<p>Please contact HR if you have questions.</p>' : '<p>Enjoy your time off!</p>'}
        <p>Best regards,<br/>HR Team — ${company}</p>
      </div>
    `,
  })
}

// ── Payslip available email ──
export async function sendPayslipEmail({
  to,
  name,
  month,
  year,
  netSalary,
  company,
}: {
  to: string
  name: string
  month: string
  year: number
  netSalary: number
  company: string
}) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Your Payslip for ${month} ${year} is Ready`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1e1b4b">Payslip Available 💰</h2>
        <p>Hi ${name},</p>
        <p>Your payslip for <strong>${month} ${year}</strong> is now available.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0;font-size:14px;color:#16a34a">Net Salary</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#16a34a">
            ₹${netSalary.toLocaleString('en-IN')}
          </p>
        </div>
        <a href="${APP_URL}/payslip" style="display:inline-block;background:#1e1b4b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500">
          View & Download Payslip
        </a>
        <p style="margin-top:20px">Best regards,<br/>HR Team — ${company}</p>
      </div>
    `,
  })
}

// ── Password reset email ──
export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  company,
}: {
  to: string
  name: string
  resetUrl: string
  company: string
}) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset Your HRMS Password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1e1b4b">Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#1e1b4b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        <p>Best regards,<br/>HR Team — ${company}</p>
      </div>
    `,
  })
}

// ── New leave request notification to HR ──
export async function sendLeaveRequestNotification({
  to,
  employeeName,
  leaveType,
  fromDate,
  toDate,
  days,
  reason,
  company,
}: {
  to: string
  employeeName: string
  leaveType: string
  fromDate: string
  toDate: string
  days: number
  reason: string
  company: string
}) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `New Leave Request — ${employeeName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1e1b4b">New Leave Request 📋</h2>
        <p>A new leave request requires your approval.</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0"><strong>Employee:</strong> ${employeeName}</p>
          <p style="margin:8px 0 0"><strong>Leave Type:</strong> ${leaveType}</p>
          <p style="margin:8px 0 0"><strong>From:</strong> ${fromDate}</p>
          <p style="margin:8px 0 0"><strong>To:</strong> ${toDate}</p>
          <p style="margin:8px 0 0"><strong>Days:</strong> ${days}</p>
          <p style="margin:8px 0 0"><strong>Reason:</strong> ${reason}</p>
        </div>
        <a href="${APP_URL}/leave" style="display:inline-block;background:#1e1b4b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500">
          Review Request
        </a>
        <p style="margin-top:20px">Best regards,<br/>${company} HRMS</p>
      </div>
    `,
  })
}