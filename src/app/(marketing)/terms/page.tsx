import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Terms of Service — Axiotta HRMS",
  description:
    "Terms of Service governing your use of the Axiotta HRMS platform.",
}

const EFFECTIVE_DATE = "7 June 2026"
const LAST_UPDATED   = "7 June 2026"

const ENTITY_NAME       = "Axiotta Technologies Private Limited"
const REGISTERED_OFFICE = "Mumbai, Maharashtra, India"
const SUPPORT_EMAIL     = "hrms@axiotta.com"
const COURTS_JURISDICTION = "Mumbai, Maharashtra, India"

interface Section {
  id:     string
  number: string
  title:  string
  body:   React.ReactNode
}

const sections: Section[] = [
  {
    id: "acceptance",
    number: "1",
    title: "Acceptance of these Terms",
    body: (
      <>
        <p>
          These Terms of Service (&ldquo;<b>Terms</b>&rdquo;) form a binding
          agreement between {ENTITY_NAME} (&ldquo;<b>Axiotta</b>&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;) and the legal entity you
          represent (&ldquo;<b>Customer</b>&rdquo;, &ldquo;you&rdquo;). By
          creating an account, signing into the Service or otherwise accessing
          or using the Service, you confirm that (a) you have read,
          understood and agree to be bound by these Terms and our{" "}
          <Link
            href="/privacy"
            className="text-blue-600 underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          , and (b) you have the authority to bind the legal entity on whose
          behalf you are accepting.
        </p>
        <p>
          If you do not agree, you may not use the Service.
        </p>
      </>
    ),
  },
  {
    id: "definitions",
    number: "2",
    title: "Definitions",
    body: (
      <ul className="list-disc space-y-2 pl-6">
        <li>
          &ldquo;<b>Service</b>&rdquo; means the Axiotta HRMS platform,
          including the web application, the employee self-service portal, the
          biometric-device integration endpoints, related APIs and any
          documentation we make available.
        </li>
        <li>
          &ldquo;<b>Customer Data</b>&rdquo; means all data and content
          uploaded to, generated within or processed by the Service on behalf
          of the Customer — including data about the Customer&apos;s
          employees, contractors and candidates.
        </li>
        <li>
          &ldquo;<b>Authorized User</b>&rdquo; means an individual whom the
          Customer permits to access the Service: typically an HR
          administrator or an employee of the Customer using the
          self-service portal.
        </li>
        <li>
          &ldquo;<b>Subscription Term</b>&rdquo; means the period during which
          the Customer is entitled to use the Service.
        </li>
        <li>
          &ldquo;<b>Documentation</b>&rdquo; means any user guides, help
          pages or technical specifications we publish for the Service.
        </li>
      </ul>
    ),
  },
  {
    id: "the-service",
    number: "3",
    title: "The Service",
    body: (
      <p>
        Axiotta provides a cloud-based human-resources management system for
        Indian small and medium businesses. Features include — but are not
        limited to — employee record management, attendance capture from
        compatible biometric devices, leave and holiday management, payroll
        processing (including computation of PF, ESI, Professional Tax and
        TDS), payslip generation and delivery, recruitment workflows,
        document management and analytics. The available features and any
        limits depend on the plan the Customer subscribes to. We may release
        new features and retire features that are not material to the
        Service.
      </p>
    ),
  },
  {
    id: "account-eligibility",
    number: "4",
    title: "Account and eligibility",
    body: (
      <>
        <p>
          To register, the Customer must be a legal entity incorporated or
          registered in India and capable of entering into a binding contract
          under Indian law. The Authorized User completing the sign-up
          represents that they are eighteen (18) years of age or older and
          have authority to bind the Customer.
        </p>
        <p>
          One workspace per legal entity. The Customer is responsible for the
          accuracy of the information it provides at sign-up and for keeping
          it current (including a working email address for the primary
          contact).
        </p>
      </>
    ),
  },
  {
    id: "authorized-users",
    number: "5",
    title: "Authorized Users and credentials",
    body: (
      <>
        <p>
          The Customer is solely responsible for: (i) determining which
          individuals it grants access to the Service and the level of access
          granted, (ii) the acts and omissions of its Authorized Users, (iii)
          maintaining the security and confidentiality of credentials issued
          to its Authorized Users, and (iv) notifying us promptly of any
          unauthorised access or use.
        </p>
        <p>
          We may suspend any Authorized User account that we reasonably
          believe is being used in violation of these Terms.
        </p>
      </>
    ),
  },
  {
    id: "customer-responsibilities",
    number: "6",
    title: "Customer responsibilities",
    body: (
      <>
        <p>The Customer represents and warrants that:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            it has a valid legal basis (including, where required, consent or
            employment-contract-based authority) under applicable Indian law
            to upload to the Service the personal data of each employee,
            contractor and candidate it processes through the Service;
          </li>
          <li>
            it has provided each such individual with a privacy notice that
            covers the processing performed through the Service;
          </li>
          <li>
            the Customer Data does not infringe any third-party right,
            including intellectual-property rights or privacy rights;
          </li>
          <li>
            it will comply with all Indian labour, tax and data-protection
            laws applicable to its use of the Service, including the DPDP
            Act, the Income-tax Act 1961, the EPF Act 1952, the ESI Act 1948
            and the relevant state Professional Tax statutes; and
          </li>
          <li>
            it will use the Service only for lawful, internal business
            purposes related to its own workforce.
          </li>
        </ul>
        <p className="mt-4">
          The Customer is the &ldquo;Data Fiduciary&rdquo; for the personal
          data it processes through the Service in respect of its workforce;
          we act as the &ldquo;Data Processor&rdquo; — see Section{" "}
          <a className="text-blue-600 underline-offset-4 hover:underline" href="#customer-data">10</a>{" "}
          (Customer Data).
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    number: "7",
    title: "Acceptable use",
    body: (
      <>
        <p>The Customer and its Authorized Users must not:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            reverse-engineer, decompile or attempt to derive the source code
            of the Service, except to the extent applicable law expressly
            permits;
          </li>
          <li>
            copy, modify or create derivative works of the Service or
            Documentation, or sub-license, resell or commercially exploit
            access to the Service;
          </li>
          <li>
            use the Service to store or transmit malicious code, infringing
            content, or content that is unlawful under Indian law;
          </li>
          <li>
            interfere with the integrity or performance of the Service, or
            attempt to gain unauthorised access to it or to other
            customers&apos; data;
          </li>
          <li>
            conduct security testing, vulnerability scanning or penetration
            testing on the Service without our prior written consent;
          </li>
          <li>
            exceed the published rate limits, storage quotas or
            user-/employee-count limits of the Customer&apos;s plan; or
          </li>
          <li>
            use the Service to send unsolicited commercial communications
            (spam) or to violate any anti-spam law.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "fees-billing",
    number: "8",
    title: "Fees, billing and taxes",
    body: (
      <>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          8.1 Private beta
        </h3>
        <p className="mt-2">
          During Axiotta&apos;s private beta, the Service is provided without
          charge. We will notify the Customer at least thirty (30) days
          before transitioning the Customer&apos;s workspace to a paid plan
          and the Customer may decline the transition by terminating its
          account before the effective date.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          8.2 Paid plans (when introduced)
        </h3>
        <p className="mt-2">
          When paid plans are introduced, fees will be charged in Indian
          Rupees in accordance with the plan the Customer subscribes to. All
          fees are exclusive of GST and any other applicable indirect taxes,
          which will be added at the prevailing rate and remitted by us. The
          Customer is responsible for any taxes withholdable at source under
          Indian law (e.g. TDS), provided the Customer issues a Form 16A on
          time.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          8.3 Free trial
        </h3>
        <p className="mt-2">
          A fourteen-day (14) free trial may be available for paid plans.
          During the trial, the Customer may cancel at any time without
          charge. If the Customer does not cancel before the trial ends, the
          Customer authorises us to begin billing under the selected plan.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          8.4 Late payment
        </h3>
        <p className="mt-2">
          Past-due amounts may accrue interest at the lower of 1.5% per month
          or the maximum rate permitted by law. We may suspend the Service
          for accounts more than fifteen (15) days past due, after written
          notice.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          8.5 Refunds
        </h3>
        <p className="mt-2">
          Fees are non-refundable except where required by Indian law or as
          expressly stated in these Terms.
        </p>
      </>
    ),
  },
  {
    id: "service-availability",
    number: "9",
    title: "Service availability and support",
    body: (
      <>
        <p>
          During the private beta, the Service is provided on a reasonable
          best-effort basis without a specific uptime commitment. When paid
          plans are introduced, we will publish a service-level agreement
          (SLA) at that time.
        </p>
        <p>
          We may carry out scheduled maintenance with reasonable advance
          notice, and emergency maintenance without notice where required to
          preserve the security or integrity of the Service. We will use
          reasonable efforts to minimise the impact of any maintenance window.
        </p>
        <p>
          Support is available by email at{" "}
          <a className="text-blue-600 underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
          during Indian business hours (10:00–18:00 IST, Monday to Friday,
          excluding public holidays in Maharashtra).
        </p>
      </>
    ),
  },
  {
    id: "customer-data",
    number: "10",
    title: "Customer Data and data processing",
    body: (
      <>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          10.1 Ownership
        </h3>
        <p className="mt-2">
          As between Axiotta and the Customer, the Customer retains all
          right, title and interest in Customer Data. We claim no ownership
          interest in Customer Data.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          10.2 Licence to us
        </h3>
        <p className="mt-2">
          The Customer grants Axiotta a worldwide, non-exclusive, royalty-free
          licence to host, copy, transmit, display and process Customer Data
          solely to (a) provide and improve the Service, (b) prevent or
          address technical or security issues, (c) comply with applicable
          law, and (d) at the Customer&apos;s instruction. This licence ends
          when Customer Data is deleted from the Service in accordance with
          our Privacy Policy.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          10.3 Roles under the DPDP Act
        </h3>
        <p className="mt-2">
          The Customer is the Data Fiduciary for personal data contained in
          Customer Data; Axiotta is the Data Processor. The Customer&apos;s
          instructions to Axiotta consist of these Terms, the configuration
          choices the Customer makes in the Service, and any further
          documented instructions on which the parties agree in writing.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          10.4 Subprocessors
        </h3>
        <p className="mt-2">
          The Customer authorises Axiotta to engage subprocessors as listed
          in the{" "}
          <Link
            href="/privacy#subprocessors"
            className="text-blue-600 underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          . We remain responsible for our subprocessors&apos; performance.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          10.5 Security
        </h3>
        <p className="mt-2">
          We will maintain commercially reasonable administrative, technical
          and physical safeguards as described in the Privacy Policy. We will
          notify the Customer without undue delay of any personal-data breach
          affecting the Customer&apos;s data and cooperate with the Customer
          in any notification it must make to regulators or affected
          individuals.
        </p>

        <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          10.6 Return and deletion
        </h3>
        <p className="mt-2">
          On termination, the Customer may export Customer Data in standard
          formats for thirty (30) days. After that period, Customer Data will
          be deleted from primary systems and overwritten in backups in the
          ordinary backup rotation. Records that we are required to retain by
          Indian labour or tax law will be retained for the minimum period
          required and remain subject to this Section.
        </p>
      </>
    ),
  },
  {
    id: "confidentiality",
    number: "11",
    title: "Confidentiality",
    body: (
      <p>
        Each party will protect the other&apos;s confidential information
        with the same degree of care it uses for its own (and not less than
        reasonable care), use it solely to perform under these Terms, and
        disclose it only to its personnel and advisors under a duty of
        confidentiality. Confidential information does not include
        information that is or becomes public other than through a breach,
        was rightfully known before disclosure, or is independently
        developed. Either party may disclose confidential information where
        required by law, provided it gives the other party prompt notice
        where legally permitted.
      </p>
    ),
  },
  {
    id: "ip",
    number: "12",
    title: "Intellectual property",
    body: (
      <>
        <p>
          As between the parties, Axiotta owns all right, title and interest
          in and to the Service, including all underlying software,
          algorithms, user interfaces, designs, trademarks, Documentation and
          improvements (the &ldquo;<b>Axiotta IP</b>&rdquo;). Nothing in
          these Terms transfers ownership of Axiotta IP to the Customer.
        </p>
        <p>
          If the Customer provides feedback or suggestions about the Service,
          we may use them without restriction or compensation.
        </p>
      </>
    ),
  },
  {
    id: "suspension-termination",
    number: "13",
    title: "Suspension and termination",
    body: (
      <>
        <p>
          <b>Termination by Customer.</b> The Customer may terminate its
          account at any time from within the Service or by emailing{" "}
          <a className="text-blue-600 underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          Termination of a paid plan takes effect at the end of the
          then-current billing period, except where Indian law requires
          earlier effect.
        </p>
        <p>
          <b>Termination by Axiotta.</b> We may suspend or terminate the
          Service immediately if the Customer materially breaches these
          Terms and fails to cure within fifteen (15) days of notice, if the
          Customer fails to pay undisputed fees when due, or if continuing
          to provide the Service would expose us to legal liability or a
          serious security risk. We may also terminate any plan that is no
          longer commercially viable on at least thirty (30) days&apos;
          notice.
        </p>
        <p>
          <b>Effect of termination.</b> On termination, the Customer&apos;s
          access to the Service will end (subject to the export window in
          Section{" "}
          <a className="text-blue-600 underline-offset-4 hover:underline" href="#customer-data">10.6</a>),
          unpaid fees for the period up to termination become immediately
          payable, and the provisions of these Terms that by their nature
          should survive (including IP, confidentiality, limitation of
          liability, indemnity and governing law) will survive.
        </p>
      </>
    ),
  },
  {
    id: "warranties",
    number: "14",
    title: "Warranties and disclaimers",
    body: (
      <>
        <p>
          Each party warrants that it has the authority to enter into these
          Terms. Axiotta warrants that it will provide the Service with
          reasonable skill and care and in accordance with the published
          Documentation.
        </p>
        <p>
          <b>To the maximum extent permitted by law</b>, except as expressly
          set out in these Terms, the Service is provided &ldquo;as
          is&rdquo; and &ldquo;as available&rdquo;. We disclaim all other
          warranties, express, implied or statutory, including any warranty
          of merchantability, fitness for a particular purpose,
          non-infringement and uninterrupted or error-free operation. We do
          not warrant that the Service will meet the Customer&apos;s specific
          regulatory or business requirements without the Customer&apos;s
          own validation.
        </p>
        <p>
          Computations the Service performs (payroll, PF, ESI, PT, TDS, etc.)
          are based on the configuration and data the Customer provides. The
          Customer is responsible for verifying the correctness of those
          configurations and outputs before relying on them for statutory
          filings or payments.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    number: "15",
    title: "Limitation of liability",
    body: (
      <>
        <p>
          To the maximum extent permitted by law:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>
            neither party will be liable for any indirect, incidental,
            special, consequential or punitive damages, or for loss of
            profits, revenue, goodwill, data, or business opportunity, even
            if advised of the possibility of such damages; and
          </li>
          <li>
            each party&apos;s total aggregate liability arising out of or
            related to these Terms, in any twelve (12) month period, will
            not exceed the greater of (a) the fees paid by the Customer to
            Axiotta in the twelve (12) months preceding the claim, or (b)
            ₹50,000.
          </li>
        </ul>
        <p className="mt-4">
          <b>Carve-outs.</b> The above limits do not apply to: (i) a
          party&apos;s indemnification obligations, (ii) breach of
          confidentiality, (iii) infringement of the other party&apos;s
          intellectual-property rights, (iv) the Customer&apos;s payment
          obligations, or (v) any liability that cannot be excluded or
          limited under applicable law.
        </p>
      </>
    ),
  },
  {
    id: "indemnification",
    number: "16",
    title: "Indemnification",
    body: (
      <>
        <p>
          <b>By the Customer.</b> The Customer will defend, indemnify and
          hold harmless Axiotta from and against any third-party claim,
          loss, damage or expense (including reasonable legal fees) arising
          from (i) the Customer&apos;s violation of these Terms, (ii) the
          Customer Data, including any claim that the Customer Data infringes
          a third-party right or violates applicable law, or (iii) the
          Customer&apos;s use of the Service in a manner not authorised by
          these Terms.
        </p>
        <p>
          <b>By Axiotta.</b> We will defend, indemnify and hold harmless the
          Customer against any third-party claim that the Service, when used
          in accordance with these Terms, infringes that third party&apos;s
          intellectual-property rights subsisting in India. Our obligation
          does not apply where the claim arises from (a) the Customer Data,
          (b) the Customer&apos;s use of the Service in combination with
          materials not provided by us, or (c) any modification of the
          Service not made by or for us. We may, at our option, replace or
          modify the affected portion of the Service to make it
          non-infringing, procure a licence to continue use, or terminate
          the Service and refund prepaid unused fees.
        </p>
        <p>
          The indemnified party must promptly notify the indemnifying party
          of the claim, give it sole control of the defence, and provide
          reasonable cooperation. The indemnifying party will not settle a
          claim that imposes a non-financial obligation on the indemnified
          party without that party&apos;s prior written consent.
        </p>
      </>
    ),
  },
  {
    id: "force-majeure",
    number: "17",
    title: "Force majeure",
    body: (
      <p>
        Neither party will be liable for any delay or failure to perform (other
        than payment obligations) due to causes beyond its reasonable control,
        including acts of God, war, terrorism, riots, embargoes, acts of
        civil or military authorities, fire, floods, pandemics, internet
        outages, or failures of third-party infrastructure on which the
        Service depends. The affected party must give prompt notice and use
        reasonable efforts to mitigate.
      </p>
    ),
  },
  {
    id: "governing-law",
    number: "18",
    title: "Governing law and dispute resolution",
    body: (
      <>
        <p>
          These Terms are governed by the laws of India. The parties will
          attempt in good faith to resolve any dispute through discussion at
          a senior level within thirty (30) days of notice of the dispute.
          Any dispute not so resolved will be subject to the exclusive
          jurisdiction of the courts at {COURTS_JURISDICTION}.
        </p>
        <p>
          Nothing in this Section prevents either party from seeking interim
          or injunctive relief in any court of competent jurisdiction to
          protect its confidential information or intellectual-property
          rights.
        </p>
      </>
    ),
  },
  {
    id: "changes-terms",
    number: "19",
    title: "Changes to these Terms",
    body: (
      <p>
        We may update these Terms from time to time. For any change that
        materially affects the Customer&apos;s rights or obligations, we
        will provide at least thirty (30) days&apos; advance notice through
        this page and, where appropriate, by emailing the Customer&apos;s
        primary contact. If the Customer does not agree to a change, the
        Customer may terminate before the effective date. Continued use of
        the Service after the effective date constitutes acceptance.
      </p>
    ),
  },
  {
    id: "miscellaneous",
    number: "20",
    title: "Miscellaneous",
    body: (
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <b>Entire agreement.</b> These Terms, together with the Privacy
          Policy and any plan-level commercial terms the parties sign,
          constitute the entire agreement between the parties on this
          subject and supersede all prior or contemporaneous communications.
        </li>
        <li>
          <b>Assignment.</b> Neither party may assign these Terms without the
          other&apos;s prior written consent, except that either party may
          assign without consent in connection with a merger, acquisition or
          sale of substantially all of its assets, on written notice.
        </li>
        <li>
          <b>Severability.</b> If any provision is held unenforceable, the
          remaining provisions will continue in full force; the
          unenforceable provision will be modified to the minimum extent
          necessary to make it enforceable while preserving the parties&apos;
          intent.
        </li>
        <li>
          <b>Waiver.</b> A failure to enforce a provision is not a waiver of
          the right to enforce it later.
        </li>
        <li>
          <b>No agency.</b> Nothing in these Terms creates a partnership,
          agency or joint venture between the parties.
        </li>
        <li>
          <b>Notices.</b> Notices to Axiotta must be sent to{" "}
          <a className="text-blue-600 underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          Notices to the Customer will be sent to the email address
          associated with the Customer&apos;s primary admin account.
        </li>
      </ul>
    ),
  },
  {
    id: "contact-terms",
    number: "21",
    title: "Contact",
    body: (
      <p>
        Questions about these Terms? Write to{" "}
        <a className="text-blue-600 underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        Our registered office is at {ENTITY_NAME}, {REGISTERED_OFFICE}.
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <article className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="relative">
        <div className="pointer-events-none absolute left-1/2 top-0 h-1.5 w-16 -translate-x-1/2 bg-blue-600" />
      </div>

      <div className="mx-auto max-w-3xl px-6 py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">
          Legal
        </p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          Terms of Service
        </h1>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          Effective {EFFECTIVE_DATE} · Last updated {LAST_UPDATED}
        </p>

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
