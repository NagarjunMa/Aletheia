import { it, expect, vi } from "vitest";
import { feedbackSchema } from "./schema";
import { persistFeedback } from "./persist-feedback";
import { projectFeedbackMetadata } from "@/lib/ai/feedback-quality";
const id = "11111111-1111-4111-8111-111111111111";
it("accepts new bounded reasons and metadata-only reports while preserving legacy", () => {
  for (const reason of [
    "too_repetitive",
    "weak_target_relevance",
    "unsupported_feeling",
    "wrong_ask",
  ])
    expect(
      feedbackSchema.safeParse({
        message: "A reviewed draft.",
        category: "cold_email",
        approved: false,
        rejectionReason: reason,
      }).success,
    ).toBe(true);
  expect(
    feedbackSchema.safeParse({
      format: "quality_summary",
      category: "cold_email",
      generationId: id,
      approved: true,
    }).success,
  ).toBe(true);
  expect(
    feedbackSchema.safeParse({
      format: "quality_summary",
      category: "cold_email",
      generationId: id,
      approved: true,
      body: "PRIVATE_CANARY",
    }).success,
  ).toBe(false);
});
it("projects no private keys or arbitrary text in version/model/quality values", () => {
  const result = projectFeedbackMetadata({
    generationId: id,
    promptVersion: "PRIVATE_VERSION_CANARY",
    model: "PRIVATE_MODEL_CANARY",
    body: "PRIVATE_BODY_CANARY",
    claims: ["PRIVATE_CLAIM_CANARY"],
    profile: "PRIVATE_PROFILE_CANARY",
    quality: { version: 1, body: "PRIVATE_QUALITY_CANARY" },
  });
  expect(result).toEqual({ generationId: id });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});
it.each(["approved", "rejected", null])(
  "scopes a duplicate lookup to its owner and returns a stable %s outcome",
  async (outcome) => {
    const eq = vi.fn();
    eq.mockReturnValue({
      eq,
      abortSignal: () => ({
        maybeSingle: async () => ({
          data: outcome ? { feedback_type: outcome } : null,
          error: null,
        }),
      }),
    });
    const db = {
      from: vi.fn(() => ({
        insert: () => ({
          abortSignal: async () => ({ error: { code: "23505" } }),
        }),
        select: () => ({ eq }),
      })),
    };
    const result = await persistFeedback(db as never, {
      id,
      user_id: "owner",
      feedback_type: "approved",
      rating: 5,
      comment: null,
      metadata: {},
    });
    expect(eq).toHaveBeenCalledWith("user_id", "owner");
    expect(result.state).toBe(
      outcome === "approved" ? "duplicate" : "conflict",
    );
  },
);

it("turns thrown storage failures into retryable outcomes", async () => {
  const db = {
    from: () => ({
      insert: () => {
        throw new Error("PRIVATE_PROVIDER");
      },
    }),
  };
  await expect(
    persistFeedback(db as never, {
      id,
      user_id: "owner",
      feedback_type: "approved",
      rating: 5,
      comment: null,
      metadata: {},
    }),
  ).resolves.toEqual({ state: "unavailable" });
});

it.each(["legacy", "summary"])(
  "accepts weak evidence separately from target relevance in %s feedback",
  (format) => {
    const base = { category: "cold_email", approved: false };
    const payload =
      format === "legacy"
        ? {
            ...base,
            message: "Synthetic draft.",
            rejectionReason: "weak_evidence",
          }
        : {
            ...base,
            format: "quality_summary",
            generationId: id,
            qualityReason: "weak_evidence",
          };
    expect(feedbackSchema.safeParse(payload).success).toBe(true);
    expect(
      feedbackSchema.safeParse({ ...payload, approved: true }).success,
    ).toBe(format === "legacy");
  },
);
it("preserves the accepted legacy approval shape while reports count only rejections", () => {
  expect(
    feedbackSchema.safeParse({
      message: "Synthetic draft.",
      category: "cold_email",
      approved: true,
      rejectionReason: "too_generic",
    }).success,
  ).toBe(true);
});

it("keeps the canonical report aligned with supported quality reasons and email modes", async () => {
  const { readFile } = await import("node:fs/promises");
  const { QUALITY_REASONS } = await import("@/lib/ai/generation-quality");
  const query = await readFile(
    new URL(
      "../../../../docs/evals/quality-feedback-cohorts.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const reason of QUALITY_REASONS)
    expect(query).toContain(`'${reason}', count(*) FILTER`);
  const { EMAIL_MODES } = await import("@/lib/ai/email-formatter");
  for (const mode of EMAIL_MODES) expect(query).toContain(`'${mode}'`);
});
