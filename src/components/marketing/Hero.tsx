import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureSlideshow } from "./FeatureSlideshow";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
      {/* Solid editorial tab — block color, no gradient. Anchors the section
          top with a deliberate accent rather than a fading line. */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-1.5 w-16 -translate-x-1/2 bg-blue-600" />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 py-24 lg:grid-cols-12 lg:gap-10 lg:py-32">
        <div className="lg:col-span-7">
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl dark:text-zinc-50">
            HR that runs itself.
            <br />
            <span className="text-zinc-400 dark:text-zinc-500">
              So your team doesn&apos;t have to.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Modern HRMS with built-in biometric attendance, payroll, and
            India-native compliance.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 bg-blue-600 px-6 text-base text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <Link href="/signup">
                Start 14-day trial <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-zinc-300 px-6 text-base hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <Link href="/demo">
                <Play className="mr-2 h-4 w-4" /> Watch 2-min demo
              </Link>
            </Button>
          </div>

          <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Currently in private beta · accepting select Indian SMBs
          </p>
        </div>

        <div className="lg:col-span-5">
          <FeatureSlideshow />
        </div>
      </div>
    </section>
  );
}
