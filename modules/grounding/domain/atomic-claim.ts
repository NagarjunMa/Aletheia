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
export function isLinkedinCredentialTopic(value: string): boolean {
  const text = value.replace(/\s+/gu, " ");
  return HEADLINE_TOPIC.test(text) && !WORK_TOPIC.test(text);
}

const ROLE_MODIFIER =
  "(?:senior|staff|principal|lead|junior|founding|full[- ]stack|front[- ]?end|back[- ]?end|software|platform|data|product|security|infrastructure|systems?|site reliability|developer tools|machine learning|applied ai|ai|ml|research|ux)";
const COFOUNDER = String.raw`co[\p{Pd} ]?founders?`;
const FUNDING_CONDITION =
  /\b(?:(?:pending|awaiting) (?:funding|approval)|(?:contingent on|subject to|depends? on) (?:[\p{L}]+ ){0,3}(?:funding|financing|approval)|(?:if|unless|until|once|when|after) (?:(?:we|i|the (?:company|team))(?: (?:can|have) |['’]ve | )(?:secure(?:d)?|rais(?:e|ed)|obtain(?:ed)?|receiv(?:e|ed)|get|got|have) (?:[\p{L}]+ ){0,3}(?:funding|approval)|(?:(?:the|our|additional) )?(?:funding|financing|approval|(?:hiring )?budget) (?:comes through|(?:is|has been|can be) (?:approved|secured|confirmed|received|granted))))\b/iu;
const COFOUNDER_SEARCH = new RegExp(
  String.raw`\b(?:hiring|looking for|seeking)\b[^.!?]{0,95}\b${COFOUNDER}\b`,
  "iu",
);
const COFOUNDER_FOUND = new RegExp(
  String.raw`^(?:(?:update|correction):\s*)?(?:we|i)(?:['’]ve| have)? (?:already )?(?:found|selected) (?:a|an|our|my|the) (?:[\p{L}\p{Pd}]+ ){0,3}${COFOUNDER}(?: today| yesterday| last week)?[.!]?$`,
  "iu",
);
const COFOUNDER_TITLE = new RegExp(String.raw`\b${COFOUNDER}$`, "iu");
const OPENING = String.raw`(?:openings?|roles?|positions?|jobs?|vacanc(?:y|ies)|postings?|requisitions?|search)`;
const CLOSED_STATE = String.raw`(?:filled|closed|withdrawn|cancelled|canceled)`;
const HIRING_ACTIVITY = String.raw`(?:hiring|recruiting|recruitment|applications)`;
const HIRING_CONDITION_PREFIX =
  /^(?:(?:update|correction):\s*)?(?:(?:we|i)(?: will|['’]ll) (?:move forward|proceed|go ahead) )?(?:only )?$/iu;
const CONDITIONAL_HIRING = new RegExp(
  String.raw`\b(?:${OPENING}|${HIRING_ACTIVITY}) (?:(?:is|are|remain|remains) )?(?:contingent on|subject to|depends? on)\b`,
  "iu",
);
const STATUS_ADVERB = String.raw`(?:already|currently|now|still|temporarily)`;
const STATUS_NEGATION = String.raw`(?:not|no longer)(?: ${STATUS_ADVERB})?`;
const NEGATED_COPULA = String.raw`(?:is|are|was|were)n['’]t(?: ${STATUS_ADVERB})?`;
const OPEN_STATE = "(?:open|available)";
const UNAVAILABLE_STATE = String.raw`(?:${CLOSED_STATE}|paused|frozen|suspended|(?:(?:put|placed) )?on (?:hold|pause)|${STATUS_NEGATION} ${OPEN_STATE})`;
const STATUS_VERB = String.raw`(?:(?:has|have|had) (?:(?:${STATUS_ADVERB}|since) )?been|is|are|was|were|remain(?:s|ed)?)(?: ${STATUS_ADVERB})?`;
const OPENING_REFERENCE = String.raw`(?:(?:(?:this|the|these|those|both|either|all) |(?:both|either|all) of (?:the|these|those) )${OPENING})`;
const HIRING_MODAL = String.raw`(?:(?:will|would|can|could|may) |won['’]t )(?:only |not |then )?`;
const OPENING_START = String.raw`(?:reopens?|opens?|starts?|begins?|resumes?|proceeds?|go(?:es)? ahead|(?:be )?(?:open|available)|be (?:accepted|posted|filled))`;
const CONDITIONAL_OPENING = new RegExp(
  String.raw`^(?<subject>.+?) (?:${HIRING_MODAL})?${OPENING_START}(?: for (?<object>[^.!?]+))?\b`,
  "iu",
);
const HIRING_ACTOR = String.raw`(?:we|i|they|the (?:team|company))`;
const CONDITIONAL_RECRUITMENT = new RegExp(
  String.raw`^(?:(?:${HIRING_ACTOR})(?: ${HIRING_MODAL}|['’]ll (?:only |not |then )?))?(?:open|reopen|accept|take|start|resume|begin|fill|post|hire|recruit|(?:be )?(?:hiring|recruiting))(?: (?<target>[^.!?]+))?[.!?]?$|^(?:${HIRING_ACTOR}(?: (?:are|am|is) |['’](?:re|m|s) ))?(?:only )?(?:hiring|recruiting|looking for|seeking)(?: (?<progressiveTarget>[^.!?]+))?[.!?]?$`,
  "iu",
);
const ROLE_REFERENCE = new RegExp(
  String.raw`^(?:${OPENING_REFERENCE}|${OPENING}|this|(?:this|the) (?:post|list)|(?:any|each|every) ${OPENING}|(?:the |our )?(?:${HIRING_ACTIVITY}|job applications)|(?:all|any|both|each|either|neither|none|one|some)(?: of (?:them|these|those))?)$`,
  "iu",
);
const GENERIC_ROLE_MODIFIER = new RegExp(
  String.raw`^((?:(?:the|these|those|this|all|both|any|each|every) )?)(?:(?:currently|previously) )?(?:(?:advertised|listed|current|open|actual|live|remaining) ){1,2}(?=${OPENING}\b)`,
  "iu",
);
const ROLE_ACTIVITY_TARGET = new RegExp(
  String.raw`^(?:(?:the |our )?${HIRING_ACTIVITY}|(?:the )?${OPENING})(?: ${STATUS_ADVERB})? for (.+)$`,
  "iu",
);
const NAMED_ROLE_SUFFIX = new RegExp(
  String.raw` (?:${OPENING}|${HIRING_ACTIVITY})$`,
  "iu",
);
const DEPENDENT_OPENING = new RegExp(
  String.raw`^(?<target>.+?) (?:(?:is|are|remain|remains) )?(?:contingent on|depends? on|subject to (?=(?:budget |headcount )?(?:funding|financing|approval)\b))\b`,
  "iu",
);
const APPLICATION_INTAKE = String.raw`(?:accepting|taking) (?:(?:new|any(?: more)?|more|further|additional) )?applications`;
const PASSIVE_APPLICATION_INTAKE = String.raw`(?:being (?:${STATUS_ADVERB} )?)?accepted`;
const CLOSED_APPLICATION_STATE = String.raw`${STATUS_NEGATION} (?:${PASSIVE_APPLICATION_INTAKE}|${APPLICATION_INTAKE})`;
const LIVE_OPENING_STATE = "(?:an? )?(?:actual|real|live)";
const CONTRACTED_CLOSURE = String.raw`${NEGATED_COPULA} (?:${OPEN_STATE}|${PASSIVE_APPLICATION_INTAKE}|${APPLICATION_INTAKE}|${LIVE_OPENING_STATE})`;
const UNCONFIRMED_ROLE_STATE = String.raw`(?:(?:only|just) )?(?:(?:an? )?(?:hypothetical|fictional)|(?:only|just) (?:examples|illustrations)|${STATUS_NEGATION} ${LIVE_OPENING_STATE})`;
const WAITING_FOR_FUNDING = String.raw`(?:pending|awaiting|waiting (?:for|on)) (?:funding|financing|approval|(?:hiring )?budget approval)`;
const ENDED_HIRING = "(?:halted|stopped|ended|closed)";
const SCOPED_ROLE_STATE = String.raw`(?:${UNAVAILABLE_STATE}|${CLOSED_APPLICATION_STATE}|${UNCONFIRMED_ROLE_STATE}|${WAITING_FOR_FUNDING}|${ENDED_HIRING})`;
const SCOPED_CLOSURE = new RegExp(
  String.raw`^(?<target>.+?) (?:(?:${STATUS_VERB}|(?:will|would|shall) (?:still )?(?:be|remain|stay)(?: ${STATUS_ADVERB})?) ${SCOPED_ROLE_STATE}\b|${CONTRACTED_CLOSURE}\b|(?:has|have|had)(?: ${STATUS_ADVERB})? ${ENDED_HIRING}\b|${CLOSED_STATE}(?=[.!?]|$))`,
  "iu",
);
const SIMULATED_HIRING_POST =
  /^(?:(?:this|it)(?: (?:post|posting|list))? (?:is|was) (?:(?:only|just) )?(?:for )?an? )?(?:training simulation|simulation for training)[.!?]?$/iu;
const NEGATED_OPENING_SUBJECT = new RegExp(
  String.raw`^(?<target>(?:neither|none|no)(?: .+?)?) (?:is|are|was|were|remain|remains) (?:${STATUS_ADVERB} )?(?:open|available|${APPLICATION_INTAKE})\b`,
  "iu",
);
const NO_OPENING_STATEMENT =
  /^(?:there (?:is|are|was|were)(?: currently| now)? )?no (?<target>[^.!?]+)[.!?]?$/iu;
const HIRING_STOP_ACTION = "(?:paused|suspended|halted|stopped|froze)";
const ACTIVE_STATUS_ACTOR = String.raw`(?:(?:${HIRING_ACTOR}|our (?:team|company))(?:['’](?:ve|s)| (?:have|has))? )?`;
const SCOPED_ACTIVE_STOP = new RegExp(
  String.raw`^${ACTIVE_STATUS_ACTOR}(?:${STATUS_ADVERB} )?(?:(?:${HIRING_STOP_ACTION}|${CLOSED_STATE}) (?<target>[^.!?]+)|put (?<onHold>.+?) (?:${STATUS_ADVERB} )?on (?:hold|pause))`,
  "iu",
);
const SCOPED_NEGATED_HIRING = new RegExp(
  String.raw`^(?:(?:${HIRING_ACTOR}|our (?:team|company))(?:['’](?:re|m|s|ve) )?)?\s*(?:(?:(?:are|am|is|was|were|have) )?(?:${STATUS_ADVERB} )?(?:not|no longer)|(?:are|is|was|were|have)n['’]t|(?:(?:have|has|had) )?(?:${STATUS_ADVERB} )?(?:stopped|ceased)) (?:(?:${STATUS_ADVERB}|actively) )?(?:hiring|recruiting|looking for|seeking|accepting|taking|filling)(?: (?<target>[^.!?]+))?[.!?]?$`,
  "iu",
);
const SCOPED_STATUS_PATTERNS = [
  SCOPED_CLOSURE,
  NEGATED_OPENING_SUBJECT,
  NO_OPENING_STATEMENT,
  SCOPED_ACTIVE_STOP,
  SCOPED_NEGATED_HIRING,
];
const STATUS_DURATION = String.raw`(?:(?:right )?now|good|the (?:time being|moment|foreseeable future|(?:rest|remainder) of .+)|today|tonight|(?:this|next|the (?:next|coming)) (?:week|month|quarter|year)|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|a few|several) (?:hours?|days?|weeks?|months?|years?))`;
const BARE_STATUS_DURATION = new RegExp(`^${STATUS_DURATION}$`, "iu");
const TRAILING_STATUS_QUALIFIER = String.raw`(?:until|unless|once|when|if|after|pending|while|during|through|since|starting|effective|as of|at this time|at the moment|because|due to|owing to|for ${STATUS_DURATION})`;
const ROLE_STATUS_QUALIFIER = new RegExp(
  String.raw`,? ${TRAILING_STATUS_QUALIFIER}\b.*$`,
  "iu",
);
const TRAILING_ROLE_REFERENCE = /^ for ([^.!?]+)/iu;
const STOPPED_ACTIVITY_SCOPE = String.raw`(?=\s*(?:[.!?]|$)| (?:at this time|right now|currently)\b| for ${OPENING_REFERENCE}\b)`;
const HIRING_RETRACTION = new RegExp(
  String.raw`\b(?:hypothetical|(?:not|no longer|stopped|ceased|(?:is|are|was|were)n['’]t) (?:currently |actively )?(?:hiring|recruiting${STOPPED_ACTIVITY_SCOPE}|(?:accepting|taking) (?:(?:new|any(?: more)?|more|further|additional) )?applications${STOPPED_ACTIVITY_SCOPE}|filling ${OPENING_REFERENCE}))\b`,
  "iu",
);
const NEGATED_ROLE_SEARCH =
  /\b(?:(?:we are|we['’]re|i am|i['’]m) (?:not|no longer)|we aren['’]t|(?:we|i) (?:stopped|ceased)) (?:currently |actively )?(?:looking for|seeking) (.+)$/iu;
const CLOSED_OPENING = new RegExp(
  String.raw`\b${OPENING} (?:${STATUS_VERB} ${UNAVAILABLE_STATE}|${NEGATED_COPULA} ${OPEN_STATE}|${CLOSED_STATE}(?=[.!?]|$))\b`,
  "iu",
);
const STOPPED_HIRING_ACTIVITY = new RegExp(
  String.raw`\b${HIRING_ACTIVITY} (?:for ${OPENING_REFERENCE} )?(?:${STATUS_VERB} (?:${UNAVAILABLE_STATE}|${CLOSED_APPLICATION_STATE})|${CONTRACTED_CLOSURE})\b`,
  "iu",
);
const ACTIVE_HIRING_STOP = new RegExp(
  String.raw`^(?:(?:update|correction):\s*)?(?:(?:we|i|they|(?:the|our) (?:team|company))(?:['’](?:ve|s)| (?:have|has))? )?(?:${STATUS_ADVERB} )?(?:(?:paused|suspended|halted|stopped|froze) (?:our |the )?${HIRING_ACTIVITY}|put (?:${HIRING_ACTIVITY}|${OPENING_REFERENCE}) (?:${STATUS_ADVERB} )?on (?:hold|pause))\b`,
  "iu",
);
const UNCONFIRMED_OPENING = new RegExp(
  String.raw`\b(?:fictional (?:job|role|opening|posting|simulation)|training simulation|simulation for training|(?:${STATUS_NEGATION}|${NEGATED_COPULA}) ${LIVE_OPENING_STATE} (?:job|role|opening|posting)|(?:these|the) (?:roles|positions|openings) are (?:only|just) (?:examples|illustrations))\b`,
  "iu",
);
const UNBOUND_NO_OPENING =
  /\bthere (?:is|are) no(?: [\p{L}\p{N}+#/-]+){0,7} openings?\b/iu;
const UNBOUND_CONDITIONAL_OPENING =
  /\b(?:(?:position|role|opening) opens? only if|open (?:this|the) (?:position|role|opening) only if)\b/iu;
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

function openingTitle(value: string) {
  return value
    .trim()
    .replace(/^(?:the|an?|our|for)\s+/iu, "")
    .replace(NAMED_ROLE_SUFFIX, "")
    .replace(/\s*\([^()]*\)$/u, "")
    .replace(/(?<=\p{L})s$/iu, "")
    .toLowerCase();
}

function roleReferenceWithoutStatus(reference: string) {
  return reference.replace(ROLE_STATUS_QUALIFIER, "").trim();
}

function normalizeRoleReference(reference: string) {
  return roleReferenceWithoutStatus(reference)
    .replace(/^for\s+/iu, "")
    .replace(
      /^(?:all|any|both|each|either|neither|none|one|some|several) of (?=(?:the|these|those)\b)/iu,
      "",
    )
    .replace(/^(?:all|both) (?=(?:the|these|those)\b)/iu, "")
    .replace(/^(?:either|neither|no) /iu, "")
    .replace(
      /^(?:new|any(?: more)?|more|further|additional) (?=applications\b)/iu,
      "",
    )
    .replace(GENERIC_ROLE_MODIFIER, "$1")
    .replace(
      / (?:anymore|at this time|right now|currently|left|remaining|remain|remains)$/iu,
      "",
    )
    .replace(
      / (?:(?:listed|mentioned|advertised) )?(?:above|below|here|in (?:this|the) (?:post|posting|list))$/iu,
      "",
    );
}

function refersToAdvertisedRole(
  reference: string | undefined,
  advertisedRoles: readonly string[],
) {
  if (!reference) return true;
  const target = normalizeRoleReference(reference);
  const qualified = ROLE_ACTIVITY_TARGET.exec(target)?.[1];
  const subject = qualified ? normalizeRoleReference(qualified) : target;
  const matches = (name: string) =>
    ROLE_REFERENCE.test(name) || advertisedRoles.includes(openingTitle(name));

  return (
    matches(subject) ||
    subject
      .split(/\s*(?:,|\band\b|\bor\b|\bnor\b|(?<=\s)\/(?=\s))\s*/iu)
      .some(matches)
  );
}

function stripUpdateLabel(text: string) {
  return text.replace(/^(?:update|correction):\s*/iu, "");
}

function hiringFundingApplies(
  text: string,
  advertisedRoles: readonly string[],
): boolean | undefined {
  const update = stripUpdateLabel(text);
  const dependency = DEPENDENT_OPENING.exec(update);
  if (
    dependency &&
    refersToAdvertisedRole(dependency.groups?.target, advertisedRoles)
  )
    return true;

  const condition = FUNDING_CONDITION.exec(update);
  if (!condition) return dependency ? false : undefined;

  const before = update.slice(0, condition.index);
  const after = update.slice(condition.index + condition[0].length);
  const hiringClause = (before.trim() ? before : after)
    .replace(/^\s*,\s*/u, "")
    .replace(/(?:,? (?:but )?only|[,;])?\s*$/iu, "")
    .trim();
  const opening = CONDITIONAL_OPENING.exec(hiringClause);
  if (
    opening &&
    refersToAdvertisedRole(
      opening.groups?.object ?? opening.groups?.subject,
      advertisedRoles,
    )
  )
    return true;

  const recruitment = CONDITIONAL_RECRUITMENT.exec(hiringClause);
  if (
    (recruitment &&
      refersToAdvertisedRole(
        recruitment.groups?.target ?? recruitment.groups?.progressiveTarget,
        advertisedRoles,
      )) ||
    (!advertisedRoles.length &&
      (COFOUNDER_SEARCH.test(hiringClause) ||
        Boolean(linkedinHiringWording(hiringClause)))) ||
    (HIRING_CONDITION_PREFIX.test(before) && /^[.!]?$/u.test(after))
  )
    return true;

  return dependency || opening || recruitment ? false : undefined;
}

function hasHiringFundingCondition(passages: readonly { text: string }[]) {
  return passages.some(({ text }) => hiringFundingApplies(text, []) === true);
}

function advertisedRoleClosure(
  text: string,
  advertisedRoles: readonly string[],
): boolean | undefined {
  const update = stripUpdateLabel(text);
  if (SIMULATED_HIRING_POST.test(update)) return true;
  if (COFOUNDER_FOUND.test(update))
    return advertisedRoles.some((role) => COFOUNDER_TITLE.test(role));

  let foundStatus = false;
  for (const pattern of SCOPED_STATUS_PATTERNS) {
    const status = pattern.exec(update);
    if (!status) continue;
    foundStatus = true;

    let target = status.groups?.target ?? status.groups?.onHold;
    // A passive status may name the roles after the activity and state.
    if (
      pattern === SCOPED_CLOSURE &&
      target &&
      ROLE_REFERENCE.test(normalizeRoleReference(target))
    ) {
      const explicitTarget = TRAILING_ROLE_REFERENCE.exec(
        update.slice(status[0].length),
      )?.[1];
      if (
        explicitTarget &&
        !BARE_STATUS_DURATION.test(roleReferenceWithoutStatus(explicitTarget))
      )
        target = explicitTarget;
    }
    if (refersToAdvertisedRole(target, advertisedRoles)) return true;
  }
  return foundStatus ? false : undefined;
}

function retractsHiring(value: string) {
  const text = value.replace(/\s+/gu, " ");
  const passages = linkedinPassages(value, true);
  return (
    HIRING_RETRACTION.test(text) ||
    hasNegatedHiringSearch(value) ||
    (COFOUNDER_SEARCH.test(text) &&
      (hasHiringFundingCondition(passages) || CONDITIONAL_HIRING.test(text))) ||
    CLOSED_OPENING.test(text) ||
    STOPPED_HIRING_ACTIVITY.test(text) ||
    (/\b(?:paused|suspended|halted|stopped|froze|put)\b/iu.test(text) &&
      passages.some(({ text }) => ACTIVE_HIRING_STOP.test(text))) ||
    UNCONFIRMED_OPENING.test(text) ||
    UNBOUND_NO_OPENING.test(text) ||
    UNBOUND_CONDITIONAL_OPENING.test(text)
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
  const passages = paragraphs.flatMap((paragraph) =>
    linkedinPassages(paragraph, true),
  );
  const lists = paragraphs.flatMap(
    (paragraph) => linkedinHiringRoleList(paragraph) ?? [],
  );
  if (lists.some((list) => list.unavailable)) return true;
  const advertisedRoles = lists.flatMap(({ titles }) =>
    titles.map(openingTitle),
  );
  if (advertisedRoles.length) {
    // Preserve full clauses for trailing qualifiers and inspect independent updates too.
    const updates = passages.flatMap(({ text }) => {
      const parts = text.split(
        /\s*(?:[;—]|,?\s+\b(?:but|whereas)\s+|,?\s+and\s+(?=(?:we|they|the|these|those|both|neither)\b))/iu,
      );
      return parts.length === 1
        ? [{ text }]
        : [{ text }, ...parts.map((part) => ({ text: part.trim() }))];
    });
    return updates.some(({ text }) => {
      const closed = advertisedRoleClosure(text, advertisedRoles);
      const conditional = hiringFundingApplies(text, advertisedRoles);
      return (
        closed === true ||
        conditional === true ||
        (closed === undefined &&
          conditional === undefined &&
          hasNegatedJobTopic([{ text }]))
      );
    });
  }

  const context = paragraphs.join(" ").replace(/\s+/gu, " ");
  const unboundCondition =
    hasHiringFundingCondition(passages) || CONDITIONAL_HIRING.test(context);
  if (
    COFOUNDER_SEARCH.test(context) &&
    (unboundCondition ||
      paragraphs.some((paragraph) =>
        linkedinPassages(paragraph, true).some(({ text }) =>
          COFOUNDER_FOUND.test(text),
        ),
      ))
  )
    return true;

  if (
    unboundCondition &&
    paragraphs.some((paragraph) => linkedinHiringPassages(paragraph).length)
  )
    return true;

  return paragraphs.some(retractsHiring) || hasNegatedJobTopic(passages);
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

export function linkedinTargetHasContradiction(profile: string, jd: string) {
  const profileParagraphs = profile.split(/\n\s*\n/u);
  return (
    linkedinJobHasRetraction(linkedinJobParagraphs(jd)) ||
    retractsHiring(profile) ||
    linkedinProfileRetractedTopics(profileParagraphs).size > 0 ||
    profileParagraphs.some((paragraph) =>
      hasNegatedJobTopic(linkedinPassages(paragraph, false)),
    )
  );
}

const SIMPLE_HIRING_ROLE = new RegExp(
  `^(?:(?:we are|we['’]re) (?:hiring|looking for)|hiring:?) (?:an? )?((?:${ROLE_MODIFIER} ){0,6}(?:engineers?|developers?|designers?|researchers?))[.!]?$`,
  "iu",
);
const COFOUNDER_HIRING_ROLE = new RegExp(
  String.raw`^(?:(?:(?:we are|we['’]re|i am|i['’]m) )?(?:hiring|looking for|seeking):?) (?:an? )?((?:(?:technical|business|product|engineering|commercial|non-technical|full[- ]time|part[- ]time) ){0,3}${COFOUNDER})[.!]?$`,
  "iu",
);
const COFOUNDER_VALUES =
  /^(?:we|i) value (?:curiosity|ownership|collaboration|initiative|adaptability)(?:(?:, |,? and )(?:curiosity|ownership|collaboration|initiative|adaptability)){0,4}[.!]?$/iu;
const HIRING_LIST_BULLET = new RegExp(`\\n${JD_BULLET}`, "gu");
const HIRING_LIST_HEADER =
  /^(?:(?:we|they) are|(?:we|they)['’]re) hiring (?:across (?:multiple|several) roles|for (?:the following|multiple|several) (?:roles|positions))(?: \((?:junior|mid|senior)(?: [+/&] (?:junior|mid|senior))*\))?:/iu;
const HIRING_LIST = new RegExp(
  `${HIRING_LIST_HEADER.source}\\s*(.+)$`,
  HIRING_LIST_HEADER.flags,
);

export function linkedinJobParagraphs(value: string): string[] {
  const paragraphs: string[] = [];
  for (const paragraph of value.split(/\n\s*\n/u)) {
    const previous = paragraphs.at(-1);
    // Keep separated Markdown list items with their explicit hiring heading.
    if (
      previous &&
      JD_BULLET_START.test(paragraph) &&
      HIRING_LIST_HEADER.test(previous.replace(/\s+/gu, " ").trim())
    ) {
      paragraphs[paragraphs.length - 1] = `${previous}\n\n${paragraph}`;
    } else {
      paragraphs.push(paragraph);
    }
  }
  return paragraphs;
}

const UNAVAILABLE_ROLE_QUALIFIER = new RegExp(
  String.raw`^(?:hiring )?(?:${SCOPED_ROLE_STATE}|not yet open)(?: |$)`,
  "iu",
);
const LISTED_ROLE = new RegExp(
  String.raw`^(?:[\p{L}\p{N}+#&/'’\p{Pd}]+ ){0,8}(?:scientists?|engineers?|developers?|designers?|researchers?|architects?|managers?|executives?|analysts?|${COFOUNDER})(?: \([\p{L}\p{N} +&-]{1,35}\))?$`,
  "iu",
);

function linkedinHiringRoleList(content: string) {
  if (
    content.length > MAX_SUPPORTING_EXCERPT ||
    !/\b(?:roles|positions)\b/iu.test(content)
  )
    return undefined;

  for (const passage of [
    ...linkedinPassages(content, false).map(({ content }) => content),
    content,
  ]) {
    const list = HIRING_LIST.exec(
      passage.replace(HIRING_LIST_BULLET, ";").replace(/\s+/gu, " ").trim(),
    )?.[1];
    if (!list) continue;
    const roles = list
      .replace(/[.!]$/u, "")
      .split(/[,;]|\p{Extended_Pictographic}\uFE0F?|\s[•◦●○▪‣]\s*/u)
      .map((role) => role.trim())
      .filter(Boolean);
    const unavailable = roles.some((role) => {
      const qualifier = /\(([^()]*)\)$/u.exec(role)?.[1];
      return qualifier
        ?.split(/\s+[-+&]\s+/u)
        .some((part) => UNAVAILABLE_ROLE_QUALIFIER.test(part));
    });
    if (
      roles.length >= 2 &&
      roles.length <= 10 &&
      roles.every(
        (role) =>
          !/\b(?:no|not|neither|without|excluding|except|former|filled|closed|withdrawn)\b/iu.test(
            unavailable ? role.replace(/ \([^()]*\)$/u, "") : role,
          ) && LISTED_ROLE.test(role),
      )
    )
      return { passage, titles: roles, unavailable };
  }
  return undefined;
}

const HIRING_TRAIT =
  "(?:curious|pragmatic|collaborative|proactive|resourceful|adaptable|motivated)";
const HIRING_PREFERENCES = new RegExp(
  `^(?:we are|we['’]re) looking for (?:(${HIRING_TRAIT}(?:(?:,? and|,)? ${HIRING_TRAIT}){0,4}) )?(?:engineers?|developers?|designers?|researchers?|candidates?)( who take ownership(?: of their work)?(?: and enjoy solving ambiguous problems)?)?[.!]?$`,
  "iu",
);

export function linkedinHiringWording(content: string) {
  const text = content.replace(JD_BULLET_START, "").replace(/\s+/gu, " ");
  const roleList = linkedinHiringRoleList(content);
  if (roleList && !roleList.unavailable)
    return {
      kind: "list" as const,
      text: "I'm interested in the roles mentioned in the post.",
    };
  const cofounder = COFOUNDER_HIRING_ROLE.exec(text)?.[1];
  const role = cofounder ?? SIMPLE_HIRING_ROLE.exec(text)?.[1];
  if (role)
    return {
      kind: cofounder ? ("cofounder" as const) : ("role" as const),
      text: /s$/iu.test(role)
        ? `I'm interested in the openings for ${role}.`
        : `I'm interested in the ${role} opening.`,
    };

  const preferences = HIRING_PREFERENCES.exec(text);
  if (!preferences) return undefined;
  const adjectives = new Set(preferences[1]?.toLowerCase().match(/[a-z]+/gu));
  const themes = [
    adjectives.has("curious") && "curiosity",
    Boolean(preferences[2]) && "ownership",
    adjectives.has("collaborative") && "collaboration",
    adjectives.has("pragmatic") && "pragmatism",
    adjectives.has("proactive") && "initiative",
    adjectives.has("resourceful") && "resourcefulness",
    adjectives.has("adaptable") && "adaptability",
    adjectives.has("motivated") && "motivation",
  ].filter(Boolean);
  if (!themes.length) return undefined;
  return {
    kind: "preference" as const,
    text: `I'm interested in discussing ${themes.slice(0, 2).join(" and ")}.`,
  };
}

function hasNegatedHiringSearch(value: string): boolean {
  if (!/\b(?:looking for|seeking)\b/iu.test(value)) return false;
  return linkedinPassages(value, true).some(({ text }) => {
    const detail = NEGATED_ROLE_SEARCH.exec(text)?.[1];
    return Boolean(
      detail &&
      (linkedinHiringWording(`We are looking for ${detail}`) ||
        /^candidates[.!]?$/iu.test(detail)),
    );
  });
}

export function linkedinHiringPassages(value: string): string[] {
  const roleList = linkedinHiringRoleList(value);
  if (roleList) return roleList.unavailable ? [] : [roleList.passage];
  const passages = linkedinPassages(value, true).map(({ content }) => content);
  const hiring = passages.filter(linkedinHiringWording);
  if (!hiring.length || hiring.length === passages.length) return hiring;

  // An unrecognized sentence in the same paragraph can qualify a hiring claim.
  const independentWork = new Set(
    linkedinDiscussionPassages(value, true).map(({ content }) => content),
  );
  const cofounderOpening = hiring.some((passage) =>
    COFOUNDER_HIRING_ROLE.test(passage.replace(/\s+/gu, " ")),
  );
  return passages.every(
    (passage) =>
      hiring.includes(passage) ||
      independentWork.has(passage) ||
      (cofounderOpening &&
        COFOUNDER_VALUES.test(passage.replace(/\s+/gu, " "))),
  )
    ? hiring
    : [];
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
          : (linkedinHiringWording(excerpt)?.text ??
            linkedinTopicInterest(excerpt, true) ??
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
