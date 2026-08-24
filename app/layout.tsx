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
  metadataBase: new URL("https://www.aletheia.live"),
  title: {
    default: "LinkedIn Messaging & Professional Outreach Assistant | Aletheia",
    template: "%s | Aletheia",
  },
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
    "job application writing",
    "job search networking",
    "professional networking drafts",
  ],
  authors: [{ name: "Nagarjun Mallesh" }],
  icons: {
    icon: "/Aletheia.svg",
    apple: "/Aletheia.svg",
  },
  openGraph: {
    title: "LinkedIn Messaging & Professional Outreach Assistant | Aletheia",
    description:
      "Compose thoughtful LinkedIn connection notes, polished InMail, tailored emails, and grounded YC application answers from context you choose. Review every draft before sending.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LinkedIn Messaging & Professional Outreach Assistant | Aletheia",
    description:
      "Compose thoughtful LinkedIn connection notes, polished InMail, tailored emails, and grounded YC application answers from context you choose. Review every draft before sending.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
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
