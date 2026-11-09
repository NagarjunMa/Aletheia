import { z } from "zod";
import {
  validateYcApplicationOutput,
  YcApplicationOutputValidationError,
} from "@/modules/application-answer/application/validate-yc-application-output";
import {
  ATOMIC_SOURCE_REWRITES,
  atomicClaimsSchema,
  CLAIM_KINDS,
  NEUTRAL_FRAMING,
  normalizeClaimText,
} from "@/modules/grounding/domain/atomic-claim";
import {
  AtomicClaimValidationError,
  validateAtomicOutput,
} from "@/modules/grounding/application/validate-atomic-claims";
import {
  finalizeGroundedOutput,
  GroundedOutputLimitError,
} from "@/modules/grounding/application/finalize-grounded-output";
import { GroundedTextSanitizationError } from "@/lib/ai/sanitizer";
import { EMAIL_MODES } from "@/lib/ai/email-formatter";
import {
  countOutputUnits,
  resolveOutputConstraint,
} from "@/lib/ai/output-constraints";

const sourceSchema = z
  .object({
    id: z.string().min(1).max(200),
    rootId: z.string().max(200).optional(),
    scope: z.enum(["candidate", "target"]),
    kind: z.enum(CLAIM_KINDS),
    content: z.string().min(1).max(600),
    rewrite: z.enum(ATOMIC_SOURCE_REWRITES).optional(),
  })
  .strict()
  .transform(({ rootId, rewrite, ...source }) => ({
    ...source,
    ...(rootId === undefined ? {} : { rootId }),
    ...(rewrite === undefined ? {} : { rewrite }),
  }));
export const discourseSampleSchema = z
  .object({
    id: z.string().regex(/^synthetic-[a-z0-9-]{1,70}$/u),
    category: z.enum([
      "linkedin_connection",
      "cold_email",
      "linkedin_inmail",
      "yc_application",
    ]),
    emailMode: z.enum(EMAIL_MODES),
    body: z.string().min(1).max(10_000),
    subject: z.string().max(1000).optional(),
    claims: atomicClaimsSchema,
    sources: z.array(sourceSchema).max(64),
    excludedClaims: z.array(z.string().max(600)).max(32),
    identity: z
      .object({
        fullName: z.string().max(120),
        linkedinUrl: z.string().max(256),
      })
      .strict()
      .optional(),
    targetRequired: z.boolean(),
  })
  .strict();
export type DiscourseSample = z.infer<typeof discourseSampleSchema>;
export const DISCOURSE_DIMENSIONS = [
  "factual_coverage",
  "target_specificity",
  "explanation_budget",
  "repetition",
  "cta",
  "channel_format",
] as const;
export type DiscourseDimension = (typeof DISCOURSE_DIMENSIONS)[number];
export interface DiscourseEvaluation {
  id: string;
  category: DiscourseSample["category"];
  emailMode: DiscourseSample["emailMode"];
  violations: DiscourseDimension[];
  factualCoverage: boolean;
  /** Invalid declared claims only; null means uncovered prose cannot be counted reliably. */
  unsupportedAssertionCount: number | null;
  declaredClaimCount: number;
  validDeclaredClaims: number;
  targetReferenceCount: number;
  candidateReferenceCount: number;
  optionalFramingWords: number;
  bodyWords: number;
  duplicateFactCount: number;
  ctaCount: number;
  opening: string;
  ctaTemplate: number | null;
  pattern: string;
  diversityEligible: boolean;
}
const CTAS = NEUTRAL_FRAMING.filter((text) => text.endsWith("?"));
const REQUIRED_FRAMING = [
  ...CTAS,
  "Hi there,",
  "Hello,",
  "Best,",
  "Thanks,",
  "Thank you.",
  "A quick look at my background:",
];
function accepts(run: () => void, ignoreOutputLimit = false): boolean {
  try {
    run();
    return true;
  } catch (error) {
    if (error instanceof GroundedOutputLimitError) return ignoreOutputLimit;
    if (
      error instanceof YcApplicationOutputValidationError ||
      error instanceof AtomicClaimValidationError ||
      error instanceof GroundedTextSanitizationError
    )
      return false;
    throw new Error("Offline evaluation failed");
  }
}
function occurrences(text: string, span: string): number {
  return span ? text.split(span).length - 1 : 0;
}
function remove(text: string, spans: readonly string[]): string {
  for (const span of [...new Set(spans)].sort((a, b) => b.length - a.length))
    text = text.split(span).join(" ");
  return text;
}
export function evaluateDiscourse(input: DiscourseSample): DiscourseEvaluation {
  const parsed = discourseSampleSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid offline evaluation sample");
  const sample = parsed.data;
  const body = normalizeClaimText(sample.body);
  const application = sample.category === "yc_application";
  const isCold = sample.category === "cold_email";
  const platform = application ? "general" : isCold ? "email" : "linkedin";
  const identity = isCold ? sample.identity : undefined;
  const validate = (limits: boolean) =>
    finalizeGroundedOutput({
      body,
      ...(sample.subject !== undefined
        ? { subject: normalizeClaimText(sample.subject) }
        : {}),
      claims: sample.claims,
      sources: sample.sources,
      excludedClaims: sample.excludedClaims,
      platform,
      ...(identity ? { trustedIdentity: identity } : {}),
      bodyConstraint: limits
        ? resolveOutputConstraint({
            category: sample.category,
            emailMode: sample.emailMode,
          })
        : {
            category: sample.category,
            unit: "characters",
            minimum: 0,
            maximum: 10_000,
          },
    });
  // Finalization checks safety/source coverage before reporting an output-limit error.
  const factualCoverage = accepts(() => validate(false), true);
  const validity = sample.claims.map((claim) =>
    accepts(() =>
      validateAtomicOutput({
        claims: [claim],
        sources: sample.sources,
        excludedClaims: sample.excludedClaims,
        fields: [{ text: claim.text, scope: "either" }],
      }),
    ),
  );
  const validDeclaredClaims = validity.filter(Boolean).length;
  const invalidClaims = sample.claims.length - validDeclaredClaims;
  const verified = sample.claims.flatMap((claim, index) => {
    const text = normalizeClaimText(claim.text);
    const source = sample.sources.find((s) => s.id === claim.source_id);
    const start = body.indexOf(text);
    return validity[index] && source && start >= 0
      ? [{ text, source, start }]
      : [];
  });
  const targetReferenceCount = verified.filter(
    (c) => c.source.scope === "target",
  ).length;
  const bodyWords = countOutputUnits(body, "words");
  const signature = identity?.fullName
    ? ["Best,", identity.fullName, identity.linkedinUrl]
        .filter(Boolean)
        .join("\n")
    : "";
  const unsigned =
    signature && body.endsWith(`\n\n${signature}`)
      ? body.slice(0, -signature.length).trim()
      : body;
  const withoutFacts = remove(
    unsigned,
    sample.claims.map((c) => normalizeClaimText(c.text)),
  );
  let optionalFraming = withoutFacts;
  for (const phrase of [...REQUIRED_FRAMING].sort(
    (a, b) => b.length - a.length,
  ))
    optionalFraming = optionalFraming.replace(phrase, " ");
  const optionalFramingWords = countOutputUnits(optionalFraming, "words");
  const explanationLimit = application
    ? 15
    : sample.category === "linkedin_connection"
      ? 12
      : 20;
  const explanationPass =
    optionalFramingWords <= explanationLimit &&
    (bodyWords <= 20 || optionalFramingWords / bodyWords <= 0.25);
  const duplicateFactCount = [...new Set(verified.map((c) => c.text))].reduce(
    (sum, text) => sum + Math.max(0, occurrences(body, text) - 1),
    0,
  );
  const invitations = CTAS.flatMap((cta, index) =>
    Array.from({ length: occurrences(withoutFacts, cta) }, () => ({
      cta,
      index,
    })),
  );
  const finalAsk = unsigned.replace(/\s+Thank you\.$/u, "");
  const ctaPass = application
    ? invitations.length === 0
    : invitations.length === 1 && finalAsk.endsWith(invitations[0]!.cta);
  const greeting = /^(?:Hi there,|Hello,)\s/u.test(body);
  const greetingCount =
    occurrences(withoutFacts, "Hi there,") +
    occurrences(withoutFacts, "Hello,");
  const proofLabelCount = occurrences(
    withoutFacts,
    "A quick look at my background:",
  );
  const paragraphs = body.split(/\n\s*\n/u).filter(Boolean).length;
  const applicationFormat =
    !application ||
    accepts(() => {
      validateYcApplicationOutput({
        context: {
          question: "Synthetic evaluation question",
          jobDescription: "",
          sources: [],
          atomicSources: sample.sources,
          excludedClaims: sample.excludedClaims,
          readiness: { ready: true, missingFields: [], recommendedFields: [] },
          metadata: {
            profileFieldCount: 0,
            confirmedEvidenceCount: 0,
            resumeSource: "none",
          },
        },
        output: {
          body,
          claims: sample.claims.map((claim) => ({
            ...claim,
            sourceIds: [claim.source_id],
          })),
        },
      });
    });
  const formatPass =
    applicationFormat &&
    accepts(() => validate(true)) &&
    (application
      ? greetingCount === 0 && sample.subject === undefined
      : greeting && greetingCount === 1) &&
    proofLabelCount <= 1 &&
    (sample.category === "linkedin_connection" ||
      application ||
      paragraphs >= 2) &&
    (!(
      sample.category === "cold_email" || sample.category === "linkedin_inmail"
    ) ||
      Boolean(sample.subject));
  const checks: Record<DiscourseDimension, boolean> = {
    factual_coverage: factualCoverage,
    target_specificity: !sample.targetRequired || targetReferenceCount > 0,
    explanation_budget: explanationPass,
    repetition: duplicateFactCount === 0,
    cta: ctaPass,
    channel_format: formatPass,
  };
  const ordered = [...verified].sort((a, b) => a.start - b.start);
  const first = ordered[0];
  return {
    id: sample.id,
    category: sample.category,
    emailMode: sample.emailMode,
    violations: DISCOURSE_DIMENSIONS.filter((d) => !checks[d]),
    factualCoverage,
    unsupportedAssertionCount: invalidClaims || (!factualCoverage ? null : 0),
    declaredClaimCount: sample.claims.length,
    validDeclaredClaims,
    targetReferenceCount,
    candidateReferenceCount: verified.filter(
      (c) => c.source.scope === "candidate",
    ).length,
    optionalFramingWords,
    bodyWords,
    duplicateFactCount,
    ctaCount: invitations.length,
    opening: first ? `${first.source.scope}.${first.source.kind}` : "none",
    ctaTemplate: invitations.length === 1 ? invitations[0]!.index : null,
    pattern:
      ordered.map((c) => `${c.source.scope}.${c.source.kind}`).join(">") ||
      "neutral_only",
    diversityEligible:
      factualCoverage &&
      bodyWords > 90 &&
      verified.some((c) => c.source.scope === "candidate"),
  };
}
