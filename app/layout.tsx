import type { Metadata } from "next";
import { Inter, DM_Sans, Cormorant_Garamond } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: {
    default:
      "Aletheia — AI LinkedIn Message Generator | Authentic Outreach, Zero Clichés",
    template: "%s | Aletheia",
  },
  description:
    "Chrome extension that reads LinkedIn profiles and generates authentic connection requests, cold emails, and InMails. 42-word negative lexicon and 21-pattern AI fingerprint detector strip robotic phrasing. Free, 30 messages/day.",
  keywords: [
    "LinkedIn outreach",
    "AI message generator",
    "Chrome extension",
    "cold email",
    "networking",
    "InMail",
    "connection request",
    "authentic LinkedIn messages",
    "human-sounding AI",
    "AI fingerprint detection",
    "profile-grounded messages",
    "cliché-free outreach",
  ],
  authors: [{ name: "Aletheia Team" }],
  icons: {
    icon: "/Aletheia.svg",
    apple: "/Aletheia.svg",
  },
  openGraph: {
    title: "Aletheia — LinkedIn Messages That Strip AI Clichés Automatically",
    description:
      "Chrome extension that reads LinkedIn profiles and writes connection requests, cold emails, and InMails. 42-word negative lexicon. 21 AI fingerprint patterns detected and humanized.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/Aletheia.svg",
        width: 1200,
        height: 630,
        alt: "Aletheia — AI LinkedIn Message Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aletheia — LinkedIn Messages That Strip AI Clichés Automatically",
    description:
      "Chrome extension that reads LinkedIn profiles and writes connection requests, cold emails, and InMails. 42-word negative lexicon. 21 AI fingerprint patterns detected and humanized.",
    images: ["/Aletheia.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} ${dmSans.variable} ${cormorant.variable} aurora-grain`}
      >
        <Providers {...(nonce ? { nonce } : {})}>{children}</Providers>
      </body>
    </html>
  );
}
