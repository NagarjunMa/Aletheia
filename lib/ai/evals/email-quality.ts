import {
  EMAIL_MODE_WORD_LIMITS,
  type EmailMode,
} from "@/lib/ai/email-formatter";

export type EmailQualityRule =
  | "has_greeting_blank_line"
  | "has_2_to_5_paragraphs"
  | "not_wall_of_text"
  | "limited_hyphen_connectors"
  | "cta_is_capitalized"
  | "signature_on_own_line"
  | "word_count_within_mode_limit"
  | "has_structured_proof_points"
  | "preserves_period_tokens"
  | "no_orphan_fragments"
  | "has_specific_low_friction_ask"
  | "has_latest_experience_reference"
  | "has_concrete_ai_workflow_evidence"
  | "no_generic_ai_language"
  | "exploring_requires_confirmed_source"
  | "no_technology_inventory"
  | "no_orphan_technology_line"
  | "no_duplicate_candidate_claim"
  | "has_complete_or_omitted_signature";

export interface EmailQualityContext {
  /** Whether a selected candidate source explicitly supports exploratory AI work. */
  allowsExploring?: boolean;
}

export interface GoldenCandidateSource {
  id: string;
  kind: "evidence" | "profile" | "resume";
  label: string;
  content: string;
  priority: 1 | 2 | 3;
  /** Synthetic phrase that must be represented by the preferred output. */
  requiredPhrase: string;
}

export interface GoldenEmailGrounding {
  targetSummary: string;
  selectedSources: GoldenCandidateSource[];
}

export interface GoldenEmailCase {
  id: string;
  category: "cold_email" | "linkedin_inmail";
  emailMode: EmailMode;
  intent: "networking" | "referral" | "mentorship" | "job_inquiry";
  problemTags: string[];
  generated: string;
  preferred: string;
  expectedRules: EmailQualityRule[];
  qualityContext?: EmailQualityContext;
  grounding?: GoldenEmailGrounding;
}

export interface EmailQualityEvaluation {
  passed: boolean;
  score: number;
  totalRules: number;
  passedRules: EmailQualityRule[];
  violations: Array<{ rule: EmailQualityRule; message: string }>;
}

export function countEmailWords(body: string): number {
  const words = body
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b[\w.-]+\.[a-z]{2,}\/\S+/gi, "")
    .match(/\b[\w’'-]+\b/g);

  return words?.length ?? 0;
}

export function splitEmailParagraphs(body: string): string[] {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function fail(rule: EmailQualityRule, message: string) {
  return { passed: false as const, rule, message };
}

function pass(rule: EmailQualityRule) {
  return { passed: true as const, rule };
}

const TECHNOLOGY_TOKEN =
  /\b(?:AWS|GCP|Azure|Terraform|Docker|Kubernetes|Python|TypeScript|JavaScript|React|Node\.js|Next\.js|FastAPI|PostgreSQL)\b/gi;

function hasRepeatedCandidateSentence(body: string): boolean {
  const words = body
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((word) => !["the", "and", "that", "with", "your"].includes(word));
  if (!words || words.length < 10) {
    return false;
  }

  const phrases = Array.from({ length: words.length - 4 }, (_, index) =>
    words.slice(index, index + 5).join(" "),
  );
  return new Set(phrases).size !== phrases.length;
}

function checkRule(
  body: string,
  mode: EmailMode,
  rule: EmailQualityRule,
  context: EmailQualityContext,
) {
  const normalized = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const paragraphs = splitEmailParagraphs(normalized);

  switch (rule) {
    case "has_greeting_blank_line": {
      return /^Hi\s+[^,\n]+,\n\n/.test(normalized)
        ? pass(rule)
        : fail(rule, "Greeting must be followed by a blank line.");
    }

    case "has_2_to_5_paragraphs": {
      return paragraphs.length >= 2 && paragraphs.length <= 5
        ? pass(rule)
        : fail(rule, `Expected 2-5 paragraphs, got ${paragraphs.length}.`);
    }

    case "not_wall_of_text": {
      const longestParagraphWords = Math.max(
        0,
        ...paragraphs.map(countEmailWords),
      );
      if (countEmailWords(normalized) > 70 && paragraphs.length < 2) {
        return fail(rule, "Emails over 70 words need paragraph breaks.");
      }
      return longestParagraphWords <= 90
        ? pass(rule)
        : fail(
            rule,
            `Longest paragraph is ${longestParagraphWords} words; max is 90.`,
          );
    }

    case "limited_hyphen_connectors": {
      const connectorCount = (normalized.match(/\s[-–—]\s/g) ?? []).length;
      return connectorCount <= 1
        ? pass(rule)
        : fail(
            rule,
            `Expected at most 1 hyphen connector, got ${connectorCount}.`,
          );
    }

    case "cta_is_capitalized": {
      const hasLowercaseCtaStart =
        /(^|\n\n|\.\s+)(interested|would|if|happy|please)\b/.test(normalized);
      return hasLowercaseCtaStart
        ? fail(rule, "CTA sentence or paragraph starts lowercase.")
        : pass(rule);
    }

    case "signature_on_own_line": {
      const hasInlineSignature =
        /(Thanks|Best|Regards|Sincerely|Appreciate it either way)\.? +Nagarjun\b/i.test(
          normalized,
        );
      const hasOwnLineSignature = /\nNagarjun(?: Mallesh)?(?:\n|$)/.test(
        normalized,
      );
      return !hasInlineSignature && hasOwnLineSignature
        ? pass(rule)
        : fail(rule, "Signature must be on its own line.");
    }

    case "word_count_within_mode_limit": {
      const count = countEmailWords(normalized);
      const limit = EMAIL_MODE_WORD_LIMITS[mode];
      return count >= limit.min && count <= limit.max
        ? pass(rule)
        : fail(
            rule,
            `Expected ${limit.min}-${limit.max} words for ${mode}, got ${count}.`,
          );
    }

    case "has_structured_proof_points": {
      const proofLines = normalized
        .split("\n")
        .filter((line) =>
          /^[A-Z][A-Za-z0-9 &/+.-]{1,60}:\s+\S/.test(line.trim()),
        );
      return proofLines.length >= 2
        ? pass(rule)
        : fail(rule, "Expected at least 2 labeled proof-point lines.");
    }

    case "preserves_period_tokens": {
      const hasBrokenTechToken =
        /(^|\n\n|\.\s+)(?:js APIs|js services|js apps)\b/i.test(normalized);
      const hasBrokenDomain =
        /(^|\n\n|\.\s+)(?:com\/in\/|com\/[A-Za-z0-9_-])/i.test(normalized);
      return !hasBrokenTechToken && !hasBrokenDomain
        ? pass(rule)
        : fail(rule, "Period-sensitive technical tokens or URLs were damaged.");
    }

    case "no_orphan_fragments": {
      const hasOrphanFragment =
        /(^|\n\n|\.\s+)(?:js APIs|js services|js apps|com\/in\/|com\/[A-Za-z0-9_-])/i.test(
          normalized,
        );
      return !hasOrphanFragment
        ? pass(rule)
        : fail(
            rule,
            "Email contains an orphaned fragment from token splitting.",
          );
    }

    case "has_specific_low_friction_ask": {
      const hasAsk =
        /\b(?:brief chat|quick chat|share more context|open to|would you be open|let me know|happy to send|happy to share)\b/i.test(
          normalized,
        );
      return hasAsk
        ? pass(rule)
        : fail(rule, "Expected a clear, low-friction ask.");
    }

    case "has_latest_experience_reference": {
      const hasRecencySignal =
        /\b(?:latest|current|currently|recent|most recent)\b/i.test(normalized);
      const hasConcreteExperience =
        /\b(?:AWS|GCP|Terraform|Docker|CloudWatch|Python|TypeScript|FastAPI|RAG|AI|backend|infrastructure|automation|deployment|monitoring|production)\b/i.test(
          normalized,
        );
      return hasRecencySignal && hasConcreteExperience
        ? pass(rule)
        : fail(
            rule,
            "Expected latest/current experience with a concrete proof point.",
          );
    }

    case "has_concrete_ai_workflow_evidence": {
      const hasAction =
        /\b(?:built|implemented|shipped|deployed|created)\b/i.test(normalized);
      const hasAiSystem = /\b(?:AI|LLM|RAG|retrieval)\b/i.test(normalized);
      const hasWorkflowDetail =
        /\b(?:review|evaluation|verification|developer)\b/i.test(normalized);
      return hasAction && hasAiSystem && hasWorkflowDetail
        ? pass(rule)
        : fail(
            rule,
            "Expected a concrete AI workflow with an action and operational detail.",
          );
    }

    case "no_generic_ai_language": {
      return /\b(?:AI\s+(?:enthusiast|expert|specialist)|passionate about (?:AI|artificial intelligence)|AI(?:-powered)? solutions|the future of AI)\b/i.test(
        normalized,
      )
        ? fail(
            rule,
            "Email uses generic AI language instead of a concrete claim.",
          )
        : pass(rule);
    }

    case "exploring_requires_confirmed_source": {
      return /\bexplor(?:ing|e|ation)\b/i.test(normalized) &&
        !context.allowsExploring
        ? fail(
            rule,
            "Exploratory language is unsupported by the selected candidate sources.",
          )
        : pass(rule);
    }

    case "no_technology_inventory": {
      const hasInventory = normalized
        .split(/[.!?]\s+|\n+/)
        .some((line) => (line.match(TECHNOLOGY_TOKEN) ?? []).length >= 4);
      return hasInventory
        ? fail(rule, "Email contains a technology inventory instead of proof.")
        : pass(rule);
    }

    case "no_orphan_technology_line": {
      return normalized
        .split("\n")
        .some((line) =>
          /^(?:AWS|GCP|Azure|Terraform|Docker|Kubernetes|Python|TypeScript|JavaScript|React|Node\.js|Next\.js|FastAPI|PostgreSQL)[.!?]?$/i.test(
            line.trim(),
          ),
        )
        ? fail(rule, "Email contains a technology token on its own line.")
        : pass(rule);
    }

    case "no_duplicate_candidate_claim": {
      return hasRepeatedCandidateSentence(normalized)
        ? fail(rule, "Email repeats the same candidate claim.")
        : pass(rule);
    }

    case "has_complete_or_omitted_signature": {
      const hasClosing =
        /(?:^|\n)(?:Best|Thanks|Regards|Sincerely)[,!]?(?:\s|$)/i.test(
          normalized,
        );
      if (!hasClosing) {
        return pass(rule);
      }
      return /(?:^|\n)(?:Best|Thanks|Regards|Sincerely),?\n[A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*){0,3}(?:\nhttps?:\/\/\S+)?$/i.test(
        normalized,
      )
        ? pass(rule)
        : fail(
            rule,
            "Signature must be complete on its own lines or omitted entirely.",
          );
    }
  }
}

export function evaluateEmailQuality(
  body: string,
  options: {
    mode: EmailMode;
    rules: EmailQualityRule[];
    context?: EmailQualityContext | undefined;
  },
): EmailQualityEvaluation {
  const results = options.rules.map((rule) =>
    checkRule(body, options.mode, rule, options.context ?? {}),
  );
  const passedRules = results
    .filter((result) => result.passed)
    .map((result) => result.rule);
  const violations = results
    .filter((result) => !result.passed)
    .map((result) => ({ rule: result.rule, message: result.message }));

  return {
    passed: violations.length === 0,
    score: passedRules.length / results.length,
    totalRules: results.length,
    passedRules,
    violations,
  };
}
