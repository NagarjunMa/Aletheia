"use client";

import { motion } from "framer-motion";

type Tier = {
  name: string;
  monthlyPrice: number | null;
  period: string;
  description: string;
  cta: string;
  ctaHref: string;
  download: boolean;
  highlighted: boolean;
  badge?: string;
  features: string[];
};

// TODO(stripe): Wire these dashboard CTAs to Stripe Checkout once the webhook
// is ready to apply purchased credits through apply_credit_purchase().
const tiers: Tier[] = [
  {
    name: "Trial",
    monthlyPrice: 0,
    period: "/trial",
    description:
      "40 credits to test resume-aware generation across LinkedIn notes, cold emails, and InMails.",
    cta: "Download Extension",
    ctaHref: "/install",
    download: false,
    highlighted: false,
    features: [
      "40 credits with no expiry",
      "2 credits per LinkedIn connection",
      "4 credits per email or InMail",
      "Daily limits still protect the app",
    ],
  },
  {
    name: "Starter",
    monthlyPrice: 5,
    period: "one-time",
    description: "A small refill for focused outreach runs.",
    cta: "View Credits",
    ctaHref: "/dashboard",
    download: false,
    highlighted: false,
    features: [
      "60 credits",
      "Up to 30 LinkedIn connection notes",
      "Up to 15 emails or InMails",
      "Credits never expire",
    ],
  },
  {
    name: "Plus",
    monthlyPrice: 7,
    period: "one-time",
    description: "The best fit for weekly outreach without a subscription.",
    cta: "View Credits",
    ctaHref: "/dashboard",
    download: false,
    highlighted: true,
    badge: "RECOMMENDED",
    features: [
      "100 credits",
      "Up to 50 LinkedIn connection notes",
      "Up to 25 emails or InMails",
      "Sounds like you wrote it",
    ],
  },
  {
    name: "Pro",
    monthlyPrice: 20,
    period: "one-time",
    description: "Larger batch capacity for heavier search cycles.",
    cta: "View Credits",
    ctaHref: "/dashboard",
    download: false,
    highlighted: false,
    features: [
      "500 credits",
      "Up to 250 LinkedIn connection notes",
      "Up to 125 emails or InMails",
      "No credit expiry",
    ],
  },
];

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="relative py-28 px-5 sm:px-8"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="mx-auto max-w-7xl pt-20">
        {/* Header */}
        <motion.div
          className="mb-14 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <span
            className="section-label mb-5 block mx-auto"
            style={{ width: "fit-content" }}
          >
            Pricing
          </span>
          <h2
            style={{
              fontFamily: "var(--font-flaviotte), Playfair Display, serif",
              fontWeight: 900,
              fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)",
              lineHeight: 1.08,
              color: "var(--l-text)",
              letterSpacing: "-0.02em",
            }}
          >
            Start with 40 credits.{" "}
            <em style={{ fontStyle: "italic" }}>Refill when you need to.</em>
          </h2>
        </motion.div>

        {/* Pricing cards */}
        <div
          className="grid gap-px mx-auto max-w-5xl md:grid-cols-2 lg:grid-cols-4"
          style={{ background: "var(--l-border)" }}
        >
          {tiers.map((tier, i) => {
            const displayPrice =
              tier.monthlyPrice === null
                ? "Custom"
                : tier.monthlyPrice === 0
                  ? "$0"
                  : `$${tier.monthlyPrice}`;

            return (
              <motion.div
                key={tier.name}
                className="relative flex flex-col p-10"
                style={{
                  background: tier.highlighted
                    ? "var(--l-surface-2)"
                    : "var(--l-surface)",
                }}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: 0.65,
                  delay: i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {/* Badge */}
                {tier.badge && (
                  <div className="mb-4">
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        fontSize: "0.6rem",
                        fontWeight: 800,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        background: "var(--l-blue)",
                        color: "var(--l-bg)",
                      }}
                    >
                      {tier.badge}
                    </span>
                  </div>
                )}

                {/* Tier name */}
                <p
                  style={{
                    marginBottom: "0.25rem",
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: tier.highlighted
                      ? "var(--l-blue)"
                      : "var(--l-text-dim)",
                  }}
                >
                  {tier.name}
                </p>

                {/* Price */}
                <div className="flex items-end gap-1 mb-5">
                  <motion.span
                    key={tier.name}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      fontFamily:
                        "var(--font-flaviotte), Playfair Display, serif",
                      fontSize: "3.2rem",
                      fontWeight: 900,
                      lineHeight: 1,
                      color: "var(--l-text)",
                      fontStyle: "italic",
                    }}
                  >
                    {displayPrice}
                  </motion.span>
                  {tier.period && (
                    <span
                      className="mb-2 text-xs"
                      style={{ color: "var(--l-text-dim)" }}
                    >
                      {tier.period}
                    </span>
                  )}
                </div>

                <p
                  className="mb-8 text-sm"
                  style={{ color: "var(--l-text-muted)" }}
                >
                  {tier.description}
                </p>

                {/* Feature list */}
                <ul className="mb-10 flex flex-col gap-3 flex-1">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2.5 text-sm"
                      style={{ color: "var(--l-text-muted)" }}
                    >
                      <span
                        style={{
                          color: "var(--l-blue)",
                          fontWeight: 900,
                          fontSize: "0.9rem",
                        }}
                      >
                        ·
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href={tier.ctaHref}
                  className="flex items-center justify-center gap-2 py-3.5 transition-all duration-200 cursor-pointer"
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    background: tier.highlighted
                      ? "var(--l-blue)"
                      : "transparent",
                    color: tier.highlighted ? "var(--l-bg)" : "var(--l-text)",
                    border: tier.highlighted
                      ? "2px solid var(--l-blue)"
                      : "2px solid var(--l-text)",
                    borderRadius: "var(--l-radius, 0)",
                  }}
                  onMouseEnter={(e) => {
                    if (!tier.highlighted) {
                      e.currentTarget.style.background = "var(--l-text)";
                      e.currentTarget.style.color = "var(--l-bg)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!tier.highlighted) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--l-text)";
                    }
                  }}
                >
                  {tier.cta}
                </a>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
