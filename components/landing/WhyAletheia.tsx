import { BookOpenCheck, MessagesSquare, PencilLine } from "lucide-react";

type Card = {
  icon: typeof BookOpenCheck;
  badge: string;
  title: string;
  body: string;
  tag: string;
};

const cards: Card[] = [
  {
    icon: BookOpenCheck,
    badge: "Choose the material",
    title: "Start with the details that matter.",
    body: "A considered introduction begins with the profile or opportunity in front of you, the reason you are writing, and the experience you want to bring into view.",
    tag: "01",
  },
  {
    icon: PencilLine,
    badge: "Keep it bounded",
    title: "A useful draft is specific, not expansive.",
    body: "Aletheia helps turn selected context into a concise starting point, so you can focus on relevance, tone, and the next step rather than a blank page.",
    tag: "02",
  },
  {
    icon: MessagesSquare,
    badge: "Make it yours",
    title: "Your judgment remains the final edit.",
    body: "Review, revise, copy, approve, or reject every draft. Feedback can help Aletheia learn your preferred structure and wording, but it never decides what to send.",
    tag: "03",
  },
];

export default function WhyAletheia() {
  return (
    <section
      id="features"
      className="relative px-8 py-32"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="mx-auto max-w-7xl pt-24">
        {/* Header */}
        <div className="landing-section-reveal mb-20 grid gap-12 md:grid-cols-2 md:items-end">
          <div>
            <span className="section-label mb-5 block">Why Aletheia</span>
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
              For messages that deserve{" "}
              <em style={{ fontStyle: "italic", fontWeight: 400 }}>
                more than a template
              </em>
              .
            </h2>
          </div>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
          >
            Aletheia is for people who want professional outreach to reflect
            genuine context—without losing an afternoon to the first sentence.
          </p>
        </div>

        {/* Cards — GSAP scroll-reveal */}
        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.tag}
                className="landing-section-reveal why-card relative flex flex-col p-8"
                style={{
                  background: "var(--l-surface-dark)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid var(--l-border)",
                  minHeight: "380px",
                }}
              >
                <div className="mb-6 flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center"
                    style={{
                      background: "var(--l-surface-3)",
                      border: "1px solid var(--l-border)",
                    }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      style={{ color: "var(--l-blue)" }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-bold tracking-widest"
                    style={{ color: "var(--l-text-dim)" }}
                  >
                    {card.tag}
                  </span>
                </div>

                <span
                  className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: "var(--l-blue)" }}
                >
                  {card.badge}
                </span>

                <h3
                  className="mb-4 text-xl"
                  style={{
                    fontFamily:
                      "var(--font-flaviotte), Playfair Display, serif",
                    fontWeight: 700,
                    color: "var(--l-text)",
                    lineHeight: 1.25,
                  }}
                >
                  {card.title}
                </h3>

                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--l-text-muted)" }}
                >
                  {card.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
