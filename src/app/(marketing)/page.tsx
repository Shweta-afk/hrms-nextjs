import { Hero } from "@/components/marketing/Hero";
import { Problem } from "@/components/marketing/Problem";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { WhyUs } from "@/components/marketing/WhyUs";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { FAQ } from "@/components/marketing/FAQ";
import { CTABanner } from "@/components/marketing/CTABanner";

export default function Page() {
  return (
    <>
      <Hero />
      <Problem />
      <FeatureGrid />
      <WhyUs />
      <HowItWorks />
      <FAQ />
      <CTABanner />
    </>
  );
}
