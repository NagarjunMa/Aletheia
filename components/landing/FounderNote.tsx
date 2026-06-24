// TODO(founder-photo): drop a real headshot at /public/founder.jpg and
// replace the initials avatar below with a <Image> tag.
const FOUNDER_NAME = "Nagarjun Mallesh";
const FOUNDER_LOCATION = "Boston, Massachusetts";
const FOUNDER_INITIALS = "NM";

export default function FounderNote() {
  return (
    <section
      id="founder"
      className="relative px-8 py-32"
      style={{ background: "var(--l-bg)" }}
    >
      <div className="divider" />

      <div className="mx-auto max-w-3xl pt-20">
        <div className="landing-section-reveal">
          <span className="section-label mb-6 block">
            A note from the maker
          </span>
        </div>

        <h2
          className="landing-section-reveal mb-12"
          style={{
            fontFamily: "var(--font-flaviotte), Playfair Display, serif",
            fontWeight: 800,
            fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)",
            lineHeight: 1.18,
            color: "var(--l-text)",
            letterSpacing: "-0.015em",
          }}
        >
          I built Aletheia because I wanted to keep writing personal notes —
          without spending my afternoon on each one.
        </h2>

        <div
          className="landing-section-reveal space-y-6 text-base leading-relaxed"
          style={{
            color: "var(--l-text-muted)",
            background: "var(--l-surface-dark)",
            backdropFilter: "blur(6px)",
            padding: "2.5rem",
          }}
        >
          <p>Hi — I&apos;m Nagarjun.</p>

          <p>
            For a while, every LinkedIn connection request I sent was
            hand-written. Open the profile, skim three jobs, find the recent
            post that overlapped with my resume, write the opener, trim it
            twice. Reaching out to a recruiter at a small startup took fifteen
            minutes. Reaching out to twenty people took the morning.
          </p>

          <p>
            I tried letting a large language model do the writing. The drafts
            were fast, but they read like drafts a model wrote — wrong tone, the
            em-dash watermark, opening lines I would never use, twice the length
            any thoughtful note should be. Sending those didn&apos;t feel like
            me. The reply rate said the same.
          </p>

          <p>
            Aletheia is the in-between I wanted. It reads the profile I have
            open and the primary resume in my account, then puts together a
            short note in my voice that I review before I send. Same care, none
            of the tab-juggling.
          </p>

          <p style={{ color: "var(--l-text)" }}>
            If you have sat at your laptop with five LinkedIn tabs open trying
            to draft a note that didn&apos;t sound generic — this is for you.
          </p>
        </div>

        {/* Signature */}
        <div
          className="landing-section-reveal mt-12 flex items-center gap-4 pt-8"
          style={{ borderTop: "1px solid var(--l-border)" }}
        >
          <div
            aria-hidden
            className="flex h-12 w-12 items-center justify-center"
            style={{
              background: "var(--l-surface-3)",
              border: "1px solid var(--l-border)",
              fontFamily: "var(--font-flaviotte), Playfair Display, serif",
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
            <p className="mt-1 text-xs" style={{ color: "var(--l-text-dim)" }}>
              {FOUNDER_LOCATION} · Solo developer
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
