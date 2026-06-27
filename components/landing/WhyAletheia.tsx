import { Clock, Bot, Sparkles } from "lucide-react";

type Card = {
  icon: typeof Clock;
  badge: string;
  title: string;
  body: string;
  tag: string;
};

const cards: Card[] = [
  {
    icon: Clock,
    badge: "The context problem",
    title: "Good messages need more than a template.",
    body: "A useful first message needs context: who they are, what they work on, why you are reaching out, and where your background fits.",
    tag: "01",
  },
  {
    icon: Bot,
    badge: "The generic draft problem",
    title: "Most AI drafts sound too polished.",
    body: "Basic prompts often mention too much, miss the real reason for reaching out, or produce a message that does not sound like something you would send.",
    tag: "02",
  },
  {
    icon: Sparkles,
    badge: "The Aletheia way",
    title: "You stay specific and in control.",
    body: "Choose the context, pick the message type, review the draft, and decide what to use. Approved drafts help Aletheia learn the structure and wording you prefer.",
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
              For messages that need{" "}
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
            Aletheia is for students, job seekers, engineers, founders, and
            professionals who want a first message to be specific without
            spending too much time rewriting the same opener.
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
