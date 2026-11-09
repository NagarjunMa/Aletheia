import { z } from "zod";

export const CLAIM_KINDS = [
  "role",
  "company",
  "technology",
  "action",
  "outcome",
  "metric",
  "preference",
  "target_observation",
  "cta_rationale",
] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];
export type ClaimScope = "candidate" | "target";

// Raw limits precede normalization. Aggregate work is bounded as well as each
// value; these are safety ceilings, not a promise that a model fills every cap.
export const MAX_ATOMIC_CLAIMS = 12;
export const MAX_CLAIM_TEXT = 700;
export const MAX_SUPPORTING_EXCERPT = 600;
export const MAX_LEDGER_CHARS = 6_000;
const bounded = (max: number) => z.string().max(max).trim().min(1);
export const atomicClaimSchema = z
  .object({
    text: bounded(MAX_CLAIM_TEXT),
    kind: z.enum(CLAIM_KINDS),
    source_id: bounded(200),
    supporting_excerpt: bounded(MAX_SUPPORTING_EXCERPT),
  })
  .strict();
export const atomicClaimsSchema = z
  .array(atomicClaimSchema)
  .max(MAX_ATOMIC_CLAIMS)
  .refine(
    (claims) =>
      claims.reduce(
        (sum, claim) =>
          sum +
          claim.text.length +
          claim.supporting_excerpt.length +
          claim.source_id.length,
        0,
      ) <= MAX_LEDGER_CHARS,
    "Claim ledger exceeds its aggregate limit",
  );
export type AtomicClaim = z.infer<typeof atomicClaimSchema>;

export const ATOMIC_SOURCE_REWRITES = [
  "current_role",
  "linkedin_profile_interest",
  "linkedin_job_interest",
  "linkedin_profile_topic",
  "linkedin_job_topic",
] as const;

/** Private, server-built complete fact unit. Never accept this from a model. */
export type AtomicSource = {
  id: string;
  /** Original selected source, used for per-question eligibility. */
  rootId?: string;
  scope: ClaimScope;
  kind: ClaimKind;
  content: string;
  /** Server-assigned wording policy; never accepted from model input. */
  rewrite?: (typeof ATOMIC_SOURCE_REWRITES)[number];
};

export const atomicClaimsToolSchema = {
  type: "array",
  maxItems: MAX_ATOMIC_CLAIMS,
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string", minLength: 1, maxLength: MAX_CLAIM_TEXT },
      kind: { type: "string", enum: CLAIM_KINDS },
      source_id: { type: "string", minLength: 1, maxLength: 200 },
      supporting_excerpt: {
        type: "string",
        minLength: 1,
        maxLength: MAX_SUPPORTING_EXCERPT,
      },
    },
    required: ["text", "kind", "source_id", "supporting_excerpt"],
  },
} as const;

export const APPLICATION_ANSWER_COURTESY =
  "Thank you for considering my application.";

/** Whole phrases only. Never strip arbitrary "non-factual" words from text. */
export const NEUTRAL_FRAMING = [
  "Open to connecting?",
  "Would you be open to a brief conversation?",
  "Open to a brief chat?",
  "Would you be open to a brief chat?",
  "Would you be open to discussing the role?",
  "May I ask you a question?",
  "I'd welcome a conversation.",
  APPLICATION_ANSWER_COURTESY,
  "Professional introduction",
  "A brief introduction",
  "Following up",
  "Hi there,",
  "Hello,",
  "Best,",
  "Thanks,",
  "Thank you.",
  "A quick look at my background:",
] as const;

/** Inner whitespace can be part of a literal value; only encoding and outer trim are equivalent. */
export function normalizeClaimText(value: string): string {
  return value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim();
}

/** Recognize an explicit actor without expanding contractions or changing the source. */
export function isFirstPersonAssertion(value: string): boolean {
  return /^I(?:\s|['’](?:m|ve|d|ll)\s)/u.test(normalizeClaimText(value));
}

// Only named fields may move out of a headline suffix; free text can qualify
// the role (for example, "Retired since 2020") and must remain in place.
const LINKEDIN_SPECIALTIES = new Set([
  "Applied AI",
  "Artificial Intelligence",
  "Machine Learning",
  "Data Platform",
  "Data Science",
  "Software Engineering",
  "Infrastructure",
  "Reliability",
  "Developer Tools",
  "AI Evaluation",
  "AI Observability",
]);
const QUALIFIED_PROFILE =
  /\b(?:not|no|never|former|formerly|previously|ex|aspiring|seeking|hiring|until|only|unless|except|without|simulation)\b/iu;

function linkedinProfileHeadline(value: string) {
  const headline =
    /^(Engineering Manager|Software Engineer|Applied AI Engineer|Research Engineer|Research Scientist|Product Manager|Data Scientist|Director of Engineering|Head of Engineering) at ([\p{L}\p{N}][\p{L}\p{N} &+/-]{0,79}) \| ([\p{L}\p{N}][\p{L}\p{N} &+/-]{0,79})$/u.exec(
      value,
    );
  if (!headline || QUALIFIED_PROFILE.test(value)) return undefined;
  const topics = headline[3]!.split(" & ");
  return topics.every((part) => LINKEDIN_SPECIALTIES.has(part))
    ? {
        role: headline[1]!,
        organization: headline[2]!,
        specialty: headline[3]!,
        topics,
      }
    : undefined;
}

export function linkedinProfileHeadlineTopics(
  value: string,
): readonly string[] {
  return linkedinProfileHeadline(value.replace(/\s+/gu, " "))?.topics ?? [];
}

const DISCUSSION_TOPIC =
  "(ai(?: refund| customer support| support)? agents?|intelligent agents?|ai evaluation|ai observability|machine learning|ml|applied ai|data engineering|data platform|site reliability|security engineering|distributed systems|developer tools|parser tools|product design)";
const TEAM_TOPIC = new RegExp(
  `^The ${DISCUSSION_TOPIC} team at [\\p{L}\\p{N} &+/-]+ is hiring `,
  "iu",
);
const TOPIC_MODIFIERS = "(?:[\\p{L}]+,? ){0,3}?";
const WORK_TOPIC = new RegExp(
  `(?:(?:^(?:I|we|our team|the team) |, where (?:I|we) )(?:builds?|develops?|designs?|specializ(?:e|es) in)|^(?:I am|we are|(?:our|the) team is|I['’]m|we['’]re) (?:building|developing|designing)|^(?:the|this) role focuses on|^build) ${TOPIC_MODIFIERS}${DISCUSSION_TOPIC}\\b`,
  "iu",
);
const RESPONSIBILITY_TOPIC = new RegExp(
  `^you(?: will|['’]ll) (?:build|develop|design) ${TOPIC_MODIFIERS}${DISCUSSION_TOPIC}\\b`,
  "iu",
);
const HEADLINE_TOPIC = new RegExp(` \\| PhD in ${DISCUSSION_TOPIC}\\b`, "iu");
const ABSENT_TOPIC = new RegExp(
  `\\b(?:without|zero|0)\\s+(?:[\\p{L}]+\\s+){0,6}?${DISCUSSION_TOPIC}\\b`,
  "iu",
);
const DISCUSSION_MENTION = new RegExp(`\\b${DISCUSSION_TOPIC}\\b`, "iu");
const DISCUSSION_MENTIONS = new RegExp(DISCUSSION_MENTION.source, "giu");
const NON_AFFIRMATIVE_TOPIC =
  /\b(?:no|not|never|non|nothing|neither|nor|former|formerly|previously|only|unless|except|exclud(?:e|es|ed|ing)|besides|apart\s+from|retired|instead\s+of|other\s+than|rather\s+than|alternatives?\s+to|stopped|ceased|discontinued|hypothetical|if|but)\b|n['’]t\b/iu;
const HIRING_RETRACTION =
  /\b(?:hypothetical|(?:not|no longer|stopped|ceased|(?:is|are|was|were)n['’]t) (?:currently |actively )?(?:hiring|accepting (?:new )?applications(?=\s*(?:[.!?]|$)| for (?:this|the) (?:role|position|opening|vacancy|job))))\b/iu;
const CLOSED_OPENING =
  /\b(?:opening|role|position|vacancy|posting|requisition) (?:(?:has been|had been|is(?: now)?|was) (?:filled|closed|withdrawn|cancelled|canceled|no longer (?:open|available))|(?:filled|closed|withdrawn|cancelled|canceled)(?=[.!?]|$))\b/iu;
const CLOSED_APPLICATIONS =
  /\bapplications (?:for (?:this|the) (?:role|position|opening|vacancy|job) )?(?:(?:are|were)(?: now)?|have been) closed\b/iu;
const PROFILE_RETRACTION =
  /\b(?:no longer|stopped|ceased|discontinued|ended(?= [^.!?]{0,100}\b(?:work|project|program|effort)\b)|(?:never|not|(?:do|does|did|is|are|was|were|wo)n['’]t) (?:currently |actively )?(?:be )?(?:build(?:ing)?|develop(?:ing)?|design(?:ing)?|work(?:ing)? (?:on|with)|us(?:e|ing)|specializ(?:e|ing) in|focus(?:ing)? on|do(?:ing)?))\b/iu;
const JD_LOGISTICS = /^no (?:relocation|travel) is required[.!]?$/iu;
const EXPERIENCE_TOPIC = String.raw`(?:${TOPIC_MODIFIERS}${DISCUSSION_TOPIC}|ai-agents?|[\p{L}\p{N}+#/-]+)`;
const EXPERIENCE_SUBJECT = `(?:(?:prior|previous|professional|practical|direct|hands[- ]on) )*(?:${EXPERIENCE_TOPIC} )?experience(?: (?:with|in|using|building) ${EXPERIENCE_TOPIC})?`;
const OPTIONAL_EXPERIENCE = new RegExp(
  `^(?:no ${EXPERIENCE_SUBJECT} (?:is )?required|${EXPERIENCE_SUBJECT} (?:(?:is not|isn['’]t|is preferred(?:,? but|,) not) (?:required|needed|necessary|mandatory)|is optional|is (?:a plus|nice to have)(?:,? but|,) not (?:a requirement|required)))[.!]?$`,
  "iu",
);
const JD_BULLET = "[ \\t]*(?:[-+*•◦●○▪‣–—]|\\d{1,3}[.)])[ \\t]+";
const JD_BULLET_START = new RegExp(`^${JD_BULLET}`, "u");
const JD_BULLET_BREAK = new RegExp(`\\n(?=${JD_BULLET})`, "u");
const sentences = new Intl.Segmenter("en", { granularity: "sentence" });

function retractsHiring(value: string) {
  const text = value.replace(/\s+/gu, " ");
  return (
    HIRING_RETRACTION.test(text) ||
    CLOSED_OPENING.test(text) ||
    CLOSED_APPLICATIONS.test(text)
  );
}

function linkedinPassages(value: string, jobDescription: boolean) {
  const blocks = jobDescription ? value.split(JD_BULLET_BREAK) : [value];
  return blocks.flatMap((block) => {
    const marker = jobDescription
      ? (JD_BULLET_START.exec(block)?.[0] ?? "")
      : "";
    return Array.from(
      sentences.segment(block.slice(marker.length)),
      ({ segment, index }) => {
        const text = segment.trim().replace(/\s+/gu, " ");
        const boundary = jobDescription
          ? Math.max(
              text.lastIndexOf(";"),
              text.lastIndexOf("—"),
              text.lastIndexOf("–"),
            )
          : -1;
        const suffix = text.slice(boundary + 1).trim();
        // Only complete independent requirements can be ignored for matching.
        const matchingText =
          boundary >= 0 &&
          (JD_LOGISTICS.test(suffix) || OPTIONAL_EXPERIENCE.test(suffix))
            ? text.slice(0, boundary).trimEnd()
            : text;
        return {
          content: `${index === 0 ? marker : ""}${segment}`.trim(),
          text: matchingText,
        };
      },
    );
  });
}

function hasNegatedJobTopic(passages: readonly { text: string }[]) {
  return passages.some(
    ({ text }) =>
      !OPTIONAL_EXPERIENCE.test(text) &&
      (ABSENT_TOPIC.test(text) ||
        (NON_AFFIRMATIVE_TOPIC.test(text) && DISCUSSION_MENTION.test(text))),
  );
}

/** Check the whole pasted JD before projecting independently usable paragraphs. */
export function linkedinJobHasRetraction(paragraphs: readonly string[]) {
  return paragraphs.some(
    (paragraph) =>
      retractsHiring(paragraph) ||
      hasNegatedJobTopic(linkedinPassages(paragraph, true)),
  );
}

export function linkedinProfileRetractedTopics(paragraphs: readonly string[]) {
  const retracted = new Set<string>();
  let previous = "";
  for (const paragraph of paragraphs) {
    for (const { text } of linkedinPassages(paragraph, false)) {
      const clauses = text.split(
        /[;,:]|\b(?:but|whereas|however|and (?=(?:i|we|our team|the team)\b))/iu,
      );
      for (const clause of clauses) {
        if (!PROFILE_RETRACTION.test(clause)) continue;
        const topics = Array.from(
          clause.matchAll(DISCUSSION_MENTIONS),
          (match) => match[0],
        );
        if (
          !topics.length &&
          /\b(?:it|them|(?:this|that) (?:work|project))(?: (?:anymore|as of [^.!?]+))?\s*[.!?]?$/iu.test(
            clause,
          )
        ) {
          const priorTopic = linkedinDiscussionTopic(previous);
          const priorTopics = priorTopic
            ? [priorTopic]
            : linkedinProfileHeadlineTopics(previous);
          if (priorTopics.length === 1) topics.push(priorTopics[0]!);
        }
        for (const topic of topics)
          retracted.add(normalizeLinkedinTopic(topic));
      }
      previous = text;
    }
  }
  return retracted;
}

function normalizeLinkedinTopic(topic: string) {
  return topic
    .toLowerCase()
    .replace(/^intelligent agents?$/u, "ai agent")
    .replace(/ agents$/u, " agent");
}

export function linkedinProfileTopicIsRetracted(
  topic: string,
  retracted: ReadonlySet<string>,
): boolean {
  const normalized = normalizeLinkedinTopic(topic);
  return (
    retracted.has(normalized) ||
    (retracted.has("ai agent") &&
      /^ai (?:refund|customer support|support) agent$/u.test(normalized))
  );
}

/** Use affirmative work passages for interest only, never to assert an affiliation. */
export function linkedinDiscussionPassages(
  value: string,
  jobDescription = false,
) {
  if (
    /[<>"“”]|&(?:lt|gt);/u.test(value) ||
    retractsHiring(value) ||
    (!jobDescription &&
      (NON_AFFIRMATIVE_TOPIC.test(value) ||
        ABSENT_TOPIC.test(value) ||
        /\bwithout\b/iu.test(value)))
  )
    return [];
  const passages = linkedinPassages(value, jobDescription);
  // Unrelated JD requirements can sit beside a responsibility in the same block.
  if (jobDescription && hasNegatedJobTopic(passages)) return [];
  return passages.flatMap(({ content, text }) => {
    if (text.endsWith("?") || NON_AFFIRMATIVE_TOPIC.test(text)) return [];
    const topic =
      WORK_TOPIC.exec(text)?.[1] ??
      (jobDescription ? RESPONSIBILITY_TOPIC.exec(text)?.[1] : undefined) ??
      TEAM_TOPIC.exec(text)?.[1] ??
      HEADLINE_TOPIC.exec(text)?.[1];
    return topic ? [{ content, topic }] : [];
  });
}

export function linkedinDiscussionTopic(
  value: string,
  jobDescription = false,
): string | undefined {
  return linkedinDiscussionPassages(value, jobDescription)[0]?.topic;
}

/** Finite source-owned rewrites, shared by prompt examples and validation. */
export function allowedClaimTexts(source: AtomicSource): string[] {
  const excerpt = normalizeClaimText(source.content);
  const quoted =
    source.scope === "target"
      ? `The supplied context says: "${excerpt}"`
      : `My background includes: "${excerpt}"`;
  const forms = [quoted];
  // Already explicit first-person candidate assertions need no actor inference.
  if (source.scope === "candidate" && isFirstPersonAssertion(excerpt))
    forms.push(excerpt);
  if (
    source.scope === "candidate" &&
    source.kind === "role" &&
    source.rewrite === "current_role"
  ) {
    forms.push(`My current role is ${excerpt}.`);
  }
  if (source.scope === "target" && source.kind === "target_observation") {
    if (
      source.rewrite === "linkedin_profile_topic" ||
      source.rewrite === "linkedin_job_topic"
    )
      return [
        linkedinTopicInterest(
          excerpt,
          source.rewrite === "linkedin_job_topic",
        ) ?? quoted,
      ];
    // Only the closed named-field grammar may treat line wrapping as formatting.
    // Unknown/quoted literal context still uses the complete exact excerpt.
    const structuredExcerpt = excerpt.replace(/\s+/gu, " ");
    if (source.rewrite === "linkedin_profile_interest") {
      // A complete headline can change grammar without claiming the specialty
      // belongs to the role. Ambiguous/qualified narratives keep the full quote.
      const headline = linkedinProfileHeadline(structuredExcerpt);
      const roleOnly =
        /^((?:(?:Senior|Staff|Principal|Lead|Junior) )?(?:(?:Software|Backend|Frontend|Platform|Infrastructure|Security|Data|Applied AI|Machine Learning|Research|Product|Engineering|UX) )?(?:Engineer|Developer|Scientist|Designer|Manager|Director|Founder|Co-Founder|Lead)) at ([\p{L}\p{N}][\p{L}\p{N} &+./'-]{0,79})$/u.exec(
          structuredExcerpt,
        );
      return [
        headline
          ? `I'm interested in ${headline.specialty} and your ${headline.role} role at ${headline.organization}.`
          : roleOnly && !QUALIFIED_PROFILE.test(structuredExcerpt)
            ? `I'm interested in your ${roleOnly[1]} role at ${roleOnly[2]}.`
            : (linkedinTopicInterest(excerpt) ??
              `I'd like to connect about your profile: "${excerpt}"`),
      ];
    }
    if (source.rewrite === "linkedin_job_interest") {
      // Only this complete positive hiring grammar permits rearranging the roles.
      // Qualifications, negation and additional sentences retain the whole quote.
      const hiring =
        /^(The [\p{L}\p{N}&+/-]+(?: [\p{L}\p{N}&+/-]+){0,9} team at [\p{L}\p{N}&+/-]+(?: [\p{L}\p{N}&+/-]+){0,5}) is hiring ((?:[A-Z][\p{L}\p{N}+#/-]* ){0,6}(?:Engineers|Developers|Designers|Researchers))[.!]?$/u.exec(
          structuredExcerpt,
        );
      return [
        hiring
          ? `I'm interested in the openings for ${hiring[2]} with ${hiring[1]!.replace(/^The /u, "the ")}.`
          : (linkedinTopicInterest(excerpt, true) ??
            `I'd like to connect about this context: "${excerpt}"`),
      ];
    }
  }
  return forms;
}

function linkedinTopicInterest(
  excerpt: string,
  jobDescription = false,
): string | undefined {
  const topic = linkedinDiscussionTopic(excerpt, jobDescription);
  return topic ? `I'm interested in discussing ${topic}.` : undefined;
}
