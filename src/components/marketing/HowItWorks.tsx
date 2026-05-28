const steps = [
  {
    n: "1",
    title: "Sign up",
    body: "Create your workspace in 60 seconds. No credit card, no demo call.",
  },
  {
    n: "2",
    title: "Connect your biometric",
    body: "Point your ZKTeco device at our server URL. We auto-discover it.",
  },
  {
    n: "3",
    title: "Run payroll",
    body: "We pull attendance, apply your policies, calculate PF / ESI / TDS, and email payslips.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-zinc-200 py-24 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">
          How it works
        </p>
        <h2 className="mt-3 max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Live in an afternoon.
        </h2>

        <div className="relative mt-16 grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* connecting rule */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-zinc-200 md:block dark:bg-zinc-800" />
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-200 bg-blue-50 font-mono text-base font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-[hsl(222,80%,8%)] dark:text-blue-400">
                {s.n}
              </div>
              <h3 className="mt-6 text-xl font-medium tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
