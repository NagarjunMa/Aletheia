import { z } from "zod";
import {
  DISCOURSE_DIMENSIONS,
  discourseSampleSchema,
  type DiscourseEvaluation,
} from "./discourse-quality";
export const discourseFixtureSchema = discourseSampleSchema.extend({
  expectedViolations: z.array(z.enum(DISCOURSE_DIMENSIONS)).max(6),
});
export function parseDiscourseFixtures(input: unknown) {
  const parsed = z
    .array(discourseFixtureSchema)
    .min(1)
    .max(128)
    .safeParse(input);
  if (
    !parsed.success ||
    new Set(parsed.data.map((s) => s.id)).size !== parsed.data.length
  )
    throw new Error("Invalid synthetic fixture set");
  const serialized = JSON.stringify(parsed.data);
  const phone =
    /(?:\+\d{1,3}[ -]?)?(?:\(\d{2,4}\)[ .-]?|\b\d{2,4}[ .-])\d{3,4}[ .-]\d{3,4}\b|\b\d{10,15}\b/u;
  if (
    phone.test(serialized) ||
    /https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:sk-ant-|sb_secret_|eyJ[A-Za-z0-9_-]{20})|aletheia\.live|supabase\.co|nagarjun|mallesh/iu.test(
      serialized,
    )
  )
    throw new Error("Synthetic fixture privacy check failed");
  return parsed.data;
}
function dominant(values: readonly (string | number | null)[]) {
  const counts = new Map<string, number>();
  for (const value of values)
    counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  const numerator = Math.max(0, ...counts.values());
  return {
    numerator,
    denominator: values.length,
    rate: values.length ? numerator / values.length : null,
  };
}
export function summarizeDiscourse(
  evaluations: readonly DiscourseEvaluation[],
) {
  if (evaluations.length > 128)
    throw new Error("Offline corpus exceeds its bound");
  const groups = new Map<string, DiscourseEvaluation[]>();
  for (const result of evaluations) {
    const key = `${result.category}/${result.emailMode}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, rows]) => {
      const eligible = rows.filter((r) => r.diversityEligible);
      const pattern = dominant(eligible.map((r) => r.pattern));
      return {
        group,
        count: rows.length,
        opening: dominant(rows.map((r) => r.opening)),
        cta: dominant(
          rows.filter((r) => r.ctaTemplate !== null).map((r) => r.ctaTemplate),
        ),
        pattern,
        harmfulPattern: eligible.length >= 3 && (pattern.rate ?? 0) > 0.75,
        diversityEvidence:
          eligible.length >= 3
            ? ("measured" as const)
            : ("insufficient" as const),
      };
    });
}
