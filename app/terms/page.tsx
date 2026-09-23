import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ShaderBackground from "@/components/ShaderBackground";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing your use of Aletheia. Acceptable use, LinkedIn trademark disclaimer, no warranty, liability cap, governing law.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/terms",
  },
};

const EFFECTIVE_DATE = "September 22, 2026";
const CONTACT_EMAIL = "hello@aletheia.live";
const OPERATOR_NAME = "Nagarjun Mallesh";
const OPERATOR_LOCATION = "Boston, Massachusetts, United States";
const GOVERNING_LAW = "the Commonwealth of Massachusetts, United States";

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mt-6 text-sm" style={{ color: "var(--l-text-dim)" }}>
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        <Section title="1. Acceptance">
          <p>
            These Terms govern your use of Aletheia (the “Service”) — the Chrome
            extension, web app, and related APIs. The Service is operated by{" "}
            {OPERATOR_NAME}, an individual sole developer based in{" "}
            {OPERATOR_LOCATION} (“we”, “us”). By installing the extension or
            signing up, you agree to these Terms and our{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the Service.
          </p>
        </Section>

        <Section title="2. What the Service does">
          <p>
            After you consent, the extension can read visible details from
            supported LinkedIn profiles you visit; it does not extract Apollo
            profiles. When you request a draft, Aletheia combines selected
            profile or opportunity context with your available resume,
            application-profile evidence, approved examples where applicable,
            and stated intent. It prepares a connection note, cold email,
            InMail, follow-up, referral request, role-fit reply, or YC
            application answer for you to review. The Service can optionally
            fill a reviewed draft into a supported field, but does not send
            messages, submit forms, auto-connect, or contact people on your
            behalf.
          </p>
        </Section>

        <Section title="3. Your account">
          <p>
            You must be 18 or older to use the Service. You are responsible for
            keeping your sign-in credentials secure and for activity on your
            account. Notify us at <ContactLink /> if you suspect unauthorised
            access.
          </p>
        </Section>

        <Section title="4. Acceptable use">
          <p>You agree NOT to use the Service to:</p>
          <ul>
            <li>
              Send unsolicited bulk messages, spam, or commercial messages at
              scale that would violate CAN-SPAM, GDPR e-Privacy, or equivalent
              local laws.
            </li>
            <li>
              Impersonate another person, misrepresent your identity, or forge
              sender details.
            </li>
            <li>
              Build an automated sending layer on top of the Service in a way
              that violates LinkedIn’s User Agreement, Professional Community
              Policies, or any applicable platform rules.
            </li>
            <li>
              Generate harassing, defamatory, hateful, sexually explicit,
              fraudulent, or illegal content.
            </li>
            <li>
              Harvest or store personal data about people who have not
              consented, beyond the context needed for a single drafting
              session.
            </li>
            <li>
              Reverse-engineer, decompile, or attempt to extract source code,
              model weights, or prompts from the Service.
            </li>
            <li>
              Use the Service to violate any law, regulation, or third-party
              right.
            </li>
          </ul>
          <p>
            We may suspend or terminate accounts that violate this section,
            without refund.
          </p>
        </Section>

        <Section title="5. LinkedIn — your responsibility">
          <p>
            <strong>
              Aletheia is not affiliated with, endorsed by, sponsored by, or
              connected to LinkedIn Corporation. LinkedIn is a registered
              trademark of LinkedIn Corporation and its affiliates.
            </strong>
          </p>
          <p>
            LinkedIn’s User Agreement governs your activity on LinkedIn. You are
            solely responsible for ensuring that your use of any message
            generated by Aletheia complies with LinkedIn’s rules. We do not
            guarantee that LinkedIn permits any specific use of AI-generated
            messages, and we do not indemnify you against account actions taken
            by LinkedIn.
          </p>
          <p>
            Aletheia is also independent of Apollo.io. Your use of Apollo is
            subject to Apollo’s own terms and policies.
          </p>
        </Section>

        <Section title="6. Your content">
          <p>
            You retain ownership of the resume, job description, and other
            inputs you provide, and of the messages the Service generates for
            you. You grant us a limited licence to process those inputs for the
            sole purpose of operating the Service for you (including sending
            them to the AI model that drafts your message and using approved
            examples and accept/reject feedback to guide future drafts).
          </p>
          <p>
            You are responsible for the content of any message you send.
            Aletheia is a drafting tool, not the author.
          </p>
        </Section>

        <Section title="7. AI output disclaimer">
          <p>
            AI-generated drafts may contain inaccuracies, fabrications, or
            phrasing you do not endorse.{" "}
            <strong>Always review every draft before sending.</strong> We make
            no warranty that drafts are accurate, complete, original, or fit for
            any purpose.
          </p>
        </Section>

        <Section title="8. Fees">
          <p>
            New accounts receive one 40-credit trial. A connection note uses 2
            credits; a cold email, InMail, or YC application answer uses 4.
            Daily safeguards may limit use. Credits do not expire. Refill
            checkout is not currently available, and no paid plan is being
            offered through the Service at this time. No payment information is
            collected by Aletheia.
          </p>
        </Section>

        <Section title="9. Service availability">
          <p>
            The Service is provided on an “as is” and “as available” basis. We
            do not guarantee uninterrupted access. Maintenance, outages in
            third-party processors (Supabase, Anthropic, Vercel), or changes to
            the LinkedIn DOM may cause temporary disruption.
          </p>
        </Section>

        <Section title="10. No warranty">
          <p>
            To the maximum extent permitted by law, the Service is provided
            without warranty of any kind, express or implied — including
            warranties of merchantability, fitness for a particular purpose,
            non-infringement, accuracy, or that the Service will be error-free
            or secure.
          </p>
        </Section>

        <Section title="11. Limitation of liability">
          <p>
            To the maximum extent permitted by law, in no event shall Aletheia,
            its operator, or its processors be liable for any indirect,
            incidental, special, consequential, or punitive damages — including
            loss of business, loss of opportunity, reputational damage, lost
            messages, or LinkedIn account actions — arising from your use of the
            Service.
          </p>
          <p>
            Our aggregate liability for any direct damages arising from the
            Service shall not exceed the greater of (a) the amount you paid us
            in the 12 months before the claim, or (b) USD 50. This cap applies
            even if a remedy fails its essential purpose.
          </p>
        </Section>

        <Section title="12. Indemnity">
          <p>
            You agree to indemnify and hold harmless Aletheia and its operator
            from any claim, loss, or expense (including reasonable legal fees)
            arising from your misuse of the Service, your violation of these
            Terms, your violation of LinkedIn’s User Agreement, or your
            violation of any third-party right.
          </p>
        </Section>

        <Section title="13. Termination">
          <p>
            You may stop using the Service at any time. You may delete your
            account by emailing <ContactLink /> with the subject{" "}
            <em>“Delete my account”</em>.
          </p>
          <p>
            We may suspend or terminate your account if you violate these Terms,
            if continued service exposes us to legal risk, or if we discontinue
            the Service. We will give reasonable advance notice of voluntary
            discontinuation where possible.
          </p>
        </Section>

        <Section title="14. Changes to the Service or Terms">
          <p>
            We may modify the Service or these Terms. Material changes will be
            announced via the effective date above and, where possible, by email
            or in-app banner. Continued use after the effective date constitutes
            acceptance.
          </p>
        </Section>

        <Section title="15. Governing law and disputes">
          <p>
            These Terms are governed by the laws of {GOVERNING_LAW}, without
            regard to conflict-of-laws rules. Any dispute arising under these
            Terms shall be resolved exclusively in the courts located in{" "}
            {GOVERNING_LAW}, unless mandatory consumer-protection law in your
            country gives you the right to bring the claim in your local courts.
          </p>
        </Section>

        <Section title="16. Severability and entire agreement">
          <p>
            If any provision of these Terms is held unenforceable, the remaining
            provisions remain in effect. These Terms and the Privacy Policy are
            the entire agreement between you and us regarding the Service and
            supersede any prior agreements.
          </p>
        </Section>

        <Section title="17. Contact">
          <p>
            Questions about these Terms: <ContactLink />. We reply within 7
            business days.
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
            href="/privacy"
            className="underline"
            style={{ color: "var(--l-text-dim)" }}
          >
            Privacy Policy
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
        className="space-y-4 text-base leading-relaxed"
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
