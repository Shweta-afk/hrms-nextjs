import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTABanner() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-blue-50 px-8 py-20 text-center dark:bg-blue-950/40">
          {/* Solid editorial tab — same vocabulary as the Hero. Block color, no gradient. */}
          <div className="pointer-events-none absolute left-1/2 top-0 h-1.5 w-16 -translate-x-1/2 bg-blue-600" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600">
            One more thing
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
            Stop paying for HR software that&apos;s stuck in 2015.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base text-zinc-600 dark:text-zinc-400">
            14-day trial. No credit card. Cancel anytime.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 bg-blue-600 px-6 text-base text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <Link href="/signup">
                Start free trial <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-zinc-300 px-6 text-base hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <Link href="mailto:hrms@axiotta.com">Talk to us about pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
