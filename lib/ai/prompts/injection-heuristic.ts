// Shared heuristic for untrusted profile and application context. Screening is
// defense in depth; callers still enforce source scope and final claim coverage.

export interface InjectionScanResult {
  triggered: boolean;
  reasons: string[];
}

// Match instruction attempts, not a person's name or a security research topic.
// This remains a heuristic; source-scoped selection and final validation also apply.
const PHRASE_PATTERNS = [
  {
    name: "ignore_prior_instructions",
    pattern:
      /ignore\s+(prior|previous|all|the|your)\s+(instructions?|rules?|context|prompt)/i,
  },
  {
    name: "disregard_previous",
    pattern:
      /(disregard|forget|override|bypass)\s+(prior|previous|all(?:\s+(?:prior|previous))?|the|your)\s+(instructions?|rules?|context|prompt|system)/i,
  },
  {
    name: "role_marker_at_line_start",
    // Fake conversation-turn markers at line starts
    pattern: /(^|\n)\s*(system|assistant|human|user)\s*:/i,
  },
  {
    name: "you_are_now",
    // "You are now [optional grammar] {jailbreak persona}". Match the
    // persona keyword loosely — adversaries phrase this many ways.
    pattern:
      /you\s+are\s+(now\s+)?[^\n]{0,40}?(jailbroken|developer\s+mode|unrestricted|dan|evil|uncensored)/i,
  },
  {
    name: "output_verbatim",
    pattern:
      /(output|print|reveal|show|return|repeat|dump)\s+(the\s+)?(resume|user('s)?\s+(resume|background|info|details|data|profile)|system\s+prompt|instructions?|prompt)/i,
  },
  {
    name: "xml_role_tag",
    // Embedded XML role tags. escapeForXmlTag handles boundary, but their
    // presence in input is itself a red flag.
    pattern:
      /<\s*\/?\s*(system|assistant|human|user_input|linkedin_profile)\s*>/i,
  },
  {
    name: "do_anything_now",
    pattern:
      /\b(?:do\s+anything\s+now|(?:act\s+as|become|you\s+are|enable|activate|switch\s+to)\s+(?:now\s+)?DAN)\b/i,
  },
  {
    name: "jailbreak_keyword",
    pattern:
      /\b(?:enable|activate|execute|apply|enter|perform|use)\s+(?:(?:this|the|a)\s+)?(?:jailbreak|prompt[\s-]?injection|prompt[\s-]?leak)\b/i,
  },
].map(({ name, pattern }) => ({
  name,
  // Compile only these fixed patterns: retain escapes/boundaries, allow one
  // canonical invisible marker between literal letters and at whitespace.
  pattern: new RegExp(
    pattern.source
      .replaceAll("[\\s-]", "(?:\\s|-)")
      .replace(/\\.|[A-Za-z_'-]/g, (token) =>
        token.startsWith("\\") ? token : `(?:${token}\u200b?)`,
      )
      .replaceAll("\\s", "[\\s\u200b]")
      // Keep the persona window bounded by visible characters, not markers.
      .replaceAll("[^\\n]{0,40}", "(?:[^\\n\u200b]\u200b?){0,40}"),
    pattern.flags,
  ),
}));

// Retain the existing bounded encoded-blob signal.
const BASE64_BLOB_PATTERN = /[A-Za-z0-9+/=]{64,}/;

// Node 24's Unicode data recognizes complete emoji, including legitimate tag flags.
const EMOJI_PATTERN = new RegExp("\\p{RGI_Emoji}", "gv");
// Keep bidi controls and non-emoji invisible tags conservative; ordinary joiners,
// direction marks and BOMs alone are not evidence of an instruction attempt.
const HIDDEN_UNICODE_PATTERN =
  /[\u202a-\u202e\u2061-\u206f]|[\u{E0000}-\u{E007F}]/u;

/**
 * Scan untrusted profile content for indirect prompt injection signals.
 * Returns stable reason codes only. Callers own rejection/safe-mode policy.
 * The normalized inspection copy must never replace source/provenance text.
 */
export function scanForInjection(profileMarkdown: string): InjectionScanResult {
  const reasons: string[] = [];

  if (!profileMarkdown) {
    return { triggered: false, reasons };
  }

  // Emoji are word boundaries in the inspection copy, not obfuscation signals.
  const normalized = profileMarkdown
    .normalize("NFKC")
    .replace(EMOJI_PATTERN, " ");
  const inspectionText = normalized.replace(
    /\p{Default_Ignorable_Code_Point}+/gu,
    "\u200b",
  );

  for (const { name, pattern } of PHRASE_PATTERNS) {
    if (pattern.test(inspectionText)) {
      reasons.push(name);
    }
  }

  if (BASE64_BLOB_PATTERN.test(inspectionText.replace(/\u200b/g, ""))) {
    reasons.push("base64_blob");
  }

  if (HIDDEN_UNICODE_PATTERN.test(profileMarkdown.replace(EMOJI_PATTERN, ""))) {
    reasons.push("hidden_unicode");
  }

  return { triggered: reasons.length > 0, reasons };
}
