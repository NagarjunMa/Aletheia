import type { Metadata } from 'next'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import HowItWorks from '@/components/landing/HowItWorks'
import Pricing from '@/components/landing/Pricing'
import FAQ from '@/components/landing/FAQ'
import CTA from '@/components/landing/CTA'
import Footer from '@/components/landing/Footer'
import FloatingSidebar from '@/components/landing/FloatingSidebar'
import AuroraBackground from '@/components/AuroraBackground'

export const metadata: Metadata = {
  title: 'Aletheia — AI LinkedIn Message Generator | Authentic Outreach, Zero Clichés',
  description:
    'Chrome extension that reads LinkedIn profiles and generates authentic connection requests, cold emails, and InMails. 42-word negative lexicon and 21-pattern AI fingerprint detector strip robotic phrasing. Free, 30 messages/day.',
  keywords: [
    'LinkedIn outreach',
    'AI message generator',
    'Chrome extension',
    'cold email',
    'networking',
    'LinkedIn connection request',
    'InMail generator',
    'authentic LinkedIn messages',
    'human-sounding AI',
    'AI fingerprint detection',
    'profile-grounded messages',
    'cliché-free outreach',
  ],
  openGraph: {
    title: 'Aletheia — LinkedIn Messages That Strip AI Clichés Automatically',
    description: 'Chrome extension that reads LinkedIn profiles and writes connection requests, cold emails, and InMails. 42-word negative lexicon. 21 AI fingerprint patterns detected and humanized.',
    type: 'website',
    images: [{ url: '/Aletheia.svg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aletheia — LinkedIn Messages That Strip AI Clichés Automatically',
    description: 'Chrome extension that reads LinkedIn profiles and writes connection requests, cold emails, and InMails. 42-word negative lexicon. 21 AI fingerprint patterns detected and humanized.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Aletheia',
  description: 'Chrome extension for LinkedIn outreach that reads recipient profiles, generates connection requests, cold emails, and InMails, then sanitizes output through a 42-word negative lexicon and 21-pattern AI fingerprint detector to ensure authentic, human-sounding messages.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Chrome',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  softwareVersion: '1.0.0',
}

export default function Home() {
  return (
    <div className="landing">
      <AuroraBackground />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Fixed left sidebar — visible on xl+ screens */}
      <FloatingSidebar />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
