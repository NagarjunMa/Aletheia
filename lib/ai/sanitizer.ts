// AI Output Sanitization Layer
// Strips unsafe patterns + AI fingerprint humanization.
// AI-generated content is never rendered as HTML — text-only.

import {
  detectAIFingerprints,
  type AIFingerprintResult,
} from "./ai-fingerprint-detector";
import { createLogger } from "@/lib/logger";

const log = createLogger("sanitizer");

/**
 * Remove unpaired Unicode surrogate characters (U+D800–U+DFFF)
 * that cause JSON serialization failures with the Anthropic API.
 */
export function stripSurrogates(str: string): string {
  return str.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    "",
  );
}

// Lines the model emits as meta-commentary around the message body.
// Patterns are intentionally narrow to avoid stripping real content that
// happens to begin with a verb like "Here is" or "Let me".
const MODEL_META_LINE = new RegExp(
  [
    // Self-narration preambles. Must be a short single sentence ending in a
    // period (no colon → no inline content). e.g. "Counting carefully before
    // finalizing." but NOT "Counting takes patience and I learned that early."
    "^(?:counting|verifying|checking|reviewing|finaliz(?:e|ing)|drafting|preparing|thinking|considering)\\b[^:]{0,60}\\.\\s*$",
    // Header lines that are JUST a label (no message content after the colon)
    "^(?:output|note|message|connection note|draft|response|result|final(?: message)?|here(?:'| i)s (?:the (?:message|draft|note|connection note|output|response)))\\s*[:\\-]?\\s*$",
    // "Let me X." / "Let's X." style — must end with period and be brief.
    "^let(?:\\s+me|(?:'|)s)\\s+(?:draft|write|compose|put together|think|verify|finalize|count)\\b[^:]{0,40}\\.\\s*$",
    // Character/word count tails like "Character count: 221 ✓"
    "^(?:character|char|word)\\s*count\\s*[:=]?\\s*\\d+\\s*[✓✔✗xX]?\\s*$",
    // Stand-alone separator lines: --- *** === ___
    "^[\\-*_=]{3,}\\s*$",
  ].join("|"),
  "i",
);

// Inline-prefix labels: model emits the label on the same line as content.
// Strip only the label prefix, keep the content. e.g. "Output: foo" → "foo"
const INLINE_LABEL_PREFIX =
  /^(?:output|note|message|connection note|draft|response|result|final(?: message)?|here(?:'|)s (?:the (?:message|draft|note|connection note|output|response)))\s*[:\-]\s+/i;

/**
 * Strip leading and trailing meta lines emitted by the model around the
 * actual message body. Catches output-format violations like
 * "Counting carefully before finalizing." preambles or
 * "Character count: 221 ✓" tails without removing real message content.
 *
 * Walks from each end; stops at the first line that is not meta.
 * Also drops a single inline label prefix on the first remaining line.
 */
export function stripModelPreambleAndSuffix(content: string): string {
  if (!content) return content;
  const lines = content.split("\n");
  let start = 0;
  let end = lines.length;
  while (start < end && MODEL_META_LINE.test(lines[start]!.trim())) start++;
  while (end > start && MODEL_META_LINE.test(lines[end - 1]!.trim())) end--;
  if (start < end) {
    lines[start] = lines[start]!.replace(INLINE_LABEL_PREFIX, "");
  }
  if (start === 0 && end === lines.length && lines[0] === content) {
    return content;
  }
  return lines.slice(start, end).join("\n").trim();
}

export interface SanitizationOptions {
  maxLength?: number;
  preserveFormatting?: boolean;
  removeProfanity?: boolean;
  validateEncoding?: boolean;
  detectAIFingerprints?: boolean;
  platform?: "linkedin" | "email" | "general";
  humanize?: boolean;
}

export interface SanitizationResult {
  success: boolean;
  sanitizedContent: string;
  originalLength: number;
  sanitizedLength: number;
  modificationsApplied: string[];
  warnings: string[];
  error?: string | undefined;
  aiFingerprints?: AIFingerprintResult | undefined;
}

// Profanity patterns — covers common terms and compound forms.
const PROFANITY_PATTERNS = [
  /\b(damn|hell|crap|shit|fuck|bitch|ass|bastard)\b/gi,
  /\b(asshole|dumbass|jackass|smartass|douchebag|dipshit|bullshit)\b/gi,
  /\b(stfu|gtfo|wtf|lmfao|fml)\b/gi,
  /\b(f+u+c+k+|s+h+i+t+|b+i+t+c+h+)\b/gi,
  /\b(motherfuck\w*|cocksucker|wanker|twat|prick)\b/gi,
];

const HARMFUL_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{16}\b/g, // Credit card
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /onload|onerror|onclick/gi,
  /union\s+select/gi,
  /drop\s+table/gi,
  /insert\s+into/gi,
  /\|\s*rm\s+-rf/gi,
  /\|\s*wget/gi,
  /\|\s*curl/gi,
];

// Cold emails legitimately include the sender's email in the signature.
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

const BLOCKED_CONTENT_PATTERNS = [
  /\b(nazi|n[a@]z[i1!]|hitler|h[i1!]tl[e3]r|genocide|ethnic\s+cleansing)\b/gi,
  /\b(kill\s+yourself|k[i1!]ll\s+y[o0]urs[e3]lf|commit\s+suicide|end\s+your\s+life)\b/gi,
  /\b(how\s+to\s+make\s+(bombs?|explosives?))\b/gi,
  /\b(drug\s+dealing|selling\s+drugs)\b/gi,
  /\b(n[i1!]gg[e3a@]r|f[a@]gg?[o0]t|r[e3]t[a@]rd)\b/gi,
];

export async function sanitizeAIOutput(
  content: string,
  options: SanitizationOptions = {},
): Promise<SanitizationResult> {
  const {
    maxLength = 10000,
    preserveFormatting = true,
    removeProfanity = true,
    validateEncoding = true,
    detectAIFingerprints: enableAIDetection = true,
    platform = "general",
    humanize = true,
  } = options;

  const modificationsApplied: string[] = [];
  const warnings: string[] = [];
  let sanitizedContent = content;
  const originalLength = content.length;

  try {
    if (!content || typeof content !== "string") {
      return {
        success: false,
        sanitizedContent: "",
        originalLength: 0,
        sanitizedLength: 0,
        modificationsApplied: [],
        warnings: [],
        error: "Invalid content provided",
      };
    }

    const blockedMatches = BLOCKED_CONTENT_PATTERNS.some((pattern) =>
      pattern.test(sanitizedContent),
    );

    if (blockedMatches) {
      return {
        success: false,
        sanitizedContent: "",
        originalLength,
        sanitizedLength: 0,
        modificationsApplied: [],
        warnings: ["Content contains blocked patterns"],
        error: "Content rejected due to policy violations",
      };
    }

    if (validateEncoding) {
      try {
        const encoded = new TextEncoder().encode(sanitizedContent);
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
          encoded,
        );
        if (decoded !== sanitizedContent) {
          sanitizedContent = decoded;
          modificationsApplied.push("Fixed text encoding issues");
        }
      } catch {
        warnings.push("Text encoding validation failed");
      }
    }

    if (sanitizedContent.length > maxLength) {
      sanitizedContent = sanitizedContent.substring(0, maxLength);
      modificationsApplied.push(`Truncated to ${maxLength} characters`);
      warnings.push("Content was truncated due to length limits");
    }

    // Strip all HTML — output is text-only, never rendered as HTML.
    const htmlStripped = sanitizedContent.replace(/<[^>]*>/g, "");
    if (htmlStripped !== sanitizedContent) {
      sanitizedContent = htmlStripped;
      modificationsApplied.push("Removed HTML tags");
    }

    HARMFUL_PATTERNS.forEach((pattern, index) => {
      const matches = sanitizedContent.match(pattern);
      if (matches) {
        sanitizedContent = sanitizedContent.replace(pattern, "[REDACTED]");
        modificationsApplied.push(`Removed suspicious pattern ${index + 1}`);
        warnings.push("Potentially sensitive information was redacted");
      }
    });

    if (platform !== "email") {
      const emailMatches = sanitizedContent.match(EMAIL_PATTERN);
      if (emailMatches) {
        sanitizedContent = sanitizedContent.replace(
          EMAIL_PATTERN,
          "[REDACTED]",
        );
        modificationsApplied.push("Redacted email addresses");
        warnings.push("Email addresses were redacted");
      }
    }

    if (removeProfanity) {
      PROFANITY_PATTERNS.forEach((pattern, index) => {
        const matches = sanitizedContent.match(pattern);
        if (matches) {
          sanitizedContent = sanitizedContent.replace(pattern, (match) => {
            return match[0] + "*".repeat(match.length - 1);
          });
          modificationsApplied.push(`Filtered profanity pattern ${index + 1}`);
        }
      });
    }

    let aiFingerprints: AIFingerprintResult | undefined;
    if (enableAIDetection) {
      aiFingerprints = detectAIFingerprints(sanitizedContent, platform);

      if (aiFingerprints.detectedPatterns.length > 0) {
        log.info(
          {
            patternCount: aiFingerprints.detectedPatterns.length,
            platform,
          },
          "AI fingerprints detected and stripped",
        );

        if (humanize) {
          const previousContent = sanitizedContent;
          sanitizedContent = aiFingerprints.sanitizedContent;

          if (previousContent !== sanitizedContent) {
            modificationsApplied.push("Applied AI fingerprint humanization");
            modificationsApplied.push(...aiFingerprints.modifications);
          }
        }

        warnings.push(...aiFingerprints.warnings);
      }
    }

    if (preserveFormatting) {
      sanitizedContent = sanitizedContent.replace(/\r\n/g, "\n");
      sanitizedContent = sanitizedContent.replace(/\r/g, "\n");
      sanitizedContent = sanitizedContent.replace(/[ \t]+/g, " ");
      sanitizedContent = sanitizedContent.replace(/\n{3,}/g, "\n\n");
      sanitizedContent = sanitizedContent.trim();

      if (content !== sanitizedContent) {
        modificationsApplied.push("Normalized whitespace and formatting");
      }
    }

    if (sanitizedContent.length === 0) {
      warnings.push("Content was completely removed during sanitization");
    }

    return {
      success: true,
      sanitizedContent,
      originalLength,
      sanitizedLength: sanitizedContent.length,
      modificationsApplied,
      warnings,
      aiFingerprints,
    };
  } catch (error) {
    log.error({ err: error }, "Sanitization error");
    return {
      success: false,
      sanitizedContent: "",
      originalLength,
      sanitizedLength: 0,
      modificationsApplied,
      warnings,
      error: "Unexpected error during sanitization",
    };
  }
}

export async function sanitizeForLinkedIn(
  content: string,
): Promise<SanitizationResult> {
  return await sanitizeAIOutput(content, {
    maxLength: 2000,
    preserveFormatting: true,
    removeProfanity: true,
    validateEncoding: true,
    detectAIFingerprints: true,
    platform: "linkedin",
    humanize: true,
  });
}

export async function sanitizeForEmail(
  content: string,
): Promise<SanitizationResult> {
  return await sanitizeAIOutput(content, {
    maxLength: 5000,
    preserveFormatting: true,
    removeProfanity: true,
    validateEncoding: true,
    detectAIFingerprints: true,
    platform: "email",
    humanize: true,
  });
}
