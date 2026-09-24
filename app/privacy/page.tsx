import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ShaderBackground from "@/components/ShaderBackground";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Aletheia collects, stores, and processes data for reviewed professional message drafts, resume context, account data, and third-party processors.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/privacy",
  },
};

const EFFECTIVE_DATE = "September 24, 2026";
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
            prepare LinkedIn connection notes, cold email, InMail, follow-ups,
            role-fit replies, and grounded YC application answers. Aletheia is
            operated by {OPERATOR_NAME}, an individual sole developer based in{" "}
            {OPERATOR_LOCATION}. We are not a registered corporation. Aletheia
            is not affiliated with, endorsed by, or sponsored by LinkedIn
            Corporation.
          </p>
          <p>
            Questions or requests: <ContactLink />.
          </p>
        </Section>

        <Section title="2. What we collect">
          <p>We collect only what we need to operate the service:</p>
          <ul>
            <li>
              <strong>Supported LinkedIn profile context</strong> — such as
              name, headline, location, role, and visible profile details. After
              you consent in the extension, it can read supported LinkedIn
              profiles you visit even when its panel is closed. Selected profile
              content is sent to Aletheia only when you request a draft. On
              Apollo, Aletheia only places a draft you have reviewed into a
              supported compose field; it does not extract Apollo profiles.
            </li>
            <li>
              <strong>Original resume files, extracted resume text,</strong>{" "}
              opportunity context, and confirmed evidence you provide in
              Aletheia. This supports professional drafts and grounded YC
              application answers from your recorded background.
            </li>
            <li>
              <strong>Generated drafts and examples you approve,</strong> plus
              accept/reject feedback you give. Approved examples and feedback
              can guide the wording and structure of future drafts for your
              account.
            </li>
            <li>
              <strong>Account email</strong> you sign up with, plus auth tokens
              issued by our identity provider (Supabase Auth).
            </li>
            <li>
              <strong>Operational telemetry</strong> — request count, error
              traces, latency. No message body or profile content in error logs.
            </li>
            <li>
              <strong>Optional support-chat information</strong> — questions,
              name, and email address you voluntarily submit through the chat
              widget on our landing page.
            </li>
            <li>
              <strong>Optional support email and feedback</strong> — the
              message, sender address, and any name you choose to include when
              you send us an email. The landing-page feedback form only prepares
              an email draft in your email app; it does not submit your text to
              Aletheia when you click the button.
            </li>
          </ul>
          <p>
            The extension checks the active page URL locally to determine
            whether the current page supports Aletheia’s profile-reading or fill
            features. The URL is not retained as browsing history or transmitted
            to Aletheia.
          </p>
          <p>
            We do <em>not</em> collect: payment card numbers through Aletheia,
            LinkedIn passwords, or LinkedIn or Apollo cookies. We do not
            automatically collect messages from other people. If you provide
            prior conversation context for a follow-up, we process only the
            context you choose to submit. Aletheia currently provides a trial
            only; refill checkout is not available.
          </p>
        </Section>

        <Section title="3. Where data is stored">
          <p>
            Your data is stored across these processors. Each link is the
            processor’s own privacy notice:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — Postgres database, authentication, and
              private file storage. Stores your account, original resume files,
              extracted resume text, generated message history, and
              accept/reject feedback.{" "}
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
              writes your drafts. Depending on the request, selected profile,
              resume, application-profile, role or opportunity, prior
              conversation, and approved-example context may be sent to generate
              the draft. Anthropic handles submitted content under its published
              API data-handling and retention terms.{" "}
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
            <li>
              <strong>OpenSpeechAI</strong> — provides the optional landing-page
              support chat. It receives the messages and contact details you
              choose to submit, along with ordinary request metadata needed to
              deliver the widget.{" "}
              <a
                href="https://openspeechai.com/privacy-policy"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                openspeechai.com/privacy-policy
              </a>
            </li>
          </ul>
          <p>
            We do not sell, rent, or share your data with advertisers. Aletheia
            does not train AI models on your drafting context. Selected context
            is shared with Anthropic to generate the draft you request, subject
            to Anthropic’s published API terms.
          </p>
          <p>
            Aletheia’s use and transfer of information received through Chrome
            APIs complies with the Chrome Web Store User Data Policy, including
            the Limited Use requirements. We use this information only to
            provide or improve Aletheia’s single user-facing purpose. We do not
            use or transfer it for personalized advertising, sell it, use it for
            creditworthiness or lending, or permit human access except with
            explicit user consent for support, for security purposes, to comply
            with applicable law, or in aggregated and anonymized form for
            internal operations.
          </p>
        </Section>

        <Section title="4. Cookies, local storage, support chat, and extension consent">
          <p>
            The web app sets only the cookies required for sign-in (Supabase
            session cookies). No advertising or cross-site tracking cookies.
          </p>
          <p>
            If you choose auto-fill, the extension places a reviewed draft into
            a supported compose field. It does not click Send, submit forms, or
            otherwise send messages for you.
          </p>
          <p>
            The Chrome extension uses <code>chrome.storage.local</code> to
            remember your sign-in token, profile-reading consent, extension
            preferences, and accepted-message history on your own device. Your
            uploaded resumes are stored in your Aletheia account rather than in
            Chrome local storage.
          </p>
          <p>
            The optional OpenSpeechAI chat widget initializes only after you
            visit the public landing page and is hidden on every other route. It
            uses browser local storage to maintain a chat session and remember
            information you choose to provide. Opening the widget or submitting
            a message sends that chat information to OpenSpeechAI so it can
            provide the requested support experience.
          </p>
          <p>
            Before reading supported profile content, the extension presents an
            in-product disclosure and requires your affirmative consent. You can
            decline or later withdraw this consent in the extension settings.
            When consent is declined or withdrawn, active profile readers stop
            and extracted profile state is cleared.
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
              <strong>Withdraw profile-reading consent</strong> in the extension
              settings. You can stop all extension processing by uninstalling
              it, and you can request deletion of the account data held by
              Aletheia.
            </li>
            <li>
              <strong>Lodge a complaint</strong> with your local data protection
              authority if you believe we have mishandled your data.
            </li>
          </ul>
          <p>
            If you are an EU/UK/Swiss resident, your rights under GDPR / UK GDPR
            apply. Our legal basis for processing is your affirmative consent
            for profile reading and requested drafts, and our legitimate
            interest in securely operating the service.
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
            Ready original resume files and extracted text remain in your
            account until you delete the resume or request account deletion.
            Files that are rejected, canceled, or abandoned remain private in
            quarantine and are scheduled for deletion by a daily cleanup job.
            Vercel Hobby scheduling or a temporary infrastructure failure may
            delay that cleanup; the file remains private and unavailable to
            drafting while cleanup retries.
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
            Our processors (Supabase, Anthropic, Vercel, Sentry, and the
            optional OpenSpeechAI support chat) operate in the United States and
            other regions. By using Aletheia you consent to transfer of your
            data to those jurisdictions for the purposes described above.
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
    <a href={SUPPORT_MAILTO} className="underline">
      {SUPPORT_EMAIL}
    </a>
  );
}
