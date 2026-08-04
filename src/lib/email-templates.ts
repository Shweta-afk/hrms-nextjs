// Shared, pure email templates for employee-exit notices.
//
// One source of truth: lib/email.ts uses these to SEND, and the Employees UI
// imports them to show HR the exact mock mail BEFORE they confirm — and lets HR
// edit it. Keep this module free of server-only imports (no Resend, no prisma)
// so it can be bundled into the client.

export type ExitKind = 'terminated' | 'resigned' | 'absconding'

export interface ExitNoticeInput {
  name: string
  company: string
  lastDay?: string | null   // human-formatted date, e.g. "12 Aug 2026"
  reason?: string | null
}

interface Notice {
  subject: string
  heading: string
  color: string
  paragraphs: string[]      // plain text; \n allowed inside a paragraph
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const shell = (heading: string, color: string, bodyHtml: string) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111">
    <h2 style="color:${color};margin:0 0 12px">${escapeHtml(heading)}</h2>
    ${bodyHtml}
  </div>`

const paragraphsToHtml = (paragraphs: string[]) =>
  paragraphs.map(p => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`).join('')

// Render a structured notice → { subject, html, text }.
function render(n: Notice) {
  return {
    subject: n.subject,
    html: shell(n.heading, n.color, paragraphsToHtml(n.paragraphs)),
    text: n.paragraphs.join('\n\n'),
  }
}

function abscondingNotice({ name, company, lastDay }: ExitNoticeInput): Notice {
  const since = lastDay
    ? `our records show that you have been absent from work since ${lastDay} without prior intimation or approved leave.`
    : `our records show that you have been absent from work without prior intimation or approved leave.`
  return {
    subject: `Absence from duty — immediate response required (${company})`,
    heading: 'Notice of Absence from Duty',
    color: '#b45309',
    paragraphs: [
      `Dear ${name},`,
      `This is to formally inform you that ${since}`,
      `Your continued unauthorised absence is being treated as absconding / abandonment of duty. You are required to report to work or contact the HR department immediately to explain your absence.`,
      `If we do not hear from you, the company may proceed with further action in accordance with company policy.`,
      `Regards,\nHR Team — ${company}`,
    ],
  }
}

function terminationNotice({ name, company, lastDay, reason }: ExitNoticeInput): Notice {
  return {
    subject: `Termination of Employment — ${company}`,
    heading: 'Termination of Employment',
    color: '#b91c1c',
    paragraphs: [
      `Dear ${name},`,
      `This letter is to inform you that your employment with ${company} has been terminated${lastDay ? `, effective ${lastDay}` : ''}.`,
      ...(reason ? [`Reason: ${reason}`] : []),
      `Your access to company systems and the employee portal has been revoked. Please reach out to HR to complete exit formalities and settle any pending dues.`,
      `Regards,\nHR Team — ${company}`,
    ],
  }
}

function resignationAcceptedNotice({ name, company, lastDay }: ExitNoticeInput): Notice {
  return {
    subject: `Resignation Accepted — ${company}`,
    heading: 'Resignation Accepted',
    color: '#c2410c',
    paragraphs: [
      `Dear ${name},`,
      `We acknowledge and accept your resignation from ${company}${lastDay ? `. Your last working day is recorded as ${lastDay}` : ''}.`,
      `Please coordinate with HR to complete exit formalities, handover, and final settlement. Your access to the employee portal has been deactivated. We wish you the very best in your future endeavours.`,
      `Regards,\nHR Team — ${company}`,
    ],
  }
}

export function abscondingNoticeTemplate(input: ExitNoticeInput) { return render(abscondingNotice(input)) }
export function terminationNoticeTemplate(input: ExitNoticeInput) { return render(terminationNotice(input)) }
export function resignationAcceptedTemplate(input: ExitNoticeInput) { return render(resignationAcceptedNotice(input)) }

export function exitNoticeTemplate(kind: ExitKind, input: ExitNoticeInput) {
  if (kind === 'absconding') return abscondingNoticeTemplate(input)
  if (kind === 'resigned') return resignationAcceptedTemplate(input)
  return terminationNoticeTemplate(input)
}

// Wrap an HR-edited plain-text body into the same clean HTML shell.
export function customExitHtml(bodyText: string): string {
  const paragraphs = bodyText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  return shell('', '#111', paragraphsToHtml(paragraphs)).replace(/<h2[^>]*><\/h2>\s*/, '')
}
