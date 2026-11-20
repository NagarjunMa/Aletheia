"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  ClipboardList,
  Mail,
  Menu,
  MessageSquareText,
  X,
} from "lucide-react";
import styles from "./site-chrome.module.css";

const storeUrl =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ??
  "https://chromewebstore.google.com/detail/pneenlhefkghefjpaafgllkjkpfjnkgg";

const offerings = [
  {
    title: "LinkedIn connection notes",
    description:
      "Start a conversation with a short draft based on the selected profile.",
    anchor: "#connection-notes",
    icon: MessageSquareText,
  },
  {
    title: "Cold email and InMail",
    description:
      "Draft introductions and follow-ups with a clear reason to reach out.",
    anchor: "#outreach-drafts",
    icon: Mail,
  },
  {
    title: "Application answers",
    description:
      "Answer job application questions with experience you’ve reviewed.",
    anchor: "#application-answers",
    icon: ClipboardList,
  },
];

const links = [
  ["How it works", "#how-it-works"],
  ["Trust", "#trust"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
] as const;

export default function Navbar() {
  const prefix = usePathname() === "/" ? "" : "/";
  const [open, setOpen] = useState<"offerings" | "mobile" | null>(null);
  const nav = useRef<HTMLElement>(null);
  const offeringsButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1280px)");
    const close = () => setOpen(null);
    function closeOutside(event: Event) {
      if (event.target instanceof Node && !nav.current?.contains(event.target))
        close();
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      close();
      (open === "offerings" ? offeringsButton : mobileButton).current?.focus();
    }
    desktop.addEventListener("change", close);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      desktop.removeEventListener("change", close);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  function offeringLinks() {
    return (
      <ul className={styles.offerings}>
        {offerings.map(({ title, description, anchor, icon: Icon }) => (
          <li key={anchor}>
            <a href={prefix + anchor} onClick={() => setOpen(null)}>
              <Icon className={styles.offerIcon} size={19} aria-hidden="true" />
              <span>
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
              <ArrowUpRight
                className={styles.offerArrow}
                size={15}
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ul>
    );
  }

  const actions = (
    <div className={styles.actions}>
      <Link href="/dashboard" onClick={() => setOpen(null)}>
        Open Dashboard
      </Link>
      <a
        className={styles.install}
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setOpen(null)}
      >
        Get on Chrome Web Store
        <ArrowUpRight size={15} aria-hidden="true" />
      </a>
    </div>
  );

  return (
    <header className={`landing-navbar ${styles.header}`}>
      <nav ref={nav} className={styles.nav} aria-label="Primary navigation">
        <Link
          href="/"
          className={styles.brand}
          aria-label="Aletheia home"
          onClick={() => setOpen(null)}
        >
          <Image src="/Aletheia.svg" alt="Aletheia" width={23} height={23} />
          <span>Aletheia</span>
        </Link>

        <div className={styles.desktop}>
          <div className={styles.offeringsAnchor}>
            <button
              ref={offeringsButton}
              type="button"
              className={styles.navLink}
              aria-expanded={open === "offerings"}
              aria-controls="landing-offerings"
              onClick={() => setOpen(open === "offerings" ? null : "offerings")}
            >
              What we offer
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            <div
              id="landing-offerings"
              className={styles.offeringsPanel}
              hidden={open !== "offerings"}
            >
              {offeringLinks()}
            </div>
          </div>
          {links.map(([label, anchor]) => (
            <a
              className={styles.navLink}
              key={anchor}
              href={prefix + anchor}
              onClick={() => setOpen(null)}
            >
              {label}
            </a>
          ))}
        </div>

        <div className={styles.desktopActions}>{actions}</div>
        <button
          ref={mobileButton}
          type="button"
          className={styles.mobileToggle}
          aria-label={
            open === "mobile" ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={open === "mobile"}
          aria-controls="landing-mobile-navigation"
          onClick={() => setOpen(open === "mobile" ? null : "mobile")}
        >
          {open === "mobile" ? (
            <X size={22} aria-hidden="true" />
          ) : (
            <Menu size={22} aria-hidden="true" />
          )}
        </button>

        <div
          id="landing-mobile-navigation"
          className={styles.mobilePanel}
          hidden={open !== "mobile"}
        >
          <p className={styles.groupLabel}>What we offer</p>
          {offeringLinks()}
          <div className={styles.mobileLinks}>
            {links.map(([label, anchor]) => (
              <a
                className={styles.navLink}
                key={anchor}
                href={prefix + anchor}
                onClick={() => setOpen(null)}
              >
                {label}
              </a>
            ))}
          </div>
          {actions}
        </div>
      </nav>
    </header>
  );
}
