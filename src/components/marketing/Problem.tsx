const problems = [
  {
    n: "01",
    title: "Spreadsheets break every payroll cycle",
    body: "One wrong VLOOKUP and someone's PF deduction is off. Again.",
  },
  {
    n: "02",
    title: "Your biometric device sits disconnected from your HRMS",
    body: "Manual CSV exports, missed punches, and angry employees on the 1st.",
  },
  {
    n: "03",
    title: "Compliance updates blindside you every quarter",
    body: "PT slab changes in Maharashtra. New TDS rules. You find out from your CA — late.",
  },
];

export function Problem() {
  return (
    <section className="border-b border-zinc-200 py-24 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">
          The problem
        </p>
        <h2 className="mt-3 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          Indian HR teams deserve better than this.
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 md:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
          {problems.map((p) => (
            <div
              key={p.n}
              className="group relative bg-white p-8 transition-colors hover:bg-blue-50/50 dark:bg-card dark:hover:bg-[hsl(222,65%,12%)]"
            >
              <span className="font-mono text-xs text-zinc-400">{p.n}</span>
              <h3 className="mt-6 text-xl font-medium leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
                {p.title}
              </h3>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-lg text-zinc-600 dark:text-zinc-400">
          There&apos;s a better way.{" "}
          <span className="text-zinc-900 dark:text-zinc-50">It&apos;s called Axiotta HRMS.</span>
        </p>
      </div>
    </section>
  );
}
