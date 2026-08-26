import {
  ArrowDown,
  ArrowUpRight,
  FileCheck2,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

const contextRows = [
  {
    icon: MessageSquareText,
    label: "Profile",
    value: "The page you opened",
  },
  {
    icon: FileCheck2,
    label: "Evidence",
    value: "Your selected resume and profile",
  },
  {
    icon: ShieldCheck,
    label: "Control",
    value: "Review before anything is placed",
  },
];

export default function Hero() {
  return (
    <section id="hero" className="landing-hero">
      <div
        className="landing-hero-aurora"
        data-hero-aurora
        aria-hidden="true"
      />
      <div className="landing-hero-grid" aria-hidden="true" />

      <div className="landing-hero-shell">
        <div className="landing-hero-copy">
          <div className="landing-hero-kicker" data-landing-hero-item>
            <span>Aletheia</span>
            <span aria-hidden="true">/</span>
            <span>Review-first professional writing</span>
          </div>

          <h1 className="landing-hero-title" data-landing-hero-item>
            <span>Bring the right</span>
            <span>
              <em>context</em> to every
            </span>
            <span>professional</span>
            <span>introduction.</span>
          </h1>

          <div className="landing-hero-support" data-landing-hero-item>
            <p>
              Aletheia helps you shape thoughtful LinkedIn connection notes,
              considered InMail, tailored emails, and evidence-grounded
              application answers. It draws from the profile or opportunity you
              choose and the experience you have recorded, then gives you a
              draft to refine in your own voice.
            </p>

            <div className="landing-hero-actions">
              <a href="/install" className="btn-primary">
                Get Aletheia on Chrome
                <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
              </a>
              <a href="/demo" className="btn-secondary">
                View an illustrative example
              </a>
            </div>

            <p className="landing-hero-assurance">
              Official Chrome Web Store install
              <span aria-hidden="true">·</span>
              No LinkedIn password
              <span aria-hidden="true">·</span>
              Never clicks Send
            </p>
          </div>
        </div>

        <aside
          className="landing-context-ledger"
          data-landing-hero-item
          aria-label="How Aletheia prepares a review-first draft"
        >
          <div className="landing-context-ledger-topline">
            <span>Selected context</span>
            <span>01—03</span>
          </div>

          <div className="landing-context-ledger-heading">
            <span className="landing-context-mark" aria-hidden="true">
              A
            </span>
            <div>
              <p>Context stays bounded.</p>
              <p>Judgment stays yours.</p>
            </div>
          </div>

          <dl className="landing-context-list">
            {contextRows.map(({ icon: Icon, label, value }, index) => (
              <div key={label} className="landing-context-row">
                <dt>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="landing-context-result">
            <div>
              <span className="landing-context-status" aria-hidden="true" />
              Draft ready for review
            </div>
            <p>Edit · copy · optional supported-field fill</p>
          </div>
        </aside>
      </div>

      <a
        href="#features"
        className="landing-hero-scroll"
        data-landing-hero-item
        aria-label="Continue to why Aletheia"
      >
        <span>Explore</span>
        <ArrowDown size={15} strokeWidth={1.5} aria-hidden="true" />
      </a>
    </section>
  );
}
