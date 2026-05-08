// AI Fingerprint Detection System
// Created: February 2026
// Purpose: Detect and sanitize AI-generated content patterns to improve authenticity

export interface AIFingerprintPattern {
  pattern: RegExp;
  replacement: string | ((_match: string) => string);
  name: string;
  platform?: "linkedin" | "email" | "general";
  severity: "high" | "medium" | "low";
  description: string;
}

export interface AIFingerprintResult {
  isAIGenerated: boolean;
  confidence: number; // 0-100
  detectedPatterns: string[];
  sanitizedContent: string;
  authenticityScore: number; // 0-100 (higher = more authentic)
  modifications: string[];
  warnings: string[];
}

// Core AI fingerprint patterns that indicate AI-generated content
export const AI_FINGERPRINT_PATTERNS: AIFingerprintPattern[] = [
  // Typography patterns (most reliable indicators)
  {
    pattern: /—/g,
    replacement: " - ",
    name: "em_dash_usage",
    severity: "high",
    description: "AI commonly uses em-dashes instead of hyphens",
  },
  {
    pattern: /…/g,
    replacement: "...",
    name: "ellipsis_character",
    severity: "medium",
    description: "AI uses Unicode ellipsis instead of three periods",
  },

  // AI politeness formulas
  {
    pattern: /I'll keep this (short|brief|concise)\.?/gi,
    replacement: "",
    name: "ai_disclaimer",
    severity: "high",
    description: "Common AI opening disclaimer",
  },
  {
    pattern: /would you be (open to|interested in)/gi,
    replacement: (match) =>
      match.includes("open to") ? "interested in" : "want to",
    name: "ai_politeness",
    severity: "high",
    description: "Overly formal AI politeness pattern",
  },
  {
    pattern: /appreciate it either way/gi,
    replacement: "thanks!",
    name: "ai_courtesy_closing",
    severity: "high",
    description: "Standard AI courtesy closing",
  },
  {
    pattern: /hope this (helps|finds you well)/gi,
    replacement: "",
    name: "ai_hope_phrase",
    severity: "medium",
    description: "Common AI courtesy phrase",
  },

  // LinkedIn-specific AI patterns
  {
    pattern: /found your (.*?) post on LinkedIn/gi,
    replacement: "saw your $1 post",
    name: "linkedin_post_reference",
    platform: "linkedin",
    severity: "medium",
    description: "AI-generated LinkedIn post references",
  },
  {
    pattern: /your (background|experience|profile) caught my (attention|eye)/gi,
    replacement: "your $1 looks interesting",
    name: "background_attention",
    platform: "linkedin",
    severity: "high",
    description: "AI profile interest formula",
  },

  // Email AI patterns
  {
    pattern: /I hope this email finds you (well|in good health)/gi,
    replacement: "Hope you're doing well",
    name: "email_greeting",
    platform: "email",
    severity: "medium",
    description: "Standard AI email greeting",
  },
  {
    pattern: /please don't hesitate to (reach out|contact me|let me know)/gi,
    replacement: "feel free to reach out",
    name: "hesitate_phrase",
    platform: "email",
    severity: "medium",
    description: "AI formal closing phrase",
  },

  // Structure and flow patterns
  {
    // Only flag when ALL paragraph breaks start with uppercase (3+ paragraphs).
    // Single double-newline before a capital letter is normal human writing.
    pattern: /^(?=(?:.*\n\n[A-Z]){3,})/gm,
    replacement: "",
    name: "perfect_paragraph_breaks",
    severity: "low",
    description:
      "AI creates uniformly structured paragraphs (3+ all starting uppercase)",
  },
  {
    pattern: /^(Here's|Here are) (some|a few|several)/gm,
    replacement: "",
    name: "list_introduction",
    severity: "medium",
    description: "AI list introduction patterns",
  },

  // Overly formal language
  {
    pattern: /I would be (delighted|thrilled|honored) to/gi,
    replacement: "I'd love to",
    name: "excessive_formality",
    severity: "medium",
    description: "Overly formal AI language",
  },
  {
    pattern: /at your earliest convenience/gi,
    replacement: "when you have a chance",
    name: "formal_convenience",
    severity: "medium",
    description: "Formal AI convenience phrase",
  },

  // Generic AI transitions
  {
    pattern: /that being said,?/gi,
    replacement: "",
    name: "ai_transition",
    severity: "medium",
    description: "Common AI transition phrase",
  },
  {
    pattern: /with that in mind,?/gi,
    replacement: "",
    name: "ai_transition_mind",
    severity: "medium",
    description: "AI transition with context",
  },

  // Corporate AI buzzwords (high-frequency in AI text)
  {
    pattern: /\b(showcasing|aligns with|aims to)\b/gi,
    replacement: (match) => {
      const word = match.toLowerCase();
      if (word.includes("showcasing")) return "showing";
      if (word.includes("aligns with")) return "matches";
      if (word.includes("aims to")) return "wants to";
      return match;
    },
    name: "corporate_buzzwords",
    severity: "high",
    description: "Corporate AI buzzwords (20x+ more frequent in AI text)",
  },
  {
    pattern: /really resonates with/gi,
    replacement: "really interests",
    name: "ai_resonance",
    severity: "high",
    description: "AI resonance pattern",
  },
  {
    pattern: /AI-first approach/gi,
    replacement: "AI approach",
    name: "ai_first_approach",
    severity: "high",
    description: "AI-first terminology pattern",
  },
  {
    pattern: /\b(game-changer|industry leader|world-class)\b/gi,
    replacement: (match) => {
      const word = match.toLowerCase();
      if (word.includes("game-changer")) return "impactful";
      if (word.includes("industry leader")) return "top company";
      if (word.includes("world-class")) return "excellent";
      return match;
    },
    name: "superlative_buzzwords",
    severity: "medium",
    description: "AI superlative buzzwords",
  },
];

// Platform-specific authenticity rules
export const PLATFORM_AUTHENTICITY_RULES = {
  linkedin: {
    maxSentenceLength: 25, // LinkedIn messages should be concise
    informalityThreshold: 0.3, // Should have some informal elements
    personalPronounRatio: 0.15, // Should use "I" appropriately
    preferredPunctuation: [".", "!", "?"], // Avoid semicolons, colons
    avoidPatterns: [
      /semicolon/gi,
      /furthermore/gi,
      /moreover/gi,
      /nonetheless/gi,
    ],
  },
  email: {
    maxSentenceLength: 30,
    informalityThreshold: 0.2,
    personalPronounRatio: 0.12,
    preferredPunctuation: [".", "!", "?"],
    avoidPatterns: [/pursuant to/gi, /in accordance with/gi],
  },
  general: {
    maxSentenceLength: 35,
    informalityThreshold: 0.4,
    personalPronounRatio: 0.18,
    preferredPunctuation: [".", "!", "?"],
    avoidPatterns: [],
  },
};

/**
 * Detect AI fingerprints in content and calculate authenticity score
 */
export function detectAIFingerprints(
  content: string,
  platform: "linkedin" | "email" | "general" = "general",
): AIFingerprintResult {
  const detectedPatterns: string[] = [];
  const modifications: string[] = [];
  const warnings: string[] = [];
  let sanitizedContent = content;
  let confidenceScore = 0;

  // Apply pattern detection and sanitization
  for (const pattern of AI_FINGERPRINT_PATTERNS) {
    // Skip platform-specific patterns if they don't match
    if (pattern.platform && pattern.platform !== platform) {
      continue;
    }

    const matches = content.match(pattern.pattern);
    if (matches) {
      detectedPatterns.push(pattern.name);

      // Add confidence based on severity
      switch (pattern.severity) {
        case "high":
          confidenceScore += 25;
          break;
        case "medium":
          confidenceScore += 15;
          break;
        case "low":
          confidenceScore += 5;
          break;
      }

      // Apply sanitization
      if (typeof pattern.replacement === "string") {
        const before = sanitizedContent;
        sanitizedContent = sanitizedContent.replace(
          pattern.pattern,
          pattern.replacement,
        );
        if (before !== sanitizedContent) {
          modifications.push(`Fixed ${pattern.description}`);
        }
      } else {
        const before = sanitizedContent;
        sanitizedContent = sanitizedContent.replace(
          pattern.pattern,
          pattern.replacement as any,
        );
        if (before !== sanitizedContent) {
          modifications.push(`Fixed ${pattern.description}`);
        }
      }

      warnings.push(`Detected: ${pattern.description}`);
    }
  }

  // Calculate authenticity score based on various factors
  const authenticityScore = calculateAuthenticityScore(
    sanitizedContent,
    platform,
    detectedPatterns,
  );

  // Determine if content is AI-generated.
  // Uses AND logic: both pattern confidence AND low authenticity must agree.
  // OR logic falsely flagged formal-but-human writing as AI.
  const isAIGenerated = confidenceScore >= 30 && authenticityScore < 50;

  return {
    isAIGenerated,
    confidence: Math.min(confidenceScore, 100),
    detectedPatterns,
    sanitizedContent: cleanupSanitizedContent(sanitizedContent),
    authenticityScore,
    modifications,
    warnings,
  };
}

/**
 * Calculate authenticity score based on human-like writing patterns
 */
function calculateAuthenticityScore(
  content: string,
  platform: "linkedin" | "email" | "general",
  detectedPatterns: string[],
): number {
  let score = 100;
  const rules = PLATFORM_AUTHENTICITY_RULES[platform];

  // Analyze sentence structure
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength =
    sentences.reduce((sum, s) => sum + s.split(" ").length, 0) /
    sentences.length;

  // Penalize overly long sentences
  if (avgSentenceLength > rules.maxSentenceLength) {
    score -= 15;
  }

  // Check for sentence length variation (humans vary more)
  const sentenceLengths = sentences.map((s) => s.split(" ").length);
  const lengthVariation = calculateVariation(sentenceLengths);
  if (lengthVariation < 0.2) {
    score -= 10; // Too consistent = AI-like
  }

  // Check informality level
  const informalityScore = calculateInformalityScore(content);
  if (informalityScore < rules.informalityThreshold) {
    score -= 20;
  }

  // Check personal pronoun usage
  const personalPronouns = (content.match(/\b(I|me|my|mine)\b/gi) || []).length;
  const totalWords = content.split(/\s+/).length;
  const pronounRatio = personalPronouns / totalWords;

  if (
    pronounRatio < rules.personalPronounRatio * 0.5 ||
    pronounRatio > rules.personalPronounRatio * 3
  ) {
    score -= 10;
  }

  // Penalize for avoided patterns
  for (const pattern of rules.avoidPatterns) {
    if (pattern.test(content)) {
      score -= 15;
    }
  }

  // Heavy penalty for multiple AI patterns
  score -= detectedPatterns.length * 8;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate informality score based on contractions, casual language, etc.
 */
function calculateInformalityScore(content: string): number {
  let informalCount = 0;
  const totalWords = content.split(/\s+/).length;

  // Count contractions
  const contractions = content.match(/\b\w+[''](?:ll|re|ve|d|t|s|m)\b/gi) || [];
  informalCount += contractions.length;

  // Count casual words
  const casualWords = [
    "hey",
    "yeah",
    "cool",
    "awesome",
    "great",
    "sure",
    "totally",
    "definitely",
  ];
  for (const word of casualWords) {
    const matches = content.match(new RegExp(`\\b${word}\\b`, "gi")) || [];
    informalCount += matches.length;
  }

  // Count exclamation marks
  const exclamations = content.match(/!/g) || [];
  informalCount += exclamations.length * 0.5;

  return informalCount / totalWords;
}

/**
 * Calculate variation in an array of numbers
 */
function calculateVariation(numbers: number[]): number {
  if (numbers.length === 0) return 0;

  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const variance =
    numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
  const standardDeviation = Math.sqrt(variance);

  return standardDeviation / mean; // Coefficient of variation
}

/**
 * Clean up sanitized content to ensure it flows naturally
 */
function cleanupSanitizedContent(content: string): string {
  let cleaned = content;

  // Remove double spaces
  cleaned = cleaned.replace(/  +/g, " ");

  // Fix spacing around punctuation
  cleaned = cleaned.replace(/\s+([,.!?])/g, "$1");
  cleaned = cleaned.replace(/([.!?])\s*\n/g, "$1\n");

  // Remove empty lines created by removing AI phrases
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n");

  // Trim and ensure proper spacing
  cleaned = cleaned.trim();

  // Don't force terminal punctuation — "Thanks" and "Cool" are valid
  // as-is. Adding "." changes tone ("Thanks." reads curt/passive-aggressive).

  return cleaned;
}

/**
 * Quick check if content appears to be AI-generated
 */
export function isLikelyAIGenerated(
  content: string,
  platform: "linkedin" | "email" | "general" = "general",
): boolean {
  const result = detectAIFingerprints(content, platform);
  return result.isAIGenerated;
}

/**
 * Sanitize content by removing AI fingerprints
 */
export function sanitizeAIFingerprints(
  content: string,
  platform: "linkedin" | "email" | "general" = "general",
): string {
  const result = detectAIFingerprints(content, platform);
  return result.sanitizedContent;
}

/**
 * Get detailed analysis of content authenticity
 */
export function analyzeContentAuthenticity(
  content: string,
  platform: "linkedin" | "email" | "general" = "general",
): {
  authenticity: "high" | "medium" | "low";
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const result = detectAIFingerprints(content, platform);

  let authenticity: "high" | "medium" | "low" = "high";
  if (result.authenticityScore < 40) authenticity = "low";
  else if (result.authenticityScore < 70) authenticity = "medium";

  const issues = result.warnings;
  const suggestions: string[] = [];

  if (result.confidence > 50) {
    suggestions.push(
      "Consider rewriting in a more personal, conversational tone",
    );
  }
  if (result.authenticityScore < 50) {
    suggestions.push("Add more personality and informal language");
  }
  if (result.detectedPatterns.includes("em_dash_usage")) {
    suggestions.push("Use regular hyphens (-) instead of em-dashes (—)");
  }
  if (result.detectedPatterns.includes("ai_politeness")) {
    suggestions.push("Use more direct, casual language");
  }

  return {
    authenticity,
    score: result.authenticityScore,
    issues,
    suggestions,
  };
}
