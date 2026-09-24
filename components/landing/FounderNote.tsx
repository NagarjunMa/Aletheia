// TODO(founder-photo): drop a real headshot at /public/founder.jpg and
// replace the initials avatar below with a <Image> tag.
const FOUNDER_NAME = "Nagarjun Mallesh";
const FOUNDER_LOCATION = "Boston, Massachusetts";
const FOUNDER_INITIALS = "NM";

export default function FounderNote() {
  return (
    <section
      id="founder"
      className="founder-note relative"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="founder-note-grid mx-auto max-w-[90rem]">
        <div className="founder-note-intro landing-section-reveal">
          <span className="section-label mb-6 block">
            A note from the maker
          </span>

          <h2 className="founder-note-title">
            I built Aletheia because context switching should not be the hardest
            part of a thoughtful introduction.
          </h2>
        </div>

        <div className="founder-note-letter">
          <div
            className="founder-note-body landing-section-reveal text-base leading-relaxed"
            style={{
              color: "var(--l-text-muted)",
              background: "var(--l-surface-dark)",
              backdropFilter: "blur(6px)",
            }}
          >
            <p>Hi — I&apos;m Nagarjun.</p>

            <p>
              For a while, every LinkedIn connection note I sent was
              handwritten. I would read the profile, look for the relevant part
              of my own background, write an opener, and trim it until it felt
              honest. One message was manageable. Repeating that context switch
              was not.
            </p>

            <p>
              The point was never to hand judgment to a model. I wanted a place
              to bring the right source material together, keep the factual
              boundary clear, and start from a draft I could make my own.
            </p>

            <p>
              Aletheia is that in-between. It uses the context I choose, the
              source material I have recorded, and the purpose behind the
              message to prepare a draft that I review before I act.
            </p>

            <p style={{ color: "var(--l-text)" }}>
              If you have sat at your laptop trying to write a note that feels
              specific without sounding forced, this is for you.
            </p>
          </div>

          {/* Signature */}
          <div className="founder-note-signature landing-section-reveal flex items-center gap-4">
            <div
              aria-hidden
              className="flex h-12 w-12 items-center justify-center"
              style={{
                background: "var(--l-surface-3)",
                border: "1px solid var(--l-border)",
                fontFamily: "var(--font-flaviotte), Georgia, serif",
                fontWeight: 700,
                fontSize: "0.95rem",
                letterSpacing: "0.05em",
                color: "var(--l-blue)",
              }}
            >
              {FOUNDER_INITIALS}
            </div>
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--l-text)" }}
              >
                {FOUNDER_NAME}
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--l-text-dim)" }}
              >
                {FOUNDER_LOCATION} · Solo developer
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
