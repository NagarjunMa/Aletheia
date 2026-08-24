"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const CHROME_WEB_STORE_URL: string =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ??
  "https://chromewebstore.google.com/detail/pneenlhefkghefjpaafgllkjkpfjnkgg";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Application answers", href: "#application-answers" },
  { label: "Trust", href: "#trust" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const getThreshold = () =>
      hero ? Math.max(hero.offsetHeight - 80, 40) : 40;
    const onScroll = () => setScrolled(window.scrollY > getThreshold());
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const sections = navLinks.map((l) =>
      document.querySelector(l.href),
    ) as HTMLElement[];
    if (sections.every((s) => !s)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { threshold: [0.2, 0.5], rootMargin: "-60px 0px -30% 0px" },
    );

    sections.forEach((s) => s && observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    /* ↓ Base bg via .landing-navbar; scrolled glass handled by CSS */
    <header
      ref={headerRef}
      className={`landing-navbar fixed top-0 left-0 right-0 z-50 ${scrolled ? "scrolled" : ""}`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 py-5">
        {/* Logo — color driven by .landing-nav-logo CSS class */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <Image src="/Aletheia.svg" alt="Aletheia" width={22} height={22} />
          <span
            className="landing-nav-logo"
            style={{
              fontFamily:
                "var(--font-flaviotte), var(--font-cormorant), Georgia, serif",
              fontWeight: 300,
              fontSize: "1.35rem",
              letterSpacing: "0.04em",
            }}
          >
            Aletheia
          </span>
        </button>

        {/* Desktop Nav — colors via .landing-nav-link */}
        <div className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => {
            const sectionId = link.href.replace("#", "");
            const isActive = activeSection === sectionId;
            return (
              <button
                type="button"
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className={`landing-nav-link relative cursor-pointer ${isActive ? "active" : ""}`}
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  paddingBottom: "2px",
                }}
              >
                {link.label}
                {isActive && (
                  <span
                    className="landing-nav-active-line"
                    style={{
                      position: "absolute",
                      bottom: -2,
                      left: 0,
                      right: 0,
                      height: "1.5px",
                      background: "var(--l-blue)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right side: CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/dashboard"
            className="btn-secondary"
            style={{ fontSize: "0.68rem", padding: "0.65rem 1.1rem" }}
          >
            Open Dashboard
          </Link>
          <a
            href={CHROME_WEB_STORE_URL}
            target={
              CHROME_WEB_STORE_URL.startsWith("http") ? "_blank" : undefined
            }
            rel={
              CHROME_WEB_STORE_URL.startsWith("http")
                ? "noopener noreferrer"
                : undefined
            }
            className="btn-primary"
            style={{ fontSize: "0.68rem", padding: "0.65rem 1.4rem" }}
          >
            Get on Chrome Web Store
          </a>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="landing-menu-icon cursor-pointer p-1"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu — GSAP orchestrated easeReverse.
          Open: expo.out clip-path reveal + items stagger in.
          Close: items snap out with elastic.out + random rotation (snappy return,
          not the forward ease played backward). */}
      <div
        className={`landing-mobile-menu md:hidden px-5 sm:px-8 pb-6 pt-2 max-h-[calc(100dvh-64px)] overflow-y-auto ${
          mobileOpen ? "open" : ""
        }`}
      >
        {navLinks.map((link) => {
          const sectionId = link.href.replace("#", "");
          const isActive = activeSection === sectionId;
          return (
            <button
              type="button"
              key={link.href}
              data-mobile-item
              onClick={() => scrollTo(link.href)}
              className={`landing-nav-link block w-full py-3.5 text-left cursor-pointer ${isActive ? "active" : ""}`}
              style={{
                fontWeight: isActive ? 800 : 700,
                fontSize: "0.68rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                borderBottom: "1px solid var(--l-border)",
              }}
            >
              {isActive && (
                <span style={{ color: "var(--l-blue)", marginRight: "0.5rem" }}>
                  ·
                </span>
              )}
              {link.label}
            </button>
          );
        })}
        <div data-mobile-item className="mt-5">
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="btn-secondary"
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              marginBottom: "0.75rem",
            }}
          >
            Open Dashboard
          </Link>
          <a
            href={CHROME_WEB_STORE_URL}
            target={
              CHROME_WEB_STORE_URL.startsWith("http") ? "_blank" : undefined
            }
            rel={
              CHROME_WEB_STORE_URL.startsWith("http")
                ? "noopener noreferrer"
                : undefined
            }
            className="btn-primary"
            style={{ width: "100%", display: "flex", justifyContent: "center" }}
          >
            Get on Chrome Web Store
          </a>
        </div>
      </div>
    </header>
  );
}
