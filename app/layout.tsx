import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ascendia - Personalized Voice Agent',
  description: 'Advanced AI writing assistant that learns and adapts to your unique writing style while ensuring professional clarity and correctness.',
  keywords: ['AI writing', 'personal voice', 'writing assistant', 'grammar correction', 'content polish'],
  authors: [{ name: 'Ascendia Team' }],
  openGraph: {
    title: 'Ascendia - Personalized Voice Agent',
    description: 'Advanced AI writing assistant that learns and adapts to your unique writing style',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ascendia - Personalized Voice Agent',
    description: 'Advanced AI writing assistant that learns and adapts to your unique writing style',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}