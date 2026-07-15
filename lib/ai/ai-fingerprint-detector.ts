// AI Fingerprint Stripper
// Detects and rewrites common AI tells (em-dashes, corporate buzzwords, formality formulas).
// No scoring — patterns are either stripped or not. Score-as-truth was theater.

export interface AIFingerprintPattern {
  pattern: RegExp;
  replacement: string | ((_match: string) => string);
  name: string;
  platform?: "linkedin" | "email" | "general";
  description: string;
}

export interface AIFingerprintResult {
  detectedPatterns: string[];
  sanitizedContent: string;
  modifications: string[];
  warnings: string[];
}

export const AI_FINGERPRINT_PATTERNS: AIFingerprintPattern[] = [
  // Typography
  {
    pattern: /—/g,
    replacement: " - ",
    name: "em_dash_usage",
    description: "AI commonly uses em-dashes instead of hyphens",
  },
  {
    pattern: /…/g,
    replacement: "...",
    name: "ellipsis_character",
    description: "AI uses Unicode ellipsis instead of three periods",
  },

  // Politeness formulas
  {
    pattern: /I'll keep this (short|brief|concise)\.?/gi,
    replacement: "",
    name: "ai_disclaimer",
    description: "Common AI opening disclaimer",
  },
  {
    pattern: /would you be (open to|interested in)/gi,
    replacement: (match) =>
      match.includes("open to") ? "interested in" : "want to",
    name: "ai_politeness",
    description: "Overly formal AI politeness pattern",
  },
  {
    pattern: /appreciate it either way/gi,
    replacement: "thanks!",
    name: "ai_courtesy_closing",
    description: "Standard AI courtesy closing",
  },
  {
    pattern: /hope this (helps|finds you well)/gi,
    replacement: "",
    name: "ai_hope_phrase",
    description: "Common AI courtesy phrase",
  },

  // LinkedIn-specific
  {
    pattern: /found your (.*?) post on LinkedIn/gi,
    replacement: "saw your $1 post",
    name: "linkedin_post_reference",
    platform: "linkedin",
    description: "AI-generated LinkedIn post references",
  },
  {
    pattern: /your (background|experience|profile) caught my (attention|eye)/gi,
    replacement: "your $1 looks interesting",
    name: "background_attention",
    platform: "linkedin",
    description: "AI profile interest formula",
  },

  // Email
  {
    pattern: /I hope this email finds you (well|in good health)/gi,
    replacement: "Hope you're doing well",
    name: "email_greeting",
    platform: "email",
    description: "Standard AI email greeting",
  },
  {
    pattern: /please don't hesitate to (reach out|contact me|let me know)/gi,
    replacement: "feel free to reach out",
    name: "hesitate_phrase",
    platform: "email",
    description: "AI formal closing phrase",
  },

  // Structure
  {
    pattern: /^(?=(?:.*\n\n[A-Z]){3,})/gm,
    replacement: "",
    name: "perfect_paragraph_breaks",
    description:
      "AI uniformly structured paragraphs (3+ all starting uppercase)",
  },
  {
    pattern: /^(Here's|Here are) (some|a few|several)/gm,
    replacement: "",
    name: "list_introduction",
    description: "AI list introduction patterns",
  },

  // Formality
  {
    pattern: /I would be (delighted|thrilled|honored) to/gi,
    replacement: "I'd love to",
    name: "excessive_formality",
    description: "Overly formal AI language",
  },
  {
    pattern: /at your earliest convenience/gi,
    replacement: "when you have a chance",
    name: "formal_convenience",
    description: "Formal AI convenience phrase",
  },

  // Transitions
  {
    pattern: /that being said,?/gi,
    replacement: "",
    name: "ai_transition",
    description: "Common AI transition phrase",
  },
  {
    pattern: /with that in mind,?/gi,
    replacement: "",
    name: "ai_transition_mind",
    description: "AI transition with context",
  },

  // Buzzwords
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
    description: "Corporate AI buzzwords",
  },
  {
    pattern: /really resonates with/gi,
    replacement: "really interests",
    name: "ai_resonance",
    description: "AI resonance pattern",
  },
  {
    pattern: /AI-first approach/gi,
    replacement: "AI approach",
    name: "ai_first_approach",
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
    description: "AI superlative buzzwords",
  },
];

/**
 * Detect AI fingerprints, rewrite them, return cleaned content.
 */
export function detectAIFingerprints(
  content: string,
  platform: "linkedin" | "email" | "general" = "general",
): AIFingerprintResult {
  const detectedPatterns: string[] = [];
  const modifications: string[] = [];
  const warnings: string[] = [];
  let sanitizedContent = content;

  for (const pattern of AI_FINGERPRINT_PATTERNS) {
    if (pattern.platform && pattern.platform !== platform) {
      continue;
    }

    const matches = content.match(pattern.pattern);
    if (matches) {
      detectedPatterns.push(pattern.name);

      const before = sanitizedContent;
      if (typeof pattern.replacement === "string") {
        sanitizedContent = sanitizedContent.replace(
          pattern.pattern,
          pattern.replacement,
        );
      } else {
        sanitizedContent = sanitizedContent.replace(
          pattern.pattern,
          pattern.replacement as (_match: string) => string,
        );
      }
      if (before !== sanitizedContent) {
        modifications.push(`Fixed ${pattern.description}`);
      }
      warnings.push(`Detected: ${pattern.description}`);
    }
  }

  return {
    detectedPatterns,
    sanitizedContent: cleanupSanitizedContent(sanitizedContent),
    modifications,
    warnings,
  };
}

function cleanupSanitizedContent(content: string): string {
  let cleaned = content;
  cleaned = cleaned.replace(/  +/g, " ");
  cleaned = cleaned.replace(/\s+([,.!?])/g, "$1");
  // Keep intentional paragraph boundaries intact. `\s` also matches newlines,
  // so the previous expression collapsed `\n\n` to `\n` whenever a paragraph
  // ended in punctuation. Email formatting relies on those blank lines to keep
  // proof points, value statements, asks, and signatures in separate sections.
  cleaned = cleaned.replace(/([.!?])[ \t]*\n/g, "$1\n");
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, "\n\n");
  cleaned = cleaned.trim();
  return cleaned;
}
