import type { Metadata } from 'next'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import Testimonials from '@/components/landing/Testimonials'
import HowItWorks from '@/components/landing/HowItWorks'
import Pricing from '@/components/landing/Pricing'
import FAQ from '@/components/landing/FAQ'
import CTA from '@/components/landing/CTA'
import Footer from '@/components/landing/Footer'

export const metadata: Metadata = {
  title: 'Aletheia — AI-Powered LinkedIn Outreach Extension',
  description:
    'Generate personalized LinkedIn connection messages, cold emails, and InMails with AI. No clichés, no templates — messages that sound like you.',
  keywords: [
    'LinkedIn outreach',
    'AI message generator',
    'Chrome extension',
    'cold email',
    'networking',
    'LinkedIn connection request',
    'InMail generator',
  ],
  openGraph: {
    title: 'Aletheia — AI LinkedIn Outreach',
    description: 'Personalized LinkedIn messages powered by AI',
    type: 'website',
    images: [{ url: '/Aletheia.svg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aletheia — AI LinkedIn Outreach',
    description: 'Personalized LinkedIn messages powered by AI',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Aletheia',
  description: 'AI-powered Chrome extension for personalized LinkedIn outreach',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Chrome',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  softwareVersion: '1.0.0',
}

export default function Home() {
  return (
    <div className="landing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Testimonials />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
