const trialDetails = [
  "40 trial credits, granted once per account",
  "2 credits for a LinkedIn connection note",
  "4 credits for cold email, InMail, or a YC application answer",
  "Credits do not expire; daily safeguards still apply",
];

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="relative px-5 py-28 sm:px-8"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />
      <div className="mx-auto max-w-5xl pt-20">
        <div className="landing-section-reveal mx-auto mb-14 max-w-2xl text-center">
          <span className="section-label mx-auto mb-5 block w-fit">
            Current access
          </span>
          <h2
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 900,
              fontSize: "clamp(1.8rem, 3.8vw, 2.7rem)",
              lineHeight: 1.08,
              color: "var(--l-text)",
              letterSpacing: "-0.02em",
            }}
          >
            Start with the work in front of you.
          </h2>
          <p
            className="mt-5 text-sm leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
          >
            Aletheia currently includes a 40-credit trial. Refill checkout is
            not available yet, so no paid plan or purchase is being advertised
            here.
          </p>
        </div>

        <div
          className="landing-section-reveal mx-auto max-w-2xl p-8 sm:p-10"
          style={{
            background: "var(--l-surface)",
            border: "1px solid var(--l-border)",
          }}
        >
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--l-blue)" }}
              >
                Trial
              </p>
              <p
                className="mt-3 text-5xl"
                style={{
                  fontFamily: "var(--font-cormorant), Georgia, serif",
                  color: "var(--l-text)",
                  fontWeight: 900,
                  fontStyle: "italic",
                }}
              >
                $0
              </p>
            </div>
            <a
              href="/install"
              className="btn-primary justify-center sm:min-w-48"
            >
              Get Aletheia on Chrome
            </a>
          </div>
          <ul
            className="mt-9 grid gap-3 border-t pt-8 text-sm leading-relaxed sm:grid-cols-2"
            style={{
              borderColor: "var(--l-border)",
              color: "var(--l-text-muted)",
            }}
          >
            {trialDetails.map((detail) => (
              <li key={detail} className="flex gap-3">
                <span style={{ color: "var(--l-blue)" }}>·</span>
                {detail}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
