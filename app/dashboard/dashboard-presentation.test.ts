import { expect, it } from "vitest";
import {
  creditSummarySchema,
  categoryLabels,
  rejectionLabels,
} from "./dashboard-presentation";

it("preserves a real zero balance and projects only display-safe credit fields", () => {
  expect(
    creditSummarySchema.parse({
      balance: 0,
      creditExpiry: null,
      ledger: [{ private: "CANARY" }],
    }),
  ).toEqual({ balance: 0, unlimitedCredits: false, creditExpiry: null });
});
it("accepts unlimited access without inventing spending numbers", () => {
  expect(
    creditSummarySchema.parse({
      unlimitedCredits: true,
      balance: null,
      creditExpiry: null,
    }),
  ).toEqual({ unlimitedCredits: true, balance: null, creditExpiry: null });
});
it.each([
  {},
  { balance: null, creditExpiry: null },
  { balance: -1, creditExpiry: null },
  { balance: "12", creditExpiry: null },
  { unlimitedCredits: "yes", balance: null, creditExpiry: null },
])(
  "rejects unusable credit state instead of fabricating a zero: %j",
  (input) => {
    expect(creditSummarySchema.safeParse(input).success).toBe(false);
  },
);
it("covers all four channels and uses local labels for rejection reasons", () => {
  expect(Object.keys(categoryLabels)).toEqual([
    "linkedin_connection",
    "linkedin_inmail",
    "cold_email",
    "yc_application",
  ]);
  expect(rejectionLabels.unspecified).toBe("Reason not provided");
  expect(rejectionLabels.unsupported_claim).toBe("Unsupported claim");
});
