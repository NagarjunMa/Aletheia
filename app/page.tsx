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
  title: "Aletheia — LinkedIn Message Drafts for Professional Networking",
  description:
    "Aletheia is a Chrome extension for drafting LinkedIn connection notes, networking emails, follow-ups, and role-fit replies. Use your resume and selected profile context, then review every draft before sending.",
  keywords: [
    "LinkedIn connection message",
    "networking email",
    "professional outreach",
    "Chrome extension",
    "resume based drafts",
    "follow up email",
    "role fit summary",
    "job search networking",
    "professional networking drafts",
  ],
  openGraph: {
    title: "Aletheia — LinkedIn Message Drafts for Professional Networking",
    description:
      "Draft LinkedIn connection notes, networking emails, follow-ups, and role-fit replies from context you choose. Resume-aware, user-reviewed, and installed through Chrome.",
    type: "website",
    images: [{ url: "/Aletheia.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aletheia — LinkedIn Message Drafts for Professional Networking",
    description:
      "Draft LinkedIn connection notes, networking emails, follow-ups, and role-fit replies from context you choose. Resume-aware, user-reviewed, and installed through Chrome.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Aletheia",
  description:
    "Aletheia is a Chrome extension and web app that helps users draft professional networking messages from selected profile context, resume details, and outreach intent. Users review and edit every draft before sending.",
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
