import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import WhyAletheia from "@/components/landing/WhyAletheia";
import HowItWorks from "@/components/landing/HowItWorks";
import Capabilities from "@/components/landing/Capabilities";
import TrustProof from "@/components/landing/TrustProof";
import Footer from "@/components/landing/Footer";
import LandingMotion from "@/components/landing/LandingMotion";
import OpenSpeechWidget from "@/components/landing/OpenSpeechWidget";
import ShaderBackground from "@/components/ShaderBackground";

const Pricing = dynamic(() => import("@/components/landing/Pricing"));
const FAQ = dynamic(() => import("@/components/landing/FAQ"));
const FounderNote = dynamic(() => import("@/components/landing/FounderNote"));
const CTA = dynamic(() => import("@/components/landing/CTA"));

export const metadata: Metadata = {
  title: "LinkedIn Messaging & Professional Outreach Assistant | Aletheia",
  description:
    "Compose thoughtful LinkedIn connection notes, polished InMail, tailored emails, and grounded YC application answers from context you choose. Review every draft before sending.",
  keywords: [
    "LinkedIn connection message",
    "LinkedIn InMail",
    "cold email",
    "professional outreach",
    "Chrome extension",
    "resume based drafts",
    "follow up email",
    "YC application answers",
    "job search networking",
    "professional networking drafts",
  ],
  openGraph: {
    title: "LinkedIn Messaging & Professional Outreach Assistant | Aletheia",
    description:
      "Compose thoughtful LinkedIn connection notes, polished InMail, tailored emails, and grounded YC application answers from context you choose. Review every draft before sending.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LinkedIn Messaging & Professional Outreach Assistant | Aletheia",
    description:
      "Compose thoughtful LinkedIn connection notes, polished InMail, tailored emails, and grounded YC application answers from context you choose. Review every draft before sending.",
  },
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Aletheia",
  description:
    "Aletheia is a Chrome extension and web app that helps people prepare professional outreach and grounded application answers from context they choose. Users review and edit every draft before sending.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Chrome",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    name: "40-credit trial",
  },
};

export default function Home() {
  return (
    <LandingMotion>
      <ShaderBackground />
      <a className="landing-skip-link" href="#main-content">
        Skip to content
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main id="main-content">
        <Hero />
        <WhyAletheia />
        <Capabilities />
        <HowItWorks />
        <TrustProof />
        <Pricing />
        <FAQ />
        <FounderNote />
        <CTA />
      </main>
      <Footer />
      <OpenSpeechWidget />
    </LandingMotion>
  );
}
