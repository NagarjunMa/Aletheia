import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ShaderBackground from "@/components/ShaderBackground";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Aletheia collects, stores, and processes data. Plain-English disclosure of LinkedIn profile reads, resume text, generated messages, and third-party processors (Supabase, Anthropic, Sentry, Vercel).",
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = "May 19, 2026";
const CONTACT_EMAIL = "hello@aletheia.live";
const OPERATOR_NAME = "Nagarjun Mallesh";
const OPERATOR_LOCATION = "Boston, Massachusetts, United States";

export default function PrivacyPage() {
  return (
    <div className="landing">
      <ShaderBackground />
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-24">
        <header className="mb-12">
          <p
            className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--l-blue)" }}
          >
            Legal
          </p>
          <h1
            className="font-serif text-5xl md:text-6xl"
            style={{ color: "var(--l-text)", lineHeight: 1.1 }}
          >
            Privacy Policy
          </h1>
          <p className="mt-6 text-sm" style={{ color: "var(--l-text-dim)" }}>
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        <Section title="1. Who we are">
          <p>
            Aletheia is a Chrome extension and web service that helps people
            write LinkedIn connection requests, cold emails, and InMails.
            Aletheia is operated by {OPERATOR_NAME}, an individual sole
            developer based in {OPERATOR_LOCATION}. We are not a registered
            corporation. Aletheia is not affiliated with, endorsed by, or
            sponsored by LinkedIn Corporation.
          </p>
          <p>
            Questions or requests: <ContactLink />.
          </p>
        </Section>

        <Section title="2. What we collect">
          <p>We collect only what we need to operate the service:</p>
          <ul>
            <li>
              <strong>LinkedIn profile content</strong> you choose to read with
              the extension — name, headline, location, about section,
              experience, recent posts, skills, and the public profile URL. We
              read this from the page DOM at the moment you click Generate.
            </li>
            <li>
              <strong>Resume and job description text</strong> you paste into
              the extension. Used to ground the generated message in your real
              background.
            </li>
            <li>
              <strong>Generated messages</strong> the AI produces, plus
              accept/reject feedback you give. Used to improve future
              generations for your account.
            </li>
            <li>
              <strong>Account email</strong> you sign up with, plus auth tokens
              issued by our identity provider (Supabase Auth).
            </li>
            <li>
              <strong>Operational telemetry</strong> — request count, error
              traces, latency. No message body or profile content in error logs.
            </li>
          </ul>
          <p>
            We do <em>not</em> collect: payment card numbers (no paid tier yet),
            LinkedIn passwords, LinkedIn cookies belonging to third parties, or
            messages from people other than you.
          </p>
        </Section>

        <Section title="3. Where data is stored">
          <p>
            Your data is stored across these processors. Each link is the
            processor’s own privacy notice:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — Postgres database and auth. Stores
              your account, generated message history, accept/reject feedback.{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                supabase.com/privacy
              </a>
            </li>
            <li>
              <strong>Anthropic</strong> (Claude API) — runs the AI model that
              writes your messages. We send only the data needed to generate the
              requested message. We configure zero data retention where
              available.{" "}
              <a
                href="https://www.anthropic.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                anthropic.com/privacy
              </a>
            </li>
            <li>
              <strong>Vercel</strong> — hosts the web app and API. Receives
              request metadata (IP, user agent) for routing and abuse
              prevention.{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                vercel.com/legal/privacy-policy
              </a>
            </li>
            <li>
              <strong>Sentry</strong> — server-side error tracking. Receives
              stack traces and error context. Configured to scrub message bodies
              and personal data.{" "}
              <a
                href="https://sentry.io/privacy/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                sentry.io/privacy
              </a>
            </li>
          </ul>
          <p>
            We do not sell, rent, or share your data with advertisers. We do not
            use your message content to train any third-party AI model beyond
            the single request that generates your message.
          </p>
        </Section>

        <Section title="4. Cookies and local storage">
          <p>
            The web app sets only the cookies required for sign-in (Supabase
            session cookies). No advertising or cross-site tracking cookies.
          </p>
          <p>
            The Chrome extension uses <code>chrome.storage.local</code> to
            remember your sign-in token, your saved resume, and your
            accepted-message history on your own device. This data does not
            leave your machine unless you make a generate request.
          </p>
        </Section>

        <Section title="5. Your rights">
          <p>You can, at any time:</p>
          <ul>
            <li>
              <strong>Access</strong> the data we hold about you — email{" "}
              <ContactLink /> and we will send an export.
            </li>
            <li>
              <strong>Delete</strong> your account and all associated data —
              email <ContactLink /> with the subject{" "}
              <em>“Delete my account”</em>. We process deletion within 30 days.
            </li>
            <li>
              <strong>Correct</strong> inaccurate data in your account.
            </li>
            <li>
              <strong>Withdraw consent</strong> by uninstalling the extension
              and deleting your account.
            </li>
            <li>
              <strong>Lodge a complaint</strong> with your local data protection
              authority if you believe we have mishandled your data.
            </li>
          </ul>
          <p>
            If you are an EU/UK/Swiss resident, your rights under GDPR / UK GDPR
            apply. Our legal basis for processing is your consent (when you
            install and sign in) and our legitimate interest in operating the
            service.
          </p>
        </Section>

        <Section title="6. Data retention">
          <p>
            We retain your account data while your account is active. After
            account deletion, identifiable data is removed within 30 days.
            Anonymous aggregated metrics (e.g. total messages generated per day)
            may be retained for product analytics.
          </p>
          <p>
            Server logs containing IP addresses are kept for up to 30 days for
            abuse and security investigations, then deleted.
          </p>
        </Section>

        <Section title="7. Children">
          <p>
            Aletheia is intended for adults. Do not use the service if you are
            under 18. We do not knowingly collect data from children. If you
            believe a child has signed up, email <ContactLink /> and we will
            remove the account.
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            We use HTTPS everywhere, row-level security on the database, scoped
            service tokens, and least-privilege access. No system is perfectly
            secure. If you discover a vulnerability, email <ContactLink /> with
            the subject <em>“Security”</em> and we will respond within 7 days.
          </p>
        </Section>

        <Section title="9. International transfers">
          <p>
            Our processors (Supabase, Anthropic, Vercel, Sentry) operate in the
            United States and other regions. By using Aletheia you consent to
            transfer of your data to those jurisdictions for the purposes
            described above.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We may update this policy. If we make material changes we will
            update the effective date at the top and, where possible, notify you
            by email or in-app banner before the change takes effect.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions, deletion requests, complaints: <ContactLink />. We reply
            within 7 business days.
          </p>
        </Section>

        <div className="mt-16 flex gap-6 text-sm">
          <Link
            href="/"
            className="underline"
            style={{ color: "var(--l-text-dim)" }}
          >
            Back to home
          </Link>
          <Link
            href="/terms"
            className="underline"
            style={{ color: "var(--l-text-dim)" }}
          >
            Terms of Service
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2
        className="mb-4 font-serif text-2xl"
        style={{ color: "var(--l-text)" }}
      >
        {title}
      </h2>
      <div
        className="prose-aletheia space-y-4 text-base leading-relaxed"
        style={{ color: "var(--l-text-muted)" }}
      >
        {children}
      </div>
    </section>
  );
}

function ContactLink() {
  return (
    <a href="mailto:hello@aletheia.live" className="underline">
      {CONTACT_EMAIL}
    </a>
  );
}
