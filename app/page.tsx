import React from 'react'
import { Metadata } from 'next'
import { EnhancedNavbar } from '@/components/landing/enhanced-navbar'
import { HeroSection } from '@/components/landing/hero-section'
import { AntiAiGrid } from '@/components/landing/anti-ai-grid'
import { AscentTimeline } from '@/components/landing/ascent-timeline'
import { PrecisionCases } from '@/components/landing/precision-cases'
import { FinalCta } from '@/components/landing/final-cta'

export const metadata: Metadata = {
  title: 'Ascendia | AI Writing Assistant for Professionals',
  description: 'Transform unclear requests into professional communication. Ascendia enhances human thought while preserving your authentic voice.',
  keywords: 'AI writing, professional communication, voice preservation, content enhancement',
  openGraph: {
    title: 'Ascendia | AI Writing Assistant for Professionals',
    description: 'Transform unclear requests into professional communication. No hallucinations, just authentic enhancement.',
    type: 'website',
    url: 'https://ascendia.ai',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ascendia | AI Writing Assistant',
    description: 'Professional AI communication without losing your voice',
  }
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-ascendia-accent selection:text-white">
      <EnhancedNavbar />
      <main>
        <HeroSection />
        <AntiAiGrid />
        <AscentTimeline />
        <PrecisionCases />
        <FinalCta />
      </main>

      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Ascendia",
            "applicationCategory": "ProductivityApplication",
            "operatingSystem": "Web",
            "description": "AI writing assistant that enhances human communication while preserving authentic voice and eliminating hallucinations.",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "reviewCount": "10000"
            }
          })
        }}
      />
    </div>
  )
}