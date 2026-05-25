import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Acme HR — HR that runs itself",
  description:
    "Modern HRMS with built-in biometric attendance, payroll, and India-native compliance. Built for Indian SMBs.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 antialiased selection:bg-indigo-600 selection:text-white">
      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
