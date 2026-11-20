import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import styles from "./site-chrome.module.css";

const storeUrl =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL ??
  "https://chromewebstore.google.com/detail/pneenlhefkghefjpaafgllkjkpfjnkgg";

const groups = [
  {
    title: "Product",
    links: [
      ["LinkedIn notes", "/#connection-notes"],
      ["Cold email and InMail", "/#outreach-drafts"],
      ["Application answers", "/#application-answers"],
      ["How it works", "/#how-it-works"],
      ["Pricing", "/#pricing"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Demo", "/demo"],
      ["Install", "/install"],
      ["FAQ", "/#faq"],
      ["Status", "/status"],
    ],
  },
  {
    title: "Aletheia",
    links: [
      ["About", "/#founder"],
      ["Trust", "/#trust"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Contact", "mailto:hello@aletheia.live"],
    ],
  },
] as const;

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div>
            <p className={styles.footerLead}>
              Professional drafts, grounded in your experience.
            </p>
            <a
              className={styles.footerStore}
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chrome Web Store <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
          <nav className={styles.footerNav} aria-label="Footer navigation">
            {groups.map(({ title, links }) => (
              <div key={title}>
                <h2 className={styles.groupLabel}>{title}</h2>
                <ul>
                  {links.map(([label, href]) => (
                    <li key={href}>
                      {href.startsWith("/") ? (
                        <Link href={href}>{label}</Link>
                      ) : (
                        <a href={href}>{label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <Link
          href="/"
          className={styles.footerWordmark}
          aria-label="Aletheia home"
        >
          Aletheia
        </Link>
        <div className={styles.footerLegal}>
          <p>© {new Date().getFullYear()} Aletheia</p>
          <p>
            Aletheia is an independent product, unaffiliated with LinkedIn
            Corporation or Apollo.io.
          </p>
        </div>
      </div>
    </footer>
  );
}
