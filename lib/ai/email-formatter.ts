export const EMAIL_MODES = [
  "initial_outreach",
  "follow_up",
  "clarification",
  "role_fit_summary",
  "referral_request",
] as const;

export type EmailMode = (typeof EMAIL_MODES)[number];

export const EMAIL_MODE_WORD_LIMITS: Record<
  EmailMode,
  { min: number; max: number }
> = {
  initial_outreach: { min: 80, max: 150 },
  follow_up: { min: 30, max: 90 },
  clarification: { min: 40, max: 90 },
  role_fit_summary: { min: 40, max: 110 },
  referral_request: { min: 70, max: 130 },
};

type EmailCategory = "cold_email" | "linkedin_inmail";

interface FormatEmailOptions {
  category: EmailCategory;
  mode: EmailMode;
}

function normalizeLineEndings(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function normalizeGreeting(body: string): string {
  return body
    .replace(
      /^(Hi\s+[^,\n]{1,80},)[ \t]+([\s\S]+)/i,
      (_match, greeting, rest) => {
        return `${greeting}\n\n${String(rest).trimStart()}`;
      },
    )
    .replace(
      /^(Hi\s+[^,\n]{1,80},)\n(?!\n)([\s\S]+)/i,
      (_match, greeting, rest) => {
        return `${greeting}\n\n${String(rest).trimStart()}`;
      },
    );
}

function normalizeConnectorHyphens(body: string): string {
  return body.replace(/\s[-–—]\s/g, ", ");
}

function normalizeInlineSignature(body: string): string {
  return body.replace(
    /\b(Thanks(?: either way)?|Best|Regards|Sincerely|Appreciate it either way)\.?\s+(Nagarjun(?: Mallesh)?)(?=\n|$)/gi,
    (_match, closing, name) => `${closing},\n${name}`,
  );
}

function capitalizeCtaStarts(body: string): string {
  return body.replace(
    /(^|\n\n|[.!?]\s+)(interested|would|if|happy|please)\b/g,
    (_match, prefix, word) =>
      `${prefix}${String(word).charAt(0).toUpperCase()}${String(word).slice(1)}`,
  );
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function splitSentences(paragraph: string): string[] {
  return (
    paragraph
      .match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
      ?.map((sentence) => sentence.trim()) ?? [paragraph.trim()]
  ).filter(Boolean);
}

function splitLongParagraph(paragraph: string, maxWords = 90): string[] {
  if (countWords(paragraph) <= maxWords) {
    return [paragraph];
  }

  const sentences = splitSentences(paragraph);
  const groups: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (current && countWords(next) > maxWords) {
      groups.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) {
    groups.push(current);
  }

  return groups;
}

function normalizeBodyParagraphs(body: string, mode: EmailMode): string {
  const greetingMatch = body.match(/^(Hi\s+[^,\n]{1,80},)\n\n([\s\S]*)$/i);
  const greeting = greetingMatch?.[1];
  const bodyAfterGreeting = greetingMatch?.[2];
  if (!greeting || !bodyAfterGreeting) {
    return body;
  }

  let remainder = bodyAfterGreeting.trim();

  const closingMatch = remainder.match(
    /\n\n((?:Thanks(?: either way)?|Best|Regards|Sincerely|Appreciate it either way),?\nNagarjun(?: Mallesh)?(?:\n(?:https?:\/\/\S+|[\w.-]+\.[a-z]{2,}\/\S+))?)$/i,
  );
  let closing = closingMatch?.[1];
  const closingIndex = closingMatch?.index;
  if (closing && closingIndex !== undefined) {
    remainder = remainder.slice(0, closingIndex).trim();
  }
  if (!closing) {
    const inlineClosingMatch = remainder.match(
      /\s+((?:Thanks(?: either way)?|Best|Regards|Sincerely|Appreciate it either way),?\nNagarjun(?: Mallesh)?(?:\n(?:https?:\/\/\S+|[\w.-]+\.[a-z]{2,}\/\S+))?)$/i,
    );
    closing = inlineClosingMatch?.[1];
    const inlineClosingIndex = inlineClosingMatch?.index;
    if (closing && inlineClosingIndex !== undefined) {
      remainder = remainder.slice(0, inlineClosingIndex).trim();
    }
  }

  remainder = remainder
    .replace(/\n+/g, " ")
    .replace(/\s+(On the technical side,)/gi, "\n\n$1")
    .replace(/\s+(Technically,)/gi, "\n\n$1")
    .replace(/\s+(In terms of\b)/gi, "\n\n$1")
    .replace(/\s+(Interested in\b|Would you\b|If this\b)/gi, "\n\n$1")
    .replace(/\s+(Please advise\b)/gi, "\n\n$1");

  const targetParagraphMax = mode === "role_fit_summary" ? 75 : 90;
  const paragraphs = remainder
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => splitLongParagraph(paragraph, targetParagraphMax));

  return [greeting, ...paragraphs, closing]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

export function getEmailWordLimit(
  category: EmailCategory,
  mode: EmailMode,
): { min: number; max: number } {
  const modeLimit = EMAIL_MODE_WORD_LIMITS[mode];
  if (category === "linkedin_inmail") {
    return {
      min: Math.min(modeLimit.min, 80),
      max: Math.min(modeLimit.max, 120),
    };
  }
  return modeLimit;
}

export function formatGeneratedEmailBody(
  body: string,
  options: FormatEmailOptions,
): string {
  return normalizeBodyParagraphs(
    capitalizeCtaStarts(
      normalizeInlineSignature(
        normalizeConnectorHyphens(
          normalizeGreeting(normalizeLineEndings(body)),
        ),
      ),
    ),
    options.mode,
  );
}
