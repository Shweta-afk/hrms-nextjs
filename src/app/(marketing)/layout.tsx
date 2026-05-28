import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Axiotta HRMS — HR that runs itself",
  description:
    "Modern HRMS with built-in biometric attendance, payroll, and India-native compliance. Built for Indian SMBs.",
  icons: {
    icon: '/lightmodelogo.png',
    shortcut: '/lightmodelogo.png',
    apple: '/lightmodelogo.png',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-[hsl(222,84%,5%)] dark:text-zinc-50 antialiased selection:bg-blue-600 selection:text-white">
      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
