import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Privacy Policy — Axiotta HRMS",
  description:
    "How Axiotta HRMS collects, uses, stores, and protects personal data. India-native, DPDP Act-aligned.",
}

// ─── Document control ───────────────────────────────────────────────────────────
// Keep this metadata at the top of the file so it's obvious where to bump dates
// when the policy is updated. Material changes (purposes, subprocessors, retention)
// require 30-day advance notice per Section 13 below.
const EFFECTIVE_DATE = "7 June 2026"
const LAST_UPDATED   = "7 June 2026"

// ─── Editable placeholders ──────────────────────────────────────────────────────
// These are the spots a lawyer / founder needs to confirm before a public launch.
// They're inline (rather than env vars) so a non-engineer can fix them with a PR.
const ENTITY_NAME       = "Axiotta Technologies Private Limited"
const REGISTERED_OFFICE = "Mumbai, Maharashtra, India"    // TODO: full street address before launch
const CIN               = "[CIN to be added]"             // TODO
const GST               = "[GSTIN to be added]"           // TODO
// One inbox for both general support and grievance correspondence — keeps it
// simple while the team is small. Split into a dedicated privacy@ once volume
// or compliance asks demand it.
const SUPPORT_EMAIL     = "hrms@axiotta.com"
const GRIEVANCE_NAME    = "[Grievance Officer name]"      // TODO
const GRIEVANCE_EMAIL   = "hrms@axiotta.com"

/**
 * Structure: each section gets a stable `id` for anchor links, a `number` used
 * by the table of contents, and an inline JSX `body`. Anchor links survive
 * sharing — e.g. a customer asking "what's your subprocessor list?" can be
 * sent /privacy#subprocessors.
 */
interface Section {
  id:     string
  number: string
  title:  string
  body:   React.ReactNode
}

const sections: Section[] = [
  {
    id: "who-we-are",
    number: "1",
    title: "Who we are",
    body: (
      <>
        <p>
          {ENTITY_NAME} (&ldquo;<b>Axiotta</b>&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;) operates the Axiotta HRMS platform (the
          &ldquo;<b>Service</b>&rdquo;), a human-resources management system for
          Indian small and medium businesses. Our registered office is at{" "}
          {REGISTERED_OFFICE} (CIN: {CIN}; GSTIN: {GST}).
        </p>
        <p>
          This Privacy Policy explains what personal data we collect, why we
          collect it, how we use it, and the choices and rights you have. It
          applies to <b>this website</b>, the <b>Axiotta HRMS web application</b>{" "}
          (including the employee self-service portal), and any related services
          we provide.
        </p>
      </>
    ),
  },
  {
    id: "two-roles",
    number: "2",
    title: "The two roles we play",
    body: (
      <>
        <p>
          Under India&apos;s Digital Personal Data Protection Act, 2023
          (&ldquo;<b>DPDP Act</b>&rdquo;), Axiotta plays two different roles
          depending on whose data is being processed:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-6">
          <li>
            <b>As a Data Fiduciary</b>, we determine the purpose and means of
            processing personal data we collect directly — from website visitors,
            and from HR administrators who sign up to create a customer
            workspace.
          </li>
          <li>
            <b>As a Data Processor</b>, we process personal data about
            employees, candidates and other individuals on behalf of customer
            organisations (each a &ldquo;<b>Customer</b>&rdquo;). In this role,
            the Customer is the Data Fiduciary and determines the purpose of
            processing; we only process the data on the Customer&apos;s
            documented instructions, including the configuration choices the
            Customer makes in the Service.
          </li>
        </ul>
        <p className="mt-4">
          If you are an employee of an organisation that uses Axiotta HRMS,
          your employer is the Data Fiduciary for your data. Please address
          requests to exercise your rights to your employer first; we will
          cooperate with them as required.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    number: "3",
    title: "What personal data we collect",
    body: (
      <>
        <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          3.1 From website visitors
        </h3>
        <p className="mt-2">
          When you visit this website, we collect minimal technical information
          (IP address, user agent, referring page, pages viewed). We do not use
          third-party advertising or behavioural tracking.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          3.2 From customer administrators (as Data Fiduciary)
        </h3>
        <p className="mt-2">
          When you create an Axiotta workspace, we collect your name, work
          email, phone number, a hashed password, your organisation&apos;s
          name, your role at the organisation, and optionally your
          organisation&apos;s GSTIN and address. We send a verification email
          to confirm the address.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          3.3 From customer organisations about their employees (as Data
          Processor)
        </h3>
        <p className="mt-2">
          When a Customer uses Axiotta HRMS, the Customer uploads or causes us
          to process personal data about their employees, candidates and
          contractors. The categories typically include:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            <b>Identification &amp; contact</b> — name, employee code, work
            email, personal email, phone number, date of birth, gender, marital
            status, blood group, residential and permanent address, emergency
            contact details.
          </li>
          <li>
            <b>Employment</b> — designation, department, manager, date of
            joining, employment type, shift group, location.
          </li>
          <li>
            <b>Statutory identifiers</b> — Permanent Account Number (PAN),
            Aadhaar number, Universal Account Number (UAN), Provident Fund
            number, Employees&apos; State Insurance number. These are stored
            encrypted (AES-256) and are decrypted only when a feature
            specifically requires them.
          </li>
          <li>
            <b>Financial</b> — bank account number, IFSC code, branch name,
            CTC, payslip line items (basic, HRA, allowances, PF, ESI, PT, TDS,
            net salary). Bank details are stored encrypted.
          </li>
          <li>
            <b>Attendance &amp; biometric</b> — punch-in / punch-out
            timestamps, device identifier, employee code, derived attendance
            status. <b>We do not store fingerprint templates or facial
            biometric templates.</b> Templates remain on the Customer&apos;s
            biometric device; we receive only the resulting timestamp + employee
            code log entries.
          </li>
          <li>
            <b>Leave &amp; absence</b> — leave applications, balances,
            approvals.
          </li>
          <li>
            <b>Documents</b> — identity documents (Aadhaar, PAN, address proof),
            educational and employment certificates, resumes, offer letters,
            police clearance certificates, and similar artefacts uploaded by
            the Customer or by employees through the self-service portal.
          </li>
          <li>
            <b>Application / recruitment</b> — candidate profile, stage,
            interview notes.
          </li>
        </ul>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          The exact data processed depends on which modules the Customer
          enables. Customers may choose to leave any optional field blank.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    number: "4",
    title: "How we use personal data",
    body: (
      <>
        <p>We use personal data for the following purposes:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            <b>Service delivery</b> — providing the HRMS functionality the
            Customer has subscribed to, including attendance processing,
            payroll calculations (PF, ESI, Professional Tax, TDS), leave
            management, document storage, recruitment workflows and analytics.
          </li>
          <li>
            <b>Account management</b> — creating accounts, authenticating
            users, sending transactional emails (welcome, password reset, email
            verification, payslip delivery, late-arrival and similar
            notifications).
          </li>
          <li>
            <b>Customer support</b> — responding to support queries and
            troubleshooting reported issues. In the course of support, our
            staff may need to view Customer Data; we do this only on the
            Customer&apos;s instructions or to resolve the reported issue.
          </li>
          <li>
            <b>Security &amp; abuse prevention</b> — detecting and preventing
            fraud, brute-force attacks, abuse of the Service, and unauthorised
            access; rate-limiting login attempts.
          </li>
          <li>
            <b>Service improvement</b> — understanding aggregate, anonymised
            usage patterns to improve the Service. We do not use Customer Data
            for advertising or training third-party AI models.
          </li>
          <li>
            <b>Legal compliance</b> — complying with applicable Indian laws
            including the DPDP Act, the Information Technology Act 2000, the
            Income-tax Act 1961, the Employees&apos; Provident Funds and
            Miscellaneous Provisions Act 1952 and the Employees&apos; State
            Insurance Act 1948.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "legal-basis",
    number: "5",
    title: "Legal basis for processing",
    body: (
      <>
        <p>
          We rely on the following bases under the DPDP Act and other
          applicable law:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            <b>Performance of a contract</b> — to provide the Service to the
            Customer and to administer your account.
          </li>
          <li>
            <b>Compliance with law</b> — to meet obligations under the IT Act,
            DPDP Act, EPF Act, ESI Act, Income-tax Act and similar statutes
            applicable to HR and payroll.
          </li>
          <li>
            <b>Legitimate interest</b> — for security, fraud prevention and
            product improvement, in each case after considering your interests
            and rights.
          </li>
          <li>
            <b>Consent</b> — for any processing that is not covered by the
            bases above and for which consent is required, including any
            future direct marketing.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "retention",
    number: "6",
    title: "How long we keep personal data",
    body: (
      <>
        <p>
          We retain personal data for the period necessary to provide the
          Service and to meet our legal obligations:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            <b>Active Customer accounts</b> — for as long as the Customer&apos;s
            subscription is active.
          </li>
          <li>
            <b>After Customer termination</b> — Customer Data is retained for
            up to thirty (30) days after termination to allow the Customer to
            export it, then deleted from primary systems. Backups containing
            deleted data are overwritten in the ordinary backup rotation
            within ninety (90) days.
          </li>
          <li>
            <b>Statutory payroll records</b> — payroll registers, attendance
            registers, wage slips and similar documents are retained as long
            as the underlying Indian labour and tax law requires (typically up
            to seven (7) years from the end of the relevant financial year),
            even after Customer termination, unless the Customer assumes
            custody by exporting them.
          </li>
          <li>
            <b>Inactive workspaces</b> — workspaces with no activity for twelve
            (12) consecutive months will be flagged for deletion after a 30-day
            notice to the Customer.
          </li>
          <li>
            <b>Server and security logs</b> — retained up to one hundred and
            eighty (180) days.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "subprocessors",
    number: "7",
    title: "Who we share data with",
    body: (
      <>
        <p>
          We do not sell personal data. We share personal data only with the
          following categories of recipients and only as needed:
        </p>
        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          7.1 Subprocessors
        </h3>
        <p className="mt-2">
          We use the following subprocessors to operate the Service. Each is
          bound by a written agreement to process personal data only on our
          instructions and to maintain appropriate security:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium">Subprocessor</th>
                <th className="py-2 pr-4 font-medium">Purpose</th>
                <th className="py-2 font-medium">Region</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              <tr>
                <td className="py-2.5 pr-4">Amazon Web Services (AWS S3)</td>
                <td className="py-2.5 pr-4">Encrypted document storage</td>
                <td className="py-2.5">ap-south-1 (Mumbai)</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4">Managed PostgreSQL provider</td>
                <td className="py-2.5 pr-4">Primary application database</td>
                <td className="py-2.5">ap-south-1 (Mumbai)</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4">Vercel Inc.</td>
                <td className="py-2.5 pr-4">Application hosting &amp; CDN</td>
                <td className="py-2.5">Edge globally; India for traffic from India</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4">Resend</td>
                <td className="py-2.5 pr-4">
                  Transactional email (welcome, password reset, payslip
                  delivery, notifications)
                </td>
                <td className="py-2.5">United States</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          The transactional-email subprocessor receives only the metadata
          necessary to deliver the message (recipient address, subject,
          message body). We will provide thirty (30) days&apos; notice through
          this page before adding or replacing a subprocessor in a way that
          materially changes the categories of personal data shared.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          7.2 Statutory authorities
        </h3>
        <p className="mt-2">
          We may disclose personal data to government authorities, courts and
          regulators where required by Indian law, in response to a valid legal
          order, or where necessary to protect the rights, property or safety
          of any person. Where legally permitted, we will notify the affected
          Customer before responding to a legal request that targets their
          data.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          7.3 Corporate transactions
        </h3>
        <p className="mt-2">
          If Axiotta is involved in a merger, acquisition or sale of assets,
          personal data may be transferred to the successor entity subject to
          the protections of this Policy. We will notify Customers in advance
          of any change in ownership that materially affects how their data
          is processed.
        </p>
      </>
    ),
  },
  {
    id: "data-location",
    number: "8",
    title: "Where data is stored",
    body: (
      <>
        <p>
          All Customer Data (the primary application database and document
          storage) is stored in the AWS Mumbai region (ap-south-1) inside
          India. We do not transfer Customer Data outside India for storage.
        </p>
        <p className="mt-4">
          Limited transactional email metadata (recipient address, subject
          line, message body of automated emails) transits our email
          subprocessor, which operates infrastructure in the United States.
          This transfer is necessary for sending the email and is the minimum
          required to deliver the message. We use a provider that offers
          industry-standard contractual safeguards.
        </p>
      </>
    ),
  },
  {
    id: "security",
    number: "9",
    title: "How we protect personal data",
    body: (
      <>
        <p>
          We maintain administrative, technical and physical safeguards
          appropriate to the sensitivity of the data we process:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            <b>Encryption in transit</b> — all traffic to the Service is
            served over TLS 1.2+.
          </li>
          <li>
            <b>Encryption at rest</b> — Customer Data and document storage is
            encrypted at rest. Bank account details, Aadhaar, PAN and other
            statutory identifiers are additionally encrypted at the application
            layer with AES-256-GCM using keys held outside the database.
          </li>
          <li>
            <b>Passwords</b> — user passwords are hashed with bcrypt (cost 10)
            and never stored in plaintext.
          </li>
          <li>
            <b>Access control</b> — role-based access; principle of least
            privilege; multi-factor authentication for our administrative
            access.
          </li>
          <li>
            <b>Document access</b> — uploaded documents are stored with
            non-guessable object keys and served via time-limited signed URLs.
          </li>
          <li>
            <b>Rate limiting &amp; abuse prevention</b> — on authentication
            and other sensitive endpoints.
          </li>
          <li>
            <b>Backups</b> — encrypted database backups with a defined
            rotation.
          </li>
          <li>
            <b>Breach notification</b> — in the event of a personal-data
            breach that is likely to affect you, we will notify the Data
            Protection Board of India and the affected Customer (and, through
            them, affected individuals) without undue delay and as required
            by the DPDP Act.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "your-rights",
    number: "10",
    title: "Your rights",
    body: (
      <>
        <p>
          Subject to the conditions of the DPDP Act, you have the following
          rights in respect of personal data we hold about you:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            <b>Right to information</b> — to know what personal data of yours
            we process and the identities of the data fiduciaries / processors
            involved.
          </li>
          <li>
            <b>Right to correction and erasure</b> — to ask us to correct
            inaccurate data, complete incomplete data, update outdated data or
            erase data that is no longer required.
          </li>
          <li>
            <b>Right to withdraw consent</b> — where we rely on consent.
          </li>
          <li>
            <b>Right to grievance redressal</b> — to escalate complaints to
            our Grievance Officer.
          </li>
          <li>
            <b>Right to nominate</b> — to nominate another individual to
            exercise rights on your behalf in the event of death or
            incapacity.
          </li>
        </ul>
        <p className="mt-4">
          If you are an employee, contractor or candidate of a Customer
          organisation, please contact your employer first to exercise these
          rights — your employer is the Data Fiduciary for your data and we
          act on their instructions. We will support them in responding to
          your request within the statutory timelines.
        </p>
        <p className="mt-3">
          If you are a customer administrator or website visitor, contact us
          at <a className="text-blue-600 underline-offset-4 hover:underline" href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    number: "11",
    title: "Cookies and similar technologies",
    body: (
      <>
        <p>
          We use a small number of strictly-necessary cookies and similar
          local-storage entries:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            <b>Authentication session</b> — to keep you signed in.
          </li>
          <li>
            <b>CSRF token</b> — to protect against cross-site request forgery.
          </li>
          <li>
            <b>Theme preference</b> — to remember whether you chose light or
            dark mode.
          </li>
        </ul>
        <p className="mt-4">
          We do not use third-party advertising cookies, behavioural-tracking
          pixels or cross-site analytics that identify individual visitors.
        </p>
      </>
    ),
  },
  {
    id: "children",
    number: "12",
    title: "Children",
    body: (
      <p>
        The Service is not directed at children under eighteen (18) years of
        age and we do not knowingly process personal data of children. If you
        believe we have inadvertently collected such data, please contact our
        Grievance Officer and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    number: "13",
    title: "Changes to this Privacy Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. For any change
        that materially affects how we process your personal data (for
        example, new purposes or new subprocessor categories), we will provide
        at least thirty (30) days&apos; advance notice by updating this page
        and, where appropriate, by emailing the Customer&apos;s primary
        contact. The &ldquo;Last updated&rdquo; date at the top of this page
        reflects when the policy was last changed.
      </p>
    ),
  },
  {
    id: "grievance-officer",
    number: "14",
    title: "Grievance Officer",
    body: (
      <>
        <p>
          In accordance with the DPDP Act and the Information Technology
          (Reasonable Security Practices and Procedures and Sensitive Personal
          Data or Information) Rules, 2011, our Grievance Officer is:
        </p>
        <div className="mt-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <p><b>Name:</b> {GRIEVANCE_NAME}</p>
          <p className="mt-1"><b>Email:</b>{" "}
            <a className="text-blue-600 underline-offset-4 hover:underline" href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>
          </p>
          <p className="mt-1"><b>Postal address:</b> {ENTITY_NAME}, {REGISTERED_OFFICE}</p>
        </div>
        <p className="mt-4">
          The Grievance Officer will acknowledge your complaint within
          forty-eight (48) hours and provide a substantive response within
          thirty (30) days.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    number: "15",
    title: "Contact us",
    body: (
      <p>
        For any question about this Policy or our data practices, write to us
        at <a className="text-blue-600 underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <article className="border-b border-zinc-200 dark:border-zinc-800">
      {/* Solid blue editorial tab — matches the rest of the marketing pages */}
      <div className="relative">
        <div className="pointer-events-none absolute left-1/2 top-0 h-1.5 w-16 -translate-x-1/2 bg-blue-600" />
      </div>

      <div className="mx-auto max-w-3xl px-6 py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">
          Legal
        </p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          Privacy Policy
        </h1>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          Effective {EFFECTIVE_DATE} · Last updated {LAST_UPDATED}
        </p>

        {/* Table of contents — anchor links for sharing specific sections */}
        <nav
          aria-label="Sections"
          className="mt-12 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Contents
          </p>
          <ol className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id} className="text-sm">
                <a
                  href={`#${s.id}`}
                  className="text-zinc-700 hover:text-blue-600 dark:text-zinc-300"
                >
                  <span className="mr-2 font-mono text-zinc-400">{s.number}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Body */}
        <div className="mt-16 space-y-14 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                <span className="mr-3 font-mono text-base text-zinc-400">
                  {s.number}.
                </span>
                {s.title}
              </h2>
              <div className="mt-4 space-y-4">{s.body}</div>
            </section>
          ))}
        </div>

        <div className="mt-20 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-700 transition-colors hover:text-blue-600 dark:text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>
    </article>
  )
}
