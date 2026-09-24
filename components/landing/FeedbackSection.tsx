"use client";

import type { FormEvent } from "react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/public-contact";
import { buildFeedbackMailto } from "./feedback-mailto";

export default function FeedbackSection() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const messageField = form.elements.namedItem("message");
    if (!(messageField instanceof HTMLTextAreaElement)) return;

    const message = messageField.value.trim();
    if (message.length < 10) {
      messageField.setCustomValidity("Please write at least 10 characters.");
      messageField.reportValidity();
      return;
    }

    const name = new FormData(form).get("name");
    window.location.href = buildFeedbackMailto(
      typeof name === "string" ? name : "",
      message,
    );
  }

  return (
    <section
      id="feedback"
      className="relative px-5 py-24 sm:px-8"
      style={{ background: "var(--l-bg)" }}
      aria-labelledby="feedback-title"
    >
      <div className="divider" />
      <div className="mx-auto grid max-w-[90rem] gap-12 pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="landing-section-reveal">
          <span className="section-label mb-6 block">An open channel</span>
          <h2
            id="feedback-title"
            className="landing-feedback-title"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 400,
              color: "var(--l-text)",
            }}
          >
            Share your <em>perspective.</em>
          </h2>
          <p className="mt-7 max-w-lg text-sm leading-relaxed text-[var(--l-text-muted)]">
            What feels useful? What feels off? Aletheia is still taking shape,
            and specific feedback helps decide what to improve next.
          </p>
          <p className="mt-8 text-xs text-[var(--l-text-dim)]">
            Prefer to write directly?{" "}
            <a href={SUPPORT_MAILTO} className="landing-feedback-email">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>

        <form
          className="landing-feedback-form landing-section-reveal"
          onSubmit={handleSubmit}
        >
          <div className="landing-feedback-topline">
            <span>01 / Your note</span>
            <span>For the maker</span>
          </div>
          <div className="landing-feedback-field">
            <label htmlFor="feedback-name">Your name</label>
            <input
              id="feedback-name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={80}
              placeholder="Optional"
            />
          </div>
          <div className="landing-feedback-field">
            <label htmlFor="feedback-message">Your message</label>
            <textarea
              id="feedback-message"
              name="message"
              rows={5}
              required
              minLength={10}
              maxLength={1200}
              aria-describedby="feedback-note"
              placeholder="Tell us what would make Aletheia more useful to you."
              onInput={(event) => event.currentTarget.setCustomValidity("")}
            />
          </div>
          <div className="landing-feedback-actions">
            <p id="feedback-note">
              Nothing is sent until you send it from your email app.
            </p>
            <button type="submit" className="btn-primary">
              Open email draft <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
