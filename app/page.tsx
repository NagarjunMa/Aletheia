import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import WhyAletheia from "@/components/landing/WhyAletheia";
import HowItWorks from "@/components/landing/HowItWorks";
// TODO(beta-launch): Re-enable <Testimonials /> once real attributed quotes
// from beta users are collected. Component preserved at
// components/landing/Testimonials.tsx; hidden from landing until then.
// import Testimonials from '@/components/landing/Testimonials'
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import FounderNote from "@/components/landing/FounderNote";
import Footer from "@/components/landing/Footer";
import FloatingSidebar from "@/components/landing/FloatingSidebar";
import ShaderBackground from "@/components/ShaderBackground";

export const metadata: Metadata = {
  title:
    "Aletheia — LinkedIn outreach drafted from their profile and your resume",
  description:
    "Chrome extension that drafts personal LinkedIn connection requests, cold emails, and InMails from the recipient's profile and your resume. Review every draft before you send. Free tier: 30 drafts/day.",
  keywords: [
    "LinkedIn outreach",
    "LinkedIn drafting tool",
    "personalized outreach",
    "connection request drafts",
    "Chrome extension",
    "cold email",
    "networking",
    "LinkedIn connection request",
    "InMail generator",
    "profile-grounded messages",
  ],
  openGraph: {
    title:
      "Aletheia — personal LinkedIn outreach, drafted from their profile and your resume",
    description:
      "Chrome extension that drafts personal LinkedIn connection requests, cold emails, and InMails from the recipient's profile and your resume. Review every draft before you send. Free tier: 30 drafts/day.",
    type: "website",
    images: [{ url: "/Aletheia.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Aletheia — personal LinkedIn outreach, drafted from their profile and your resume",
    description:
      "Chrome extension that drafts personal LinkedIn connection requests, cold emails, and InMails from the recipient's profile and your resume. Review every draft before you send. Free tier: 30 drafts/day.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Aletheia",
  description:
    "Chrome extension for LinkedIn outreach. Reads the recipient's profile and your resume, drafts a short personal note for connection requests, cold emails, and InMails. Review before you send.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Chrome",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  softwareVersion: "1.0.0",
};

export default function Home() {
  return (
    <div className="landing">
      <ShaderBackground />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Fixed left sidebar — visible on xl+ screens */}
      <FloatingSidebar />
      <Navbar />
      <main>
        <Hero />
        <WhyAletheia />
        <HowItWorks />
        {/* <Testimonials /> — hidden until beta quotes are collected (see import comment) */}
        <Pricing />
        <FAQ />
        <FounderNote />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
