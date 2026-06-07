import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Does it support 6-day work weeks?",
    a: "Yes — fully configurable. You can set per-location, per-department, or even per-employee work-week patterns.",
  },
  {
    q: "Which biometric devices are supported?",
    a: "ZKTeco, ESSL, AIFACE Magnum, F18, iClock series — anything that speaks the ADMS push protocol.",
  },
  {
    q: "Is my employee data secure?",
    a: "AES-256 at rest, TLS in transit, encrypted PII, DPDP Act aligned. Data is hosted in Mumbai (ap-south-1).",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes — the web app is fully mobile-optimized. Employees can punch in, request leave, and view payslips from their phone.",
  },
  {
    q: "How long does setup take?",
    a: "Under 30 minutes for most teams. Sign up, add your employees (CSV import or one-by-one), point your biometric device at our server URL — you're live.",
  },
];

export function FAQ() {
  return (
    <section className="border-b border-zinc-200 py-24 dark:border-zinc-800">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">
            FAQ
          </p>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Answers, before you ask.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
            Still not sure?{" "}
            <a href="mailto:hrms@axiotta.com" className="text-blue-600 underline-offset-4 hover:underline">
              Email us
            </a>{" "}
            — we reply in hours, not days.
          </p>
        </div>
        <div className="lg:col-span-8">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="border-zinc-200 dark:border-zinc-800"
              >
                <AccordionTrigger className="text-left text-base font-medium hover:no-underline focus-visible:ring-2 focus-visible:ring-blue-600">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
