// Pure-function style analysis for the voice learning feedback loop.
// No I/O, no external deps — all regex-based heuristics.

export interface StylePatterns {
  avgSentenceLength: number;
  formality: number; // 0 (casual) – 100 (formal)
  greetingStyle: string; // e.g. "Hi", "Hey", "Hello"
  closingStyle: string; // e.g. "Best", "Thanks", "Cheers"
  useContractions: boolean;
  questionCount: number;
  commonPhrases: string[];
}

const GREETING_RE = /^(hi|hey|hello|dear|greetings)\b/i;
const CLOSING_RE =
  /\b(best|thanks|cheers|regards|sincerely|appreciate)[^.]*\.?\s*$/im;

const FORMAL_MARKERS = [
  "therefore",
  "furthermore",
  "consequently",
  "accordingly",
  "regarding",
  "pursuant",
  "hereby",
  "notwithstanding",
  "whom",
  "shall",
  "moreover",
  "nevertheless",
];

const INFORMAL_MARKERS = [
  "hey",
  "yeah",
  "cool",
  "awesome",
  "totally",
  "btw",
  "tbh",
  "imo",
  "gonna",
  "wanna",
  "gotta",
];

/**
 * Extract style patterns from a single approved message.
 */
export function analyzeStyle(message: string): StylePatterns {
  const sentences = message.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = message.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length || 1;

  // Average sentence length
  const avgSentenceLength = Math.round(
    sentences.reduce(
      (sum, s) => sum + s.split(/\s+/).filter((w) => w.length > 0).length,
      0,
    ) / (sentences.length || 1),
  );

  // Formality score
  let formalCount = 0;
  let informalCount = 0;
  const lc = message.toLowerCase();

  for (const marker of FORMAL_MARKERS) {
    if (new RegExp(`\\b${marker}\\b`, "i").test(lc)) formalCount++;
  }
  for (const marker of INFORMAL_MARKERS) {
    if (new RegExp(`\\b${marker}\\b`, "i").test(lc)) informalCount++;
  }

  // Contractions push toward informal
  const contractions = message.match(/\b\w+[''](?:ll|re|ve|d|t|s|m)\b/gi) || [];
  const contractionRatio = contractions.length / totalWords;
  const useContractions = contractionRatio > 0.02;

  if (useContractions) informalCount += 2;

  // Score: 50 is neutral, formal markers push up, informal push down
  const rawFormality =
    50 + formalCount * 10 - informalCount * 10 - contractionRatio * 100;
  const formality = Math.max(0, Math.min(100, Math.round(rawFormality)));

  // Greeting
  const greetingMatch = message.match(GREETING_RE);
  const greetingStyle: string = greetingMatch?.[1] ?? "";

  // Closing
  const closingMatch = message.match(CLOSING_RE);
  const closingStyle: string = closingMatch?.[1] ?? "";

  // Questions
  const questionCount = (message.match(/\?/g) || []).length;

  // Common 2-3 word phrases (bigrams/trigrams that appear naturally)
  const commonPhrases = extractCommonPhrases(message);

  return {
    avgSentenceLength,
    formality,
    greetingStyle,
    closingStyle,
    useContractions,
    questionCount,
    commonPhrases,
  };
}

/**
 * Weighted merge of existing style patterns with incoming patterns.
 * New data gets `weight` influence (default 20%), existing keeps rest.
 */
export function mergeStylePatterns(
  existing: StylePatterns,
  incoming: StylePatterns,
  weight = 0.2,
): StylePatterns {
  const keep = 1 - weight;

  return {
    avgSentenceLength: Math.round(
      existing.avgSentenceLength * keep + incoming.avgSentenceLength * weight,
    ),
    formality: Math.round(
      existing.formality * keep + incoming.formality * weight,
    ),
    greetingStyle: incoming.greetingStyle || existing.greetingStyle,
    closingStyle: incoming.closingStyle || existing.closingStyle,
    useContractions: incoming.useContractions, // latest signal wins for booleans
    questionCount: Math.round(
      existing.questionCount * keep + incoming.questionCount * weight,
    ),
    commonPhrases: mergePhraseLists(
      existing.commonPhrases,
      incoming.commonPhrases,
    ),
  };
}

// ─── Internal helpers ───

function extractCommonPhrases(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const bigrams: Record<string, number> = {};

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    bigrams[bigram] = (bigrams[bigram] || 0) + 1;
  }

  return Object.entries(bigrams)
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);
}

function mergePhraseLists(existing: string[], incoming: string[]): string[] {
  const combined = new Map<string, number>();
  // Guard: Supabase JSONB can deserialize as null even when typed as string[]
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];

  for (const p of safeExisting) combined.set(p, (combined.get(p) || 0) + 2);
  for (const p of safeIncoming) combined.set(p, (combined.get(p) || 0) + 1);

  return [...combined.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([phrase]) => phrase);
}
