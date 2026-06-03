'use client'

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

interface AppLayoutProps {
  title: string;
  children: React.ReactNode;
}

const AppLayout = ({ title, children }: AppLayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const trialEndsAt = session?.user?.trial_ends_at;
  const trialDaysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const showTrialBanner = trialDaysLeft !== null && trialDaysLeft > 0;

  return (
    <div className="flex min-h-screen w-full bg-background">

      {/* ── Mobile overlay backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile slide-in sidebar ── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* AppSidebar with no hidden class — visible inside drawer */}
        <AppSidebar className="flex shadow-2xl" />
      </div>

      {/* ── Desktop static sidebar ── */}
      <AppSidebar className="hidden md:flex" />

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showTrialBanner && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-foreground font-medium">
              Free trial — <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</strong> remaining
            </span>
            <Link href="/billing" className="text-primary font-semibold hover:underline text-xs">
              Upgrade now
            </Link>
          </div>
        )}

        <AppHeader title={title} onMenuToggle={() => setMobileOpen(prev => !prev)} />

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
