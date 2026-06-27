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
    default: "Aletheia — LinkedIn Message Drafts for Professional Networking",
    template: "%s | Aletheia",
  },
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
  authors: [{ name: "Nagarjun Mallesh" }],
  icons: {
    icon: "/Aletheia.svg",
    apple: "/Aletheia.svg",
  },
  openGraph: {
    title: "Aletheia — LinkedIn Message Drafts for Professional Networking",
    description:
      "Draft LinkedIn connection notes, networking emails, follow-ups, and role-fit replies from context you choose. Resume-aware, user-reviewed, and installed through Chrome.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/Aletheia.svg",
        width: 1200,
        height: 630,
        alt: "Aletheia professional networking message draft assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aletheia — LinkedIn Message Drafts for Professional Networking",
    description:
      "Draft LinkedIn connection notes, networking emails, follow-ups, and role-fit replies from context you choose. Resume-aware, user-reviewed, and installed through Chrome.",
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
