import type { Metadata } from "next";
import { Inter, DM_Sans, Cormorant_Garamond } from "next/font/google";
import localFont from "next/font/local";
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

const harmond = localFont({
  src: "../public/fonts/Harmond-ExtraBoldExpanded.otf",
  variable: "--font-harmond",
  display: "swap",
  weight: "800",
  style: "normal",
});

const flaviotte = localFont({
  src: [
    {
      path: "../public/fonts/Flaviotte.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Flaviotte.woff",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-flaviotte",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default:
      "Aletheia — LinkedIn outreach drafted from their profile and your resume",
    template: "%s | Aletheia",
  },
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
    "InMail",
    "connection request",
    "profile-grounded messages",
  ],
  authors: [{ name: "Nagarjun Mallesh" }],
  icons: {
    icon: "/Aletheia.svg",
    apple: "/Aletheia.svg",
  },
  openGraph: {
    title:
      "Aletheia — personal LinkedIn outreach, drafted from their profile and your resume",
    description:
      "Chrome extension that drafts personal LinkedIn connection requests, cold emails, and InMails from the recipient's profile and your resume. Review every draft before you send. Free tier: 30 drafts/day.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/Aletheia.svg",
        width: 1200,
        height: 630,
        alt: "Aletheia — personal LinkedIn outreach drafting tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Aletheia — personal LinkedIn outreach, drafted from their profile and your resume",
    description:
      "Chrome extension that drafts personal LinkedIn connection requests, cold emails, and InMails from the recipient's profile and your resume. Review every draft before you send. Free tier: 30 drafts/day.",
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
        className={`${inter.className} ${dmSans.variable} ${cormorant.variable} ${harmond.variable} ${flaviotte.variable} aurora-grain`}
      >
        <Providers {...(nonce ? { nonce } : {})}>{children}</Providers>
      </body>
    </html>
  );
}
