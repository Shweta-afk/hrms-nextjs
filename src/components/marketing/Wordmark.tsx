import { Building2 } from "lucide-react";
import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md"
    >
      <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950">
        <Building2 className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <span>Acme HR</span>
    </Link>
  );
}
