import {
  Users,
  Fingerprint,
  Calendar,
  IndianRupee,
  Briefcase,
  BarChart3,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Employee management",
    body: "Profiles, org chart, documents, self-service portal.",
  },
  {
    icon: Fingerprint,
    title: "Biometric attendance",
    body: "Plug your ZKTeco / ESSL device into our cloud in 2 minutes. Punches stream live.",
  },
  {
    icon: Calendar,
    title: "Leave & holidays",
    body: "Policy-based rules, approval flows, balance tracking, holiday calendars.",
  },
  {
    icon: IndianRupee,
    title: "Payroll & payslips",
    body: "Auto-calculated PF, ESI, PT, TDS. One-click run. Payslips emailed to employees.",
  },
  {
    icon: Briefcase,
    title: "Recruitment",
    body: "Job postings, candidate pipeline, AI shortlisting, offer letters.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Attendance trends, payroll cost, headcount, attrition — exported to Excel.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="border-b border-zinc-200 py-24 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">
              Core features
            </p>
            <h2 className="mt-3 max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Everything HR. Nothing else.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
            Six modules, one login. No bolt-ons, no upsells, no consulting hours.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative bg-white p-8 transition-colors hover:bg-blue-50/50 dark:bg-card dark:hover:bg-[hsl(222,65%,12%)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 transition-colors group-hover:border-blue-600 group-hover:text-blue-600 dark:border-zinc-800 dark:text-zinc-300">
                <f.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-6 text-lg font-medium tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
