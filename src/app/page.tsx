import Link from 'next/link'
import {
  Users, Clock, IndianRupee, FileText, BarChart3, Fingerprint,
  CheckCircle2, ArrowRight, Building2, Shield, Zap,
} from 'lucide-react'

const features = [
  { icon: Users,        title: 'Employee Management',   desc: 'Complete employee profiles, documents, org chart, and self-service portal.' },
  { icon: Fingerprint,  title: 'Biometric Attendance',  desc: 'Direct ZKTeco/ESSL device integration. Real-time punches, no manual entries.' },
  { icon: Clock,        title: 'Leave Management',      desc: 'Policy-based leave rules, approval workflows, and balance tracking.' },
  { icon: IndianRupee,  title: 'Payroll & Payslips',    desc: 'Automated payroll with PF, ESI, PT, TDS, and downloadable payslips.' },
  { icon: FileText,     title: 'Recruitment',           desc: 'Job postings, candidate pipeline, interview tracking, and offer letters.' },
  { icon: BarChart3,    title: 'Analytics & Reports',   desc: 'Attendance trends, headcount, payroll summaries, and export to Excel.' },
]

const highlights = [
  'Multi-tenant — one platform, multiple companies',
  'Indian payroll compliant — PF, ESI, PT, TDS',
  'ZKTeco / ESSL biometric device support',
  'Employee self-service portal',
  'Real-time attendance dashboard',
  'Encrypted sensitive data storage',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Nav ── */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">WorkNest HRMS</span>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            HR Login <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 bg-gradient-to-b from-indigo-50/60 to-white">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap className="h-3 w-3" /> Built for Indian SMEs
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight max-w-3xl mb-6">
          HR & Payroll — <span className="text-indigo-600">Simple, Smart, Compliant</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-10">
          Manage employees, attendance, leave, and payroll in one place.
          Direct biometric device sync. Indian payroll ready out of the box.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Log In to your HR Portal <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/portal"
            className="flex items-center justify-center gap-2 bg-white text-gray-700 font-semibold px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Employee Portal
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">Everything HR needs</h2>
            <p className="text-gray-500 max-w-lg mx-auto">One platform to handle the full employee lifecycle — from hiring to payroll.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 bg-gray-50/50 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Highlights ── */}
      <section className="py-16 px-6 bg-indigo-600">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">Built for compliance & scale</h2>
            <p className="text-indigo-200 text-sm">Everything you need to stay compliant and grow your team</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {highlights.map(h => (
              <div key={h} className="flex items-center gap-3 bg-indigo-500/40 rounded-xl px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-indigo-200 shrink-0" />
                <span className="text-sm text-white font-medium">{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 bg-white text-center">
        <div className="max-w-xl mx-auto">
          <div className="h-14 w-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-5">
            <Shield className="h-7 w-7 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to get started?</h2>
          <p className="text-gray-500 mb-8 text-sm">Log in to your HR dashboard or let employees access their self-service portal.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              HR Admin Login <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/portal"
              className="flex items-center justify-center gap-2 text-gray-700 font-semibold px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Employee Login
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-6 px-6 text-center">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} WorkNest HRMS · Built for Indian businesses</p>
      </footer>
    </div>
  )
}
