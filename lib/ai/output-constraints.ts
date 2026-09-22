import { getEmailWordLimit, type EmailMode } from "@/lib/ai/email-formatter";

export type OutputConstraintUnit = "characters" | "words";
export type OutputConstraintCategory =
  "linkedin_connection" | "cold_email" | "linkedin_inmail" | "yc_application";

export interface OutputConstraint {
  category: OutputConstraintCategory;
  unit: OutputConstraintUnit;
  minimum: number;
  maximum: number;
}

export const LINKEDIN_CONNECTION_MAX_CHARACTERS = 300;
export const APPLICATION_ANSWER_MIN_WORDS = 50;
export const APPLICATION_ANSWER_MAX_WORDS = 150;

export function resolveOutputConstraint(input: {
  category: OutputConstraintCategory;
  emailMode?: EmailMode;
}): OutputConstraint {
  if (input.category === "linkedin_connection") {
    return {
      category: input.category,
      unit: "characters",
      minimum: 1,
      maximum: LINKEDIN_CONNECTION_MAX_CHARACTERS,
    };
  }

  if (input.category === "yc_application") {
    return {
      category: input.category,
      unit: "words",
      minimum: APPLICATION_ANSWER_MIN_WORDS,
      maximum: APPLICATION_ANSWER_MAX_WORDS,
    };
  }

  if (!input.emailMode) {
    throw new TypeError("emailMode is required for email output constraints");
  }

  const limit = getEmailWordLimit(input.category, input.emailMode);
  return {
    category: input.category,
    unit: "words",
    minimum: limit.min,
    maximum: limit.max,
  };
}

export function countOutputUnits(
  content: string,
  unit: OutputConstraintUnit,
): number {
  if (unit === "characters") return content.length;
  const normalized = content.trim();
  return normalized.length === 0 ? 0 : normalized.split(/\s+/u).length;
}

export function compareDeclaredOutputCount(input: {
  content: string;
  unit: OutputConstraintUnit;
  declaredCount: number;
}): { actualCount: number; matches: boolean } {
  const actualCount = countOutputUnits(input.content, input.unit);
  return {
    actualCount,
    matches: actualCount === input.declaredCount,
  };
}
