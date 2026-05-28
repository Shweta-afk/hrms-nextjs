import { CheckCircle2 } from "lucide-react";

const points = [
  "PF, ESI, PT (all states), TDS — built in, updated every Budget",
  "Direct ZKTeco / ESSL / AIFACE integration — no manual exports",
  "Multi-tenant — manage multiple group companies from one login",
  "₹ pricing — pay in INR, GST invoice, UPI / Razorpay",
  "Encrypted PII storage — DPDP Act ready",
  "Setup in under 30 minutes, no consultant required",
];

export function WhyUs() {
  return (
    <section id="why" className="border-b border-zinc-200 py-24 dark:border-zinc-800">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">
            Why Axiotta HRMS
          </p>
          <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Built for India.
            <br />
            <span className="text-zinc-400 dark:text-zinc-500">
              Not adapted to it.
            </span>
          </h2>
          <p className="mt-6 max-w-md text-base text-zinc-600 dark:text-zinc-400">
            Most HRMS products bolt Indian compliance onto an American
            architecture. We started here. Every form, every challan, every
            edge case — native.
          </p>
        </div>

        <ul className="lg:col-span-7 divide-y divide-zinc-200 dark:divide-zinc-800">
          {points.map((p, i) => (
            <li
              key={p}
              className="flex items-start gap-4 py-5 first:pt-0 last:pb-0"
            >
              <span className="mt-0.5 font-mono text-[11px] text-zinc-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
                strokeWidth={1.75}
              />
              <span className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                {p}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
