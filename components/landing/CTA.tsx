"use client";

import { motion } from "framer-motion";
import { useState } from "react";

export default function CTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <section
      id="cta"
      className="relative py-32 px-5 sm:px-8"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="mx-auto max-w-5xl pt-24">
        <motion.div
          className="grid md:grid-cols-2 gap-10 md:gap-16 items-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <span className="section-label mb-6 block">Early Access</span>
            <h2
              style={{
                fontFamily: "var(--font-flaviotte), Playfair Display, serif",
                fontWeight: 900,
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.08,
                color: "var(--l-text)",
                letterSpacing: "-0.02em",
              }}
            >
              Join the <em style={{ fontStyle: "italic" }}>waitlist.</em>
            </h2>
            <p
              className="mt-5 text-sm leading-relaxed"
              style={{ color: "var(--l-text-muted)", maxWidth: "48ch" }}
            >
              Aletheia is coming to Chrome Web Store. Be first to draft personal
              LinkedIn connection requests, cold emails, and InMails from the
              recipient&apos;s profile and your resume. Free tier includes 30
              drafts per day.
            </p>

            <p className="mt-6 text-xs" style={{ color: "var(--l-text-dim)" }}>
              Free tier at launch · 30 drafts/day · Connections, cold emails,
              InMails
            </p>
          </div>

          {/* Email form */}
          <div
            className="p-10"
            style={{
              background: "var(--l-surface)",
              border: "1px solid var(--l-border)",
            }}
          >
            {submitted ? (
              <div className="text-center">
                <div
                  className="mx-auto mb-5 flex h-12 w-12 items-center justify-center"
                  style={{
                    background: "rgba(142,182,155,0.08)",
                    border: "1px solid rgba(142,182,155,0.2)",
                  }}
                >
                  <span style={{ color: "var(--l-blue)", fontSize: "1.2rem" }}>
                    ✓
                  </span>
                </div>
                <p
                  className="text-sm font-bold tracking-widest uppercase"
                  style={{ color: "var(--l-text)" }}
                >
                  You&apos;re on the list
                </p>
                <p
                  className="mt-2 text-xs"
                  style={{ color: "var(--l-text-dim)" }}
                >
                  We&apos;ll notify you as soon as Aletheia is available on
                  Chrome Web Store.
                </p>
              </div>
            ) : (
              <>
                <p
                  className="mb-6 text-xs font-bold tracking-widest uppercase"
                  style={{ color: "var(--l-text)" }}
                >
                  Get early access
                </p>
                <form onSubmit={handleSubmit}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="mb-4 w-full bg-transparent px-4 py-3 text-sm outline-none"
                    style={{
                      border: "1px solid var(--l-border)",
                      color: "var(--l-text)",
                    }}
                  />
                  <button
                    type="submit"
                    className="btn-primary w-full justify-center"
                    style={{ width: "100%" }}
                  >
                    Notify Me
                  </button>
                  <p
                    className="mt-3 text-center text-xs"
                    style={{ color: "var(--l-text-dim)" }}
                  >
                    No spam. Unsubscribe anytime.
                  </p>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
