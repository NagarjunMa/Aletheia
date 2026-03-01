import type { Metadata } from 'next'
import { Inter, DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })

export const metadata: Metadata = {
  title: {
    default: 'Aletheia — AI-Powered LinkedIn Outreach Extension',
    template: '%s | Aletheia',
  },
  description:
    'Generate personalized LinkedIn connection messages, cold emails, and InMails with AI. No clichés, no templates — messages that sound like you.',
  keywords: [
    'LinkedIn outreach',
    'AI message generator',
    'Chrome extension',
    'cold email',
    'networking',
    'InMail',
    'connection request',
  ],
  authors: [{ name: 'Aletheia Team' }],
  icons: {
    icon: '/Aletheia.svg',
    apple: '/Aletheia.svg',
  },
  openGraph: {
    title: 'Aletheia — AI LinkedIn Outreach',
    description:
      'Personalized LinkedIn messages powered by AI. No clichés, no templates.',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/Aletheia.svg',
        width: 1200,
        height: 630,
        alt: 'Aletheia — AI-Powered LinkedIn Outreach Extension',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aletheia — AI LinkedIn Outreach',
    description: 'Personalized LinkedIn messages powered by AI',
    images: ['/Aletheia.svg'],
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
      <body className={`${inter.className} ${dmSans.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}