"use client";

import Image from "next/image";
import Link from "next/link";

type FooterLink =
  | { label: string; type: "scroll"; href: string }
  | { label: string; type: "route"; href: string };

const footerLinks: FooterLink[] = [
  { label: "Features", type: "scroll", href: "#features" },
  { label: "Process", type: "scroll", href: "#how-it-works" },
  { label: "Pricing", type: "scroll", href: "#pricing" },
  { label: "FAQ", type: "scroll", href: "#faq" },
  { label: "Privacy", type: "route", href: "/privacy" },
  { label: "Terms", type: "route", href: "/terms" },
];

const linkClasses =
  "cursor-pointer text-[10px] font-bold tracking-widest uppercase transition-colors duration-150";

export default function Footer() {
  const scrollTo = (href: string) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/") {
      window.location.assign(`/${href}`);
      return;
    }
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer
      className="relative px-5 sm:px-8 py-12"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="mx-auto max-w-7xl pt-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
            <Image src="/Aletheia.svg" alt="Aletheia" width={18} height={18} />
            <span
              style={{
                fontFamily:
                  "var(--font-flaviotte), var(--font-cormorant), Georgia, serif",
                fontWeight: 300,
                fontSize: "1.2rem",
                color: "var(--l-text)",
                letterSpacing: "0.04em",
                transition: "color 0.4s ease",
              }}
            >
              Aletheia
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex flex-wrap gap-8">
            {footerLinks.map((link) =>
              link.type === "route" ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${linkClasses} text-[var(--l-text-dim)] hover:text-[var(--l-text)] transition-colors duration-150`}
                >
                  {link.label}
                </Link>
              ) : (
                <button
                  type="button"
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className={`${linkClasses} text-[var(--l-text-dim)] hover:text-[var(--l-text)] transition-colors duration-150`}
                >
                  {link.label}
                </button>
              ),
            )}
          </nav>

          {/* Copyright + disclaimer */}
          <div className="flex flex-col gap-1 md:items-end">
            <p
              className="text-[10px] tracking-widest uppercase"
              style={{ color: "var(--l-text-dim)" }}
            >
              © {new Date().getFullYear()} Aletheia
            </p>
            <p
              className="max-w-xs text-[9px] leading-relaxed md:text-right"
              style={{ color: "var(--l-text-dim)" }}
            >
              Not affiliated with, endorsed by, or sponsored by LinkedIn
              Corporation.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
