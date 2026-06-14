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
  | "has_latest_experience_reference";

export interface GoldenEmailCase {
  id: string;
  category: "cold_email" | "linkedin_inmail";
  emailMode: EmailMode;
  intent: "networking" | "referral" | "mentorship" | "job_inquiry";
  problemTags: string[];
  generated: string;
  preferred: string;
  expectedRules: EmailQualityRule[];
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

function checkRule(body: string, mode: EmailMode, rule: EmailQualityRule) {
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
  }
}

export function evaluateEmailQuality(
  body: string,
  options: { mode: EmailMode; rules: EmailQualityRule[] },
): EmailQualityEvaluation {
  const results = options.rules.map((rule) =>
    checkRule(body, options.mode, rule),
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
