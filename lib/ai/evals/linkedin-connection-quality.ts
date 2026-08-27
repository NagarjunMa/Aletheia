export type LinkedInConnectionQualityRule =
  | "has_greeting"
  | "under_300_chars"
  | "complete_grammar"
  | "has_specific_context"
  | "has_polished_ask"
  | "has_final_cta";

export interface GoldenLinkedInConnectionCase {
  id: string;
  generated: string;
  preferred: string;
  expectedRules: LinkedInConnectionQualityRule[];
}

export interface LinkedInConnectionQualityEvaluation {
  passed: boolean;
  passedRules: LinkedInConnectionQualityRule[];
  violations: Array<{ rule: LinkedInConnectionQualityRule; message: string }>;
}

function pass(rule: LinkedInConnectionQualityRule) {
  return { passed: true as const, rule };
}

function fail(rule: LinkedInConnectionQualityRule, message: string) {
  return { passed: false as const, rule, message };
}

function checkRule(text: string, rule: LinkedInConnectionQualityRule) {
  const normalized = text.trim();

  switch (rule) {
    case "has_greeting":
      return /^Hi\s+[A-Z][A-Za-z'-]{1,40},\s/.test(normalized)
        ? pass(rule)
        : fail(rule, "Expected a first-name greeting.");

    case "under_300_chars":
      return normalized.length <= 300
        ? pass(rule)
        : fail(rule, `Expected <= 300 chars, got ${normalized.length}.`);

    case "complete_grammar":
      return !/\b\d+\+?\s+years\s+building\b/i.test(normalized) &&
        !/\bacross\s+startup\s+and\s+enterprise\b/i.test(normalized)
        ? pass(rule)
        : fail(rule, "Connection note has clipped or incomplete grammar.");

    case "has_specific_context":
      return /\b(?:role|post|note|Virio|Amazon|extension|team|company)\b/i.test(
        normalized,
      )
        ? pass(rule)
        : fail(rule, "Expected a concrete target-specific context hook.");

    case "has_polished_ask":
      return /\b(?:I'd like to explore whether|open to a brief chat|glad to share more context|if helpful|whether (?:you're|you’re) open to discussing referrals)\b/i.test(
        normalized,
      ) &&
        !/\bwhether\s+referrals\s+are\s+something\s+(?:you're|you’re)\s+open\s+to\s+discussing\b/i.test(
          normalized,
        )
        ? pass(rule)
        : fail(rule, "Expected a polished, low-friction ask.");

    case "has_final_cta":
      return /(?:whether there(?:'s|’s| is) a fit on your team|open to a brief chat|glad to share more context if helpful|whether (?:you're|you’re) open to discussing referrals)[?.]$/i.test(
        normalized,
      )
        ? pass(rule)
        : fail(
            rule,
            "Expected the complete CTA to remain at the end of the note.",
          );
  }
}

export function evaluateLinkedInConnectionQuality(
  text: string,
  rules: LinkedInConnectionQualityRule[],
): LinkedInConnectionQualityEvaluation {
  const results = rules.map((rule) => checkRule(text, rule));
  const passedRules = results
    .filter((result) => result.passed)
    .map((result) => result.rule);
  const violations = results
    .filter((result) => !result.passed)
    .map((result) => ({ rule: result.rule, message: result.message }));

  return {
    passed: violations.length === 0,
    passedRules,
    violations,
  };
}
