import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Demo — Acme HR",
  description: "A 2-minute walkthrough of Acme HR.",
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-[hsl(222,84%,5%)] dark:text-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <Play className="h-6 w-6 text-blue-600" strokeWidth={1.75} />
        </div>
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">
          Demo
        </p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Recording coming soon.
        </h1>
        <p className="mt-5 max-w-md text-base text-zinc-600 dark:text-zinc-400">
          We&apos;re putting together a 2-minute walkthrough. In the meantime,
          the fastest way to see it is to start a free trial — no credit card
          needed.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-12 bg-blue-600 px-6 text-base text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <Link href="/signup">Start 14-day trial</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 border-zinc-300 px-6 text-base hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
