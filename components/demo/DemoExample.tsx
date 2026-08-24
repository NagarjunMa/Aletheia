"use client";

import {
  SAMPLE_PROFILE,
  SAMPLE_RESUME,
  SAMPLE_DRAFT,
} from "@/app/demo/sample-data";

export default function DemoExample() {
  return (
    <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
      <section
        className="p-6"
        style={{
          background: "var(--l-surface)",
          border: "1px solid var(--l-border)",
        }}
      >
        <p
          className="mb-3 text-[0.65rem] tracking-widest uppercase"
          style={{ color: "var(--l-text-dim)" }}
        >
          Illustrative input — selected profile + your resume
        </p>
        <h3
          style={{
            fontFamily: "var(--font-flaviotte), serif",
            fontSize: "1.4rem",
          }}
        >
          {SAMPLE_PROFILE.name}
        </h3>
        <p className="text-sm" style={{ color: "var(--l-text-muted)" }}>
          {SAMPLE_PROFILE.headline}
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--l-text-dim)" }}>
          {SAMPLE_PROFILE.location}
        </p>
        <p className="mt-4 text-sm" style={{ color: "var(--l-text-muted)" }}>
          {SAMPLE_PROFILE.about}
        </p>
        <p
          className="mt-4 text-xs uppercase tracking-widest"
          style={{ color: "var(--l-text-dim)" }}
        >
          Recent post
        </p>
        <p className="text-sm italic" style={{ color: "var(--l-text-muted)" }}>
          &ldquo;{SAMPLE_PROFILE.recentPost}&rdquo;
        </p>
        <p
          className="mt-6 text-xs uppercase tracking-widest"
          style={{ color: "var(--l-text-dim)" }}
        >
          Your resume snippet
        </p>
        <p
          className="mt-2 text-xs whitespace-pre-line"
          style={{ color: "var(--l-text-muted)" }}
        >
          {SAMPLE_RESUME}
        </p>
      </section>

      <section
        className="p-6"
        style={{
          background: "var(--l-surface-2)",
          border: "1px solid var(--l-border)",
        }}
      >
        <p
          className="mb-3 text-[0.65rem] tracking-widest uppercase"
          style={{ color: "var(--l-blue)" }}
        >
          Illustrative output — connection note ({SAMPLE_DRAFT.character_count}{" "}
          chars)
        </p>
        <p
          data-testid="demo-draft"
          className="text-base leading-relaxed"
          style={{
            fontFamily: "var(--font-flaviotte), serif",
            color: "var(--l-text)",
          }}
        >
          {SAMPLE_DRAFT.body}
        </p>
        <p className="mt-6 text-xs" style={{ color: "var(--l-text-dim)" }}>
          Fictional example · review and edit before using
        </p>
      </section>
    </div>
  );
}
