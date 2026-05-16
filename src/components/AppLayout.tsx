'use client'

import { useState } from "react";
import { useSession } from "next-auth/react";
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

  const trialEndsAt = session?.user?.trial_ends_at
  const trialDaysLeft = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const showTrialBanner = trialDaysLeft !== null && trialDaysLeft > 0

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-foreground/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AppSidebar />
      </div>

      {/* Desktop sidebar */}
      <AppSidebar />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {showTrialBanner && (
          <div className="bg-kpi-amber/10 border-b border-kpi-amber/30 px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-foreground font-medium">
              Free trial — <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</strong> remaining
            </span>
            <Link href="/billing" className="text-primary font-semibold hover:underline text-xs">
              Upgrade now
            </Link>
          </div>
        )}
        <AppHeader title={title} onMenuToggle={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
