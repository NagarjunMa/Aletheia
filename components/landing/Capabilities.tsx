import { BookOpenCheck, Mail, MessageSquareText, Sparkles } from "lucide-react";

const capabilities = [
  {
    icon: MessageSquareText,
    eyebrow: "Thoughtful introductions",
    title: "Make the first note feel considered.",
    body: "Shape a LinkedIn connection note around the profile you selected and the purpose you bring to the conversation. You decide what earns a place in the final draft.",
  },
  {
    icon: Mail,
    eyebrow: "Longer-form outreach",
    title: "Carry the same care into email and InMail.",
    body: "Prepare cold emails, InMail, follow-ups, referral requests, and role-fit summaries with a clear reason to reach out and a restrained next step.",
  },
  {
    id: "application-answers",
    icon: BookOpenCheck,
    eyebrow: "Your source of truth",
    title: "Work from the experience you have recorded.",
    body: "Choose a primary resume and keep confirmed evidence in your application profile. Grounded YC application answers draw on those user-confirmed sources.",
  },
  {
    icon: Sparkles,
    eyebrow: "A draft in your voice",
    title: "Keep judgment where it belongs.",
    body: "Review, edit, copy, approve, or reject each draft. Your feedback can help Aletheia learn the wording and structure you prefer over time.",
  },
];

export default function Capabilities() {
  return (
    <section
      id="product"
      className="relative px-5 py-28 sm:px-8"
      style={{ background: "var(--l-bg-alt)" }}
    >
      <div className="divider" />
      <div className="mx-auto max-w-7xl pt-20">
        <div className="landing-section-reveal mb-14 grid gap-8 md:grid-cols-2 md:items-end">
          <div>
            <span className="section-label mb-5 block">
              The writing workspace
            </span>
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
              Context before copy.{" "}
              <em style={{ fontStyle: "italic", fontWeight: 400 }}>
                Judgment before send.
              </em>
            </h2>
          </div>
          <p
            className="max-w-xl text-sm leading-relaxed"
            style={{ color: "var(--l-text-muted)" }}
          >
            Aletheia is designed for professional outreach that should sound
            like a person who paid attention—not a template applied at scale.
          </p>
        </div>

        <div
          className="grid gap-px md:grid-cols-2"
          style={{ background: "var(--l-border)" }}
        >
          {capabilities.map((capability, index) => {
            const Icon = capability.icon;
            return (
              <article
                key={capability.title}
                id={capability.id}
                className="landing-section-reveal scroll-mt-24 flex gap-5 p-7 sm:p-9"
                style={{
                  background: "var(--l-surface)",
                  animationDelay: `${index * 0.08}s`,
                }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center"
                  style={{
                    background: "var(--l-surface-3)",
                    border: "1px solid var(--l-border)",
                    color: "var(--l-blue)",
                  }}
                >
                  <Icon size={18} strokeWidth={1.5} aria-hidden />
                </span>
                <div>
                  <p
                    className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: "var(--l-blue)" }}
                  >
                    {capability.eyebrow}
                  </p>
                  <h3
                    className="mb-3 text-xl"
                    style={{
                      fontFamily:
                        "var(--font-flaviotte), Playfair Display, serif",
                      color: "var(--l-text)",
                      fontWeight: 700,
                    }}
                  >
                    {capability.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--l-text-muted)" }}
                  >
                    {capability.body}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
