const steps = [
  {
    num: "01",
    title: "Open the profile",
    body: "Open any LinkedIn profile in Chrome. Aletheia reads the page — name, headline, location, about, experience, recent posts, and skills. HTML is stripped and injection patterns are blocked before anything leaves your browser.",
  },
  {
    num: "02",
    title: "Pick intent and format",
    body: "Choose what kind of note — connection, cold email, or InMail — and the intent behind it. Aletheia combines the profile with your resume and drafts an opener grounded in real overlap. Drafts you keep inform future ones, so the tone tracks how you actually write.",
  },
  {
    num: "03",
    title: "Review and send",
    body: "You see the draft before anyone else. Edit a word, regenerate, or send as-is. Aletheia never posts, connects, or messages on your behalf — you stay in the loop on every send.",
  },
];

const MockupCard = () => (
  <div
    style={{
      width: "100%",
      maxWidth: 420,
      background: "var(--l-surface)",
      border: "1px solid var(--l-border)",
      borderRadius: "1px",
      padding: "1.75rem",
      animation: "float-card 6s ease-in-out infinite",
    }}
  >
    {/* Chrome bar */}
    <div
      className="mb-5 flex items-center gap-2 px-3 py-2"
      style={{ background: "var(--l-surface-2)", borderRadius: "1px" }}
    >
      <div className="h-2 w-2 rounded-full" style={{ background: "#ef4444" }} />
      <div className="h-2 w-2 rounded-full" style={{ background: "#f59e0b" }} />
      <div className="h-2 w-2 rounded-full" style={{ background: "#22c55e" }} />
      <div
        className="ml-2 h-4 flex-1 flex items-center px-2"
        style={{ background: "rgba(255,255,255,0.05)", borderRadius: "1px" }}
      >
        <span style={{ fontSize: "9px", color: "#64748b" }}>
          linkedin.com/in/sarah-chen
        </span>
      </div>
    </div>

    {/* Profile */}
    <div className="mb-5 flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-full flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #235347, #0B2B26)" }}
      />
      <div>
        <div
          style={{ fontSize: "11px", fontWeight: 600, color: "var(--l-text)" }}
        >
          Sarah Chen
        </div>
        <div style={{ fontSize: "9px", color: "var(--l-text-dim)" }}>
          ML Engineer · Google DeepMind
        </div>
      </div>
    </div>

    {/* Intent selector */}
    <div className="mb-4">
      <p
        style={{
          fontSize: "8px",
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--l-blue)",
          marginBottom: "0.5rem",
        }}
      >
        Message Intent
      </p>
      <div className="flex gap-2 flex-wrap">
        {["Networking", "Job Inquiry", "Partnership"].map((t, i) => (
          <span
            key={t}
            style={{
              fontSize: "9px",
              fontWeight: 600,
              padding: "3px 10px",
              background: i === 0 ? "var(--l-blue)" : "var(--l-surface-2)",
              color: i === 0 ? "#051F20" : "var(--l-text-dim)",
              borderRadius: "1px",
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>

    {/* Generated message */}
    <div
      className="p-3 mb-4"
      style={{
        background: "var(--l-surface-2)",
        border: "1px solid var(--l-border)",
        borderRadius: "1px",
      }}
    >
      <p
        style={{
          fontSize: "10px",
          lineHeight: 1.6,
          color: "var(--l-text-muted)",
        }}
      >
        Hi Sarah - noticed your sparse attention paper from the DeepMind blog. I
        work on similar inference problems at a smaller scale. Would love to
        hear what surprised you most in production.
      </p>
    </div>

    <div className="flex gap-2">
      <button
        type="button"
        style={{
          flex: 1,
          padding: "8px",
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: "var(--l-blue)",
          color: "#051F20",
          borderRadius: "1px",
          border: "none",
          cursor: "pointer",
        }}
      >
        Copy Message
      </button>
      <button
        type="button"
        style={{
          padding: "8px 12px",
          fontSize: "11px",
          fontWeight: 700,
          background: "var(--l-surface-2)",
          color: "var(--l-text-dim)",
          borderRadius: "1px",
          border: "none",
          cursor: "pointer",
        }}
      >
        ↺
      </button>
    </div>
  </div>
);

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden py-28 px-5 sm:px-8"
      style={{ background: "var(--l-bg-alt)" }}
    >
      <div className="mx-auto max-w-7xl">
        {/* On desktop: 2-col grid. On mobile: stacked (steps first, mockup below) */}
        <div className="grid gap-10 md:gap-16 md:grid-cols-2 md:items-start">
          {/* Left: heading + steps */}
          <div>
            <div className="landing-section-reveal">
              <span className="section-label mb-6 block">Under the Hood</span>
              <h2
                style={{
                  fontFamily: "var(--font-flaviotte), Playfair Display, serif",
                  fontWeight: 900,
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  lineHeight: 1.1,
                  color: "var(--l-text)",
                  letterSpacing: "-0.02em",
                }}
              >
                Three layers between{" "}
                <em
                  style={{ fontStyle: "italic", color: "var(--l-text-muted)" }}
                >
                  AI and inbox.
                </em>
              </h2>
            </div>

            <div className="mt-14 flex flex-col">
              {steps.map((step, i) => (
                <div
                  key={step.num}
                  className="landing-section-reveal relative flex gap-8 pb-12"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  {/* Vertical line connector */}
                  {i < steps.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 27,
                        top: 50,
                        bottom: 0,
                        width: "1px",
                        background: "var(--l-border)",
                      }}
                    />
                  )}

                  {/* Step number */}
                  <div style={{ flexShrink: 0, width: 54 }}>
                    <span
                      style={{
                        fontFamily:
                          "var(--font-flaviotte), Playfair Display, serif",
                        fontSize: "2.8rem",
                        fontWeight: 900,
                        color: "var(--l-border)",
                        lineHeight: 1,
                        fontStyle: "italic",
                        display: "block",
                      }}
                    >
                      {step.num}
                    </span>
                  </div>

                  <div>
                    <h3
                      style={{
                        marginBottom: "0.6rem",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "var(--l-text-muted)",
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        lineHeight: 1.7,
                        color: "var(--l-text-muted)",
                      }}
                    >
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: UI mockup — P1 fix: visible on ALL screen sizes, stacks below steps on mobile */}
          <div className="landing-section-reveal flex items-start justify-center md:justify-end">
            <MockupCard />
          </div>
        </div>
      </div>
    </section>
  );
}
