# Public feedback and support contact

Date: 2026-09-24. Branch: `fix/landing-founder-note-layout`. No Linear issue
was assigned. This follow-up adds the user-requested support inbox and a public
way to compose product feedback before the existing frontend PR merges.

## Execution context and contract

Risk: **Significant** because the public support address changes on legal and
marketing pages. The form itself is a local email-app handoff, not a new
server-side data path. Full record for the cross-page contact change.

1. Landing, Privacy, and Terms show working `mailto:support@aletheia.live`
   contact links and no stale `hello@` links. A visible support address with an
   old `mailto:` target fails.
2. Landing offers an accessible, responsive feedback form with optional name,
   bounded message, and a clear button to open a pre-addressed email draft.
   It must not claim that clicking the button has already sent the message.
3. The draft has a fixed subject and safely encodes the user's text into the
   mail body. Nothing is posted to Aletheia by this form. An unencoded user
   newline that changes email headers or an empty/whitespace-only message
   fails.
4. Public-page browser, formatting, lint, type, and build checks pass. The
   support mailbox's delivery cannot be established by local code checks.

## Design and boundaries

The existing `/api/feedback` endpoint stores a row and does not send email;
the repository has no verified `feedback` table migration. Do not connect the
new public form to that route or claim mail delivery. The form uses a
`mailto:` handoff and explicitly tells visitors they must send from their own
email app. This avoids a new unauthenticated endpoint, mail-provider secret,
spam/cost boundary, or retention path. Keep the current DM Sans/Cormorant
typography, Phthalo palette, and landing section spacing. The message is
bounded to 1,200 characters and the optional name to 80; encode both into the
mail body, with a fixed subject and recipient.

No user input is sent to an Aletheia server by this form. On opening the email
app, the visitor may choose to send through their email provider. Existing
backend feedback behavior remains unchanged. Compatibility: no API or stored
data change. Rollout is the ordinary web merge/deploy after PR CI; rollback is
reverting the page/contact edits and redeploying. Mailbox ownership and actual
receipt are an external operational check, not a passing local test.

## Evaluation

| Criterion | Wrong implementation rejected               | Check                                                                     |
| --------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| 1         | Display says support but link targets hello | `e2e/landing-content.spec.ts` public contact case                         |
| 2         | Form absent or implies direct submission    | `e2e/landing-content.spec.ts` form case and responsive browser inspection |
| 3         | Unsafe/broken draft construction            | `components/landing/feedback-mailto.test.ts` and browser validation case  |
| 4         | Changed public UI breaks build              | Root lint, type-check, production build, focused Playwright suite         |

The contact-link browser check failed against the previous page because no
support link existed. The form check failed because `#feedback` did not exist.
These are the expected red results, not final validation.

## Progress and final gate

Implemented locally: a responsive form in `FeedbackSection.tsx`, a bounded
`mailto:` constructor in `feedback-mailto.ts`, one canonical support address in
`lib/public-contact.ts`, and updated public/contact/legal links. Privacy copy
now distinguishes an email draft from a sent message. The server-side
`/api/feedback` endpoint is untouched.

The source-matched disposable copy passed web lint (one unrelated existing
`refund-admin.ts` warning), type-check, production webpack build, 29/29
affected public Chromium tests, 92 files / 1,097 coverage-gated unit tests,
and the high-severity dependency audit with zero findings. The mailto helper
tests cover fixed recipient/subject, encoding, header-looking user text, and
omitted optional name. Browser checks cover public links, form semantics,
whitespace-only validation, and desktop/mobile rendering without overflow.
The support links and form cases failed before the change for their intended
missing-element reasons. Screenshots at 1440 and 390 CSS pixels were inspected
after the entry animation settled.

Not run: a real email-app handoff and receipt in the `support@aletheia.live`
mailbox; hosted PR CI; deployment. A visitor must still click Send in their
email app, and a visitor with no configured email handler can use the visible
support address elsewhere. No deployment, direct email, or Linear change
occurred in this follow-up. The user has been asked whether direct server-side
email is required instead; this email-app approach is the minimal assumed
scope until they direct otherwise.

A fresh-context read-only reviewer inspected the dirty source and affected
public callers against `origin/main` at snapshot
`f0c6eec3e89f1836b91a7bad321f155f85270d6e784ae8a8a44bd20413fd9d35`
and found no material issue. The reviewer did not rerun tests or verify live
mail delivery; those claims remain the coordinator's local evidence and an
explicit external limitation, respectively.
