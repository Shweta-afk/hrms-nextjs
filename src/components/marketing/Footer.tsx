import Link from "next/link";
import { Wordmark } from "./Wordmark";

const cols = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Why us", href: "#why" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact", href: "mailto:hello@acmehr.in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 md:col-span-3">
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
              Modern HRMS for Indian SMBs. Payroll, attendance, leave, and
              recruitment — without the bloat.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {c.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-zinc-700 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:text-blue-600 dark:text-zinc-300"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800">
          <p>© {new Date().getFullYear()} Axiotta Technologies. Made in Bengaluru 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}
