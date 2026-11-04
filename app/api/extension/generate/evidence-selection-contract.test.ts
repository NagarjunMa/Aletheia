import { describe, expect, it } from "vitest";
import {
  generateRequestContractSchema,
  generateRequestSchema,
  ycApplicationRequestSchema,
} from "./schema";

const first = "ae550000-1111-4111-8111-111111111111";
const second = "ae550000-2222-4222-8222-222222222222";
const third = "ae550000-3333-4333-8333-333333333333";
const profileMarkdown = "Synthetic recipient profile for contract testing.";
const jd =
  "Synthetic job description about building reliable products. ".repeat(2);
const question = "Why do you want to join this company?";

describe.each([
  [
    "LinkedIn",
    generateRequestSchema,
    { category: "linkedin_connection", profileMarkdown },
  ],
  [
    "cold email",
    generateRequestSchema,
    { category: "cold_email", profileMarkdown },
  ],
  [
    "InMail",
    generateRequestSchema,
    { category: "linkedin_inmail", profileMarkdown },
  ],
  [
    "legacy application",
    ycApplicationRequestSchema,
    { category: "yc_application", jd, question },
  ],
  [
    "application batch",
    ycApplicationRequestSchema,
    { category: "yc_application", jd, questions: [question] },
  ],
] as const)("ALE-55 %s request", (_name, schema, body) => {
  it("preserves an explicit selection in request order", () => {
    const request = {
      ...body,
      selectedEvidenceIds: [second.toUpperCase(), first],
    };
    for (const parser of [schema, generateRequestContractSchema]) {
      expect(parser.parse(request)).toMatchObject({
        selectedEvidenceIds: [second, first],
      });
    }
  });

  it("keeps requests without selections on the existing path", () => {
    for (const parser of [schema, generateRequestContractSchema]) {
      expect(
        JSON.stringify(parser.parse({ ...body, selectedEvidenceIds: [] })),
      ).toBe(JSON.stringify(parser.parse(body)));
    }
  });

  it.each([
    [null],
    [first],
    [[{ id: first }]],
    [["not-an-id"]],
    [[first, first.toUpperCase()]],
    [[first, second, third]],
  ])("rejects invalid selections %#", (selectedEvidenceIds) => {
    const request = { ...body, selectedEvidenceIds };
    expect(schema.safeParse(request).success).toBe(false);
    expect(generateRequestContractSchema.safeParse(request).success).toBe(
      false,
    );
  });
});

it("rejects an over-limit list before reporting per-item errors", () => {
  const result = generateRequestSchema.safeParse({
    category: "linkedin_connection",
    profileMarkdown,
    selectedEvidenceIds: Array(100).fill("invalid"),
  });
  expect(result.error?.issues).toEqual([
    expect.objectContaining({ code: "too_big", path: ["selectedEvidenceIds"] }),
  ]);
});
