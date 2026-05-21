"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Replace with real Web Store URL once the listing is published. Until then,
// link to /demo so the click still lands on a high-trust surface.
const CHROME_WEB_STORE_URL: string =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ?? "/demo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Process", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const headerRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const hero = document.getElementById("hero");
    const triggerEnd = hero
      ? () => `${hero.offsetHeight - 80}px top`
      : () => "40px top";

    gsap.set(el, {
      backgroundColor: "rgba(5, 31, 32, 0)",
      backdropFilter: "blur(0px)",
      borderBottomColor: "rgba(218, 241, 222, 0)",
      y: 0,
    });

    const tween = gsap.to(el, {
      backgroundColor: "rgba(5, 31, 32, 0.45)",
      backdropFilter: "blur(18px)",
      borderBottomColor: "rgba(218, 241, 222, 0.10)",
      boxShadow: "0 10px 30px -20px rgba(0,0,0,0.45)",
      ease: "power2.out",
      duration: 0.6,
      paused: true,
    });

    const st = ScrollTrigger.create({
      trigger: hero || document.body,
      start: "top top",
      end: triggerEnd,
      onUpdate: (self) => {
        const active = self.progress >= 0.95;
        if (active) tween.play();
        else tween.reverse();
        setScrolled(active);
      },
    });

    return () => {
      st.kill();
      tween.kill();
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

  // Build GSAP timelines for mobile menu — orchestrated easeReverse pattern.
  // Forward (open) uses expo.out for a confident reveal; close uses elastic.out
  // for a snappy, intentional return — NOT just expo.out played backward.
  useEffect(() => {
    const menu = mobileMenuRef.current;
    if (!menu) return;

    const items = menu.querySelectorAll<HTMLElement>("[data-mobile-item]");

    gsap.set(menu, {
      clipPath: "inset(0% 0% 100% 0%)",
      autoAlpha: 0,
      pointerEvents: "none",
    });
    gsap.set(items, { y: -28, opacity: 0, rotation: 0 });

    openTlRef.current = gsap
      .timeline({ paused: true })
      .to(menu, {
        autoAlpha: 1,
        clipPath: "inset(0% 0% 0% 0%)",
        pointerEvents: "auto",
        duration: 0.55,
        ease: "expo.out",
      })
      .to(
        items,
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "expo.out",
          stagger: 0.06,
        },
        "-=0.35",
      );

    closeTlRef.current = gsap
      .timeline({ paused: true })
      .to(items, {
        y: -18,
        opacity: 0,
        rotation: () => gsap.utils.random(-8, 8),
        duration: 0.5,
        ease: "elastic.out(1, 0.45)",
        stagger: { each: 0.04, from: "end" },
      })
      .to(
        menu,
        {
          clipPath: "inset(0% 0% 100% 0%)",
          autoAlpha: 0,
          pointerEvents: "none",
          duration: 0.35,
          ease: "power3.in",
        },
        "-=0.18",
      );

    return () => {
      openTlRef.current?.kill();
      closeTlRef.current?.kill();
    };
  }, []);

  // Drive the timelines from React state.
  useEffect(() => {
    if (mobileOpen) {
      closeTlRef.current?.pause(0);
      openTlRef.current?.restart();
    } else if ((openTlRef.current?.progress() ?? 0) > 0) {
      openTlRef.current?.pause();
      closeTlRef.current?.restart();
    }
  }, [mobileOpen]);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    /* ↓ Base bg via .landing-navbar; scrolled glass tweened by GSAP */
    <header
      ref={headerRef}
      className={`landing-navbar fixed top-0 left-0 right-0 z-50 ${scrolled ? "scrolled" : ""}`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 py-5">
        {/* Logo — color driven by .landing-nav-logo CSS class */}
        <button
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
                  <motion.span
                    layoutId="nav-active-line"
                    style={{
                      position: "absolute",
                      bottom: -2,
                      left: 0,
                      right: 0,
                      height: "1.5px",
                      background: "var(--l-blue)",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right side: CTA */}
        <div className="hidden md:flex items-center gap-3">
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
            {CHROME_WEB_STORE_URL.startsWith("http")
              ? "Get on Chrome Web Store"
              : "See a real draft"}
          </a>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-3">
          <button
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
        ref={mobileMenuRef}
        className="landing-mobile-menu md:hidden px-5 sm:px-8 pb-6 pt-2 max-h-[calc(100dvh-64px)] overflow-y-auto"
        style={{
          visibility: "hidden",
          opacity: 0,
          willChange: "clip-path, opacity",
        }}
      >
        {navLinks.map((link) => {
          const sectionId = link.href.replace("#", "");
          const isActive = activeSection === sectionId;
          return (
            <button
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
            {CHROME_WEB_STORE_URL.startsWith("http")
              ? "Get on Chrome Web Store"
              : "See a real draft"}
          </a>
        </div>
      </div>
    </header>
  );
}
