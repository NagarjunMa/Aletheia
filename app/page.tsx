import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import WhyAletheia from "@/components/landing/WhyAletheia";
import HowItWorks from "@/components/landing/HowItWorks";
import Footer from "@/components/landing/Footer";
import ShaderBackground from "@/components/ShaderBackground";

const Pricing = dynamic(() => import("@/components/landing/Pricing"));
const FAQ = dynamic(() => import("@/components/landing/FAQ"));
const FounderNote = dynamic(() => import("@/components/landing/FounderNote"));
const CTA = dynamic(() => import("@/components/landing/CTA"));

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
      <Navbar />
      <main>
        <Hero />
        <WhyAletheia />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <FounderNote />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
