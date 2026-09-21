import { describe, expect, it } from "vitest";
import { failureSchema, reviewActionSchema } from "./refund-review";
const id = "22222222-2222-4222-8222-222222222222";
describe("refund contracts", () => {
  it("keeps only bounded server failure evidence", () => {
    const input = {
      attemptId: id,
      userId: id,
      category: "yc_application",
      debitId: null,
      debitUncertain: false,
      code: "MODEL_TIMEOUT",
    };
    expect(failureSchema.parse(input)).toEqual(input);
    expect(
      failureSchema.safeParse({ ...input, prompt: "PRIVATE" }).success,
    ).toBe(false);
    expect(
      failureSchema.safeParse({ ...input, code: "PRIVATE_PROVIDER_ERROR" })
        .success,
    ).toBe(false);
  });
  it("requires reasons and excludes client-controlled credit amounts", () => {
    expect(
      reviewActionSchema.safeParse({ action: "reject", note: " " }).success,
    ).toBe(false);
    expect(
      reviewActionSchema.safeParse({
        action: "approve",
        note: "Reviewed",
        amount: 100,
      }).success,
    ).toBe(false);
    expect(
      reviewActionSchema.safeParse({
        action: "comment",
        note: "x".repeat(1001),
      }).success,
    ).toBe(false);
    expect(
      reviewActionSchema.parse({ action: "approve", note: " Reviewed " }),
    ).toEqual({ action: "approve", note: "Reviewed" });
  });
});
