"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Tier = {
  name: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  period: string;
  description: string;
  cta: string;
  ctaHref: string;
  download: boolean;
  highlighted: boolean;
  badge?: string;
  features: string[];
};

// TODO(stripe): Re-enable Pro tier (commented below) once Stripe is wired and
// payments are live. The "RECOMMENDED" badge has replaced the old "MOST POPULAR"
// label, since RECOMMENDED is editorial and does not falsely imply user volume.
const tiers: Tier[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    period: "/mo",
    description:
      "30 drafts per day. Reads the profile you have open and your resume. Short, on-purpose notes — every time.",
    cta: "Join Waitlist",
    ctaHref: "#cta",
    download: false,
    highlighted: false,
    features: [
      "30 drafts/day — connections, cold emails, InMails",
      "Profile + resume grounded",
      "Sounds like you wrote it",
      "Review before you send",
    ],
  },
  // Pro tier — hidden until Stripe is wired.
  // {
  //     name: 'Pro',
  //     monthlyPrice: 19,
  //     annualPrice: 15,
  //     period: '/mo',
  //     description: 'Unlimited messages. Resume grounding weaves your real background into every message. Adaptive learning from accepted messages matches your proven writing style.',
  //     cta: 'Get Pro',
  //     ctaHref: '#cta',
  //     download: false,
  //     highlighted: true,
  //     badge: 'RECOMMENDED',
  //     features: [
  //         'Unlimited messages across all 3 formats',
  //         'Resume-grounded self-introduction',
  //         'Adaptive style learning (3 accepted examples)',
  //         'Priority support',
  //     ],
  // },
  {
    name: "Team",
    monthlyPrice: null,
    annualPrice: null,
    period: "",
    description:
      "Everything in Pro, shared across your team. Usage tracking, per-seat voice profiles, dedicated support with SLA.",
    cta: "Contact Sales",
    ctaHref: "mailto:hello@aletheia.live",
    download: false,
    highlighted: false,
    features: [
      "Everything in Pro",
      "Team dashboard",
      "Per-seat voice profiles",
      "SLA + dedicated support",
    ],
  },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

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
            Same drafting quality.{" "}
            <em style={{ fontStyle: "italic" }}>Different volume.</em>
          </h2>

          {/* Annual/Monthly toggle */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <span
              className="text-xs font-bold tracking-widest uppercase"
              style={{
                color: annual ? "var(--l-text-dim)" : "var(--l-text)",
                transition: "color 0.2s ease",
              }}
            >
              Monthly
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              role="switch"
              aria-checked={annual}
              className="relative cursor-pointer"
              style={{
                width: 44,
                height: 24,
                background: annual ? "var(--l-blue)" : "var(--l-surface-3)",
                borderRadius: 0,
                border: "1.5px solid var(--l-border)",
                padding: 0,
                display: "flex",
                alignItems: "center",
                transition: "background 0.25s ease",
              }}
            >
              <motion.span
                animate={{ x: annual ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                style={{
                  display: "block",
                  width: 16,
                  height: 16,
                  background: annual ? "var(--l-bg)" : "var(--l-text-muted)",
                }}
              />
            </button>
            <span
              className="text-xs font-bold tracking-widest uppercase"
              style={{
                color: annual ? "var(--l-text)" : "var(--l-text-dim)",
                transition: "color 0.2s ease",
              }}
            >
              Annual
              {annual && (
                <span
                  className="ml-2 px-2 py-0.5"
                  style={{
                    background: "var(--l-blue)",
                    color: "var(--l-bg)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.1em",
                  }}
                >
                  SAVE 20%
                </span>
              )}
            </span>
          </div>
        </motion.div>

        {/* Pricing cards — col count tracks visible tier count */}
        <div
          className="grid gap-px md:grid-cols-2 mx-auto max-w-4xl"
          style={{ background: "var(--l-border)" }}
        >
          {tiers.map((tier, i) => {
            const displayPrice =
              tier.monthlyPrice === null
                ? "Custom"
                : tier.monthlyPrice === 0
                  ? "$0"
                  : annual
                    ? `$${tier.annualPrice}`
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
                    key={`${tier.name}-${annual}`}
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
                  {tier.period &&
                    tier.monthlyPrice !== 0 &&
                    tier.monthlyPrice !== null && (
                      <span
                        className="mb-2 text-xs"
                        style={{ color: "var(--l-text-dim)" }}
                      >
                        {tier.period}
                      </span>
                    )}
                  {tier.monthlyPrice === 0 && (
                    <span
                      className="mb-2 text-xs"
                      style={{ color: "var(--l-text-dim)" }}
                    >
                      /forever
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
