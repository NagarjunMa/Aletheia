// AI Output Sanitization Layer
// Created: December 8, 2024
// Enhanced: February 2026
// Purpose: Clean and validate AI-generated content for safety, appropriateness, and authenticity

import {
  detectAIFingerprints,
  type AIFingerprintResult,
} from "./ai-fingerprint-detector";

/**
 * Remove unpaired Unicode surrogate characters (U+D800–U+DFFF)
 * that cause JSON serialization failures with the Anthropic API.
 */
export function stripSurrogates(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    "",
  );
}
import { createLogger } from "@/lib/logger";

const log = createLogger("sanitizer");

// Use dynamic import to handle ESM compatibility issues
let DOMPurify: any = null;

async function getDOMPurify() {
  if (!DOMPurify) {
    try {
      // Dynamic import for ESM compatibility
      const { default: purify } = await import("isomorphic-dompurify");
      DOMPurify = purify;
    } catch (error) {
      log.warn("DOMPurify not available, using fallback sanitization");
      // Fallback sanitization function
      DOMPurify = {
        sanitize: (html: string) =>
          html
            .replace(/<script[^>]*>.*?<\/script>/gi, "")
            .replace(/<[^>]*>/g, ""),
      };
    }
  }
  return DOMPurify;
}

export interface SanitizationOptions {
  allowHtml?: boolean;
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
  authenticityScore?: number | undefined;
  isAIGenerated?: boolean | undefined;
}

// Common profanity patterns (basic implementation)
const PROFANITY_PATTERNS = [
  // This would typically be a more comprehensive list
  // For production, consider using a dedicated profanity filter library
  /\b(damn|hell|crap|shit|fuck|bitch|ass|bastard)\b/gi,
  /\b(asshole|dumbass|jackass|smartass)\b/gi,
];

// Suspicious content patterns that might indicate harmful output
const HARMFUL_PATTERNS = [
  // Personal information patterns
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN format
  /\b\d{16}\b/g, // Credit card format
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email patterns (if not in appropriate context)

  // Potential injection patterns
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /onload|onerror|onclick/gi,

  // SQL injection patterns
  /union\s+select/gi,
  /drop\s+table/gi,
  /insert\s+into/gi,

  // Command injection patterns
  /\|\s*rm\s+-rf/gi,
  /\|\s*wget/gi,
  /\|\s*curl/gi,
];

// Content that should be blocked entirely
const BLOCKED_CONTENT_PATTERNS = [
  // Hate speech indicators
  /\b(nazi|hitler|genocide|ethnic\s+cleansing)\b/gi,

  // Violence indicators
  /\b(kill\s+yourself|commit\s+suicide|end\s+your\s+life)\b/gi,

  // Illegal activity
  /\b(how\s+to\s+make\s+(bombs?|explosives?))\b/gi,
  /\b(drug\s+dealing|selling\s+drugs)\b/gi,
];

/**
 * Sanitize AI-generated content for safety and appropriateness
 */
export async function sanitizeAIOutput(
  content: string,
  options: SanitizationOptions = {},
): Promise<SanitizationResult> {
  const {
    allowHtml = false,
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
    // 1. Basic input validation
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

    // 2. Check for blocked content patterns
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

    // 3. Validate text encoding
    if (validateEncoding) {
      try {
        // Check for valid UTF-8 encoding
        const encoded = new TextEncoder().encode(sanitizedContent);
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
          encoded,
        );
        if (decoded !== sanitizedContent) {
          sanitizedContent = decoded;
          modificationsApplied.push("Fixed text encoding issues");
        }
      } catch (error) {
        warnings.push("Text encoding validation failed");
      }
    }

    // 4. Length validation and truncation
    if (sanitizedContent.length > maxLength) {
      sanitizedContent = sanitizedContent.substring(0, maxLength);
      modificationsApplied.push(`Truncated to ${maxLength} characters`);
      warnings.push("Content was truncated due to length limits");
    }

    // 5. HTML sanitization
    if (allowHtml) {
      const originalHtml = sanitizedContent;
      const purify = await getDOMPurify();
      sanitizedContent = purify.sanitize(sanitizedContent, {
        ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "ol", "ul", "li"],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
      });

      if (originalHtml !== sanitizedContent) {
        modificationsApplied.push("Removed unsafe HTML elements");
      }
    } else {
      // Strip all HTML if not allowed
      const htmlStripped = sanitizedContent.replace(/<[^>]*>/g, "");
      if (htmlStripped !== sanitizedContent) {
        sanitizedContent = htmlStripped;
        modificationsApplied.push("Removed HTML tags");
      }
    }

    // 6. Remove harmful patterns
    HARMFUL_PATTERNS.forEach((pattern, index) => {
      const matches = sanitizedContent.match(pattern);
      if (matches) {
        sanitizedContent = sanitizedContent.replace(pattern, "[REDACTED]");
        modificationsApplied.push(`Removed suspicious pattern ${index + 1}`);
        warnings.push("Potentially sensitive information was redacted");
      }
    });

    // 7. Profanity filtering
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

    // 8. AI Fingerprint Detection and Humanization
    let aiFingerprints: AIFingerprintResult | undefined;
    if (enableAIDetection) {
      aiFingerprints = detectAIFingerprints(sanitizedContent, platform);

      if (aiFingerprints.isAIGenerated) {
        log.info(
          {
            patternCount: aiFingerprints.detectedPatterns?.length ?? 0,
            authenticityScore: aiFingerprints.authenticityScore,
            confidence: aiFingerprints.confidence,
            platform,
          },
          "AI fingerprints detected",
        );
        warnings.push(
          `Content appears AI-generated (confidence: ${aiFingerprints.confidence}%)`,
        );

        if (humanize) {
          // Apply AI fingerprint sanitization
          const previousContent = sanitizedContent;
          sanitizedContent = aiFingerprints.sanitizedContent;

          if (previousContent !== sanitizedContent) {
            modificationsApplied.push("Applied AI fingerprint humanization");
            modificationsApplied.push(...aiFingerprints.modifications);
          }
        }

        // Add specific warnings for detected patterns
        warnings.push(...aiFingerprints.warnings);
      }
    }

    // 9. Preserve formatting if requested
    if (preserveFormatting) {
      // Normalize line breaks
      sanitizedContent = sanitizedContent.replace(/\r\n/g, "\n");
      sanitizedContent = sanitizedContent.replace(/\r/g, "\n");

      // Remove excessive whitespace but preserve intentional formatting
      sanitizedContent = sanitizedContent.replace(/[ \t]+/g, " "); // Multiple spaces to single
      sanitizedContent = sanitizedContent.replace(/\n{3,}/g, "\n\n"); // Max 2 consecutive newlines
      sanitizedContent = sanitizedContent.trim();

      if (content !== sanitizedContent) {
        modificationsApplied.push("Normalized whitespace and formatting");
      }
    }

    // 10. Final validation
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
      authenticityScore: aiFingerprints?.authenticityScore,
      isAIGenerated: aiFingerprints?.isAIGenerated,
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

/**
 * Quick sanitization for display purposes
 */
export async function quickSanitize(content: string): Promise<string> {
  const result = await sanitizeAIOutput(content, {
    allowHtml: false,
    maxLength: 5000,
    preserveFormatting: true,
    removeProfanity: true,
    validateEncoding: true,
    detectAIFingerprints: true,
    humanize: true,
  });

  return result.success ? result.sanitizedContent : "";
}

/**
 * Sanitize AI-generated content for LinkedIn messages
 */
export async function sanitizeForLinkedIn(
  content: string,
): Promise<SanitizationResult> {
  return await sanitizeAIOutput(content, {
    allowHtml: false,
    maxLength: 2000, // LinkedIn message limits
    preserveFormatting: true,
    removeProfanity: true,
    validateEncoding: true,
    detectAIFingerprints: true,
    platform: "linkedin",
    humanize: true,
  });
}

/**
 * Sanitize AI-generated content for email messages
 */
export async function sanitizeForEmail(
  content: string,
): Promise<SanitizationResult> {
  return await sanitizeAIOutput(content, {
    allowHtml: false,
    maxLength: 5000, // Email length limits
    preserveFormatting: true,
    removeProfanity: true,
    validateEncoding: true,
    detectAIFingerprints: true,
    platform: "email",
    humanize: true,
  });
}

/**
 * Sanitize content for email or external sharing
 */
export async function sanitizeForExport(
  content: string,
): Promise<SanitizationResult> {
  return await sanitizeAIOutput(content, {
    allowHtml: false,
    maxLength: 10000,
    preserveFormatting: true,
    removeProfanity: true,
    validateEncoding: true,
  });
}

/**
 * Validate that content is safe for database storage
 */
export async function validateForStorage(content: string): Promise<boolean> {
  const result = await sanitizeAIOutput(content, {
    allowHtml: false,
    maxLength: 10000,
    preserveFormatting: true,
    removeProfanity: false, // Allow for user content
    validateEncoding: true,
  });

  return result.success && result.warnings.length === 0;
}

/**
 * Extract and validate metadata from AI responses
 */
export interface AIResponseMetadata {
  cplScore?: number;
  wordCount?: number;
  characterCount?: number;
  processingTime?: number;
  draftType?: string;
}

export function sanitizeResponseMetadata(metadata: any): {
  valid: boolean;
  sanitized: AIResponseMetadata;
  errors: string[];
} {
  const errors: string[] = [];
  const sanitized: AIResponseMetadata = {};

  try {
    // Validate CPL score
    if (metadata.cplScore !== undefined) {
      const score = Number(metadata.cplScore);
      if (isNaN(score) || score < 1 || score > 100) {
        errors.push("Invalid CPL score");
      } else {
        sanitized.cplScore = Math.round(score);
      }
    }

    // Validate word count
    if (metadata.wordCount !== undefined) {
      const count = Number(metadata.wordCount);
      if (isNaN(count) || count < 0) {
        errors.push("Invalid word count");
      } else {
        sanitized.wordCount = Math.floor(count);
      }
    }

    // Validate character count
    if (metadata.characterCount !== undefined) {
      const count = Number(metadata.characterCount);
      if (isNaN(count) || count < 0) {
        errors.push("Invalid character count");
      } else {
        sanitized.characterCount = Math.floor(count);
      }
    }

    // Validate processing time
    if (metadata.processingTime !== undefined) {
      const time = Number(metadata.processingTime);
      if (isNaN(time) || time < 0) {
        errors.push("Invalid processing time");
      } else {
        sanitized.processingTime = Math.round(time);
      }
    }

    // Validate draft type
    if (metadata.draftType !== undefined) {
      const validTypes = [
        "grammar_fix",
        "adaptive_polish",
        "creative_enhancement",
      ];
      if (
        typeof metadata.draftType === "string" &&
        validTypes.includes(metadata.draftType)
      ) {
        sanitized.draftType = metadata.draftType;
      } else {
        errors.push("Invalid draft type");
      }
    }

    return {
      valid: errors.length === 0,
      sanitized,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      sanitized: {},
      errors: ["Metadata validation failed"],
    };
  }
}

/**
 * Rate limiting for content sanitization (prevent abuse)
 */
const sanitizationCache = new Map<
  string,
  { result: SanitizationResult; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function sanitizeWithCaching(
  content: string,
  options: SanitizationOptions = {},
): Promise<SanitizationResult> {
  // Create cache key from content hash and options
  const cacheKey = `${hashContent(content)}_${JSON.stringify(options)}`;
  const cached = sanitizationCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const result = await sanitizeAIOutput(content, options);

  // Cache successful results only
  if (result.success) {
    sanitizationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }

  // Clean up old cache entries
  cleanupCache();

  return result;
}

function hashContent(content: string): string {
  // Simple hash function for caching
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of sanitizationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      sanitizationCache.delete(key);
    }
  }
}
