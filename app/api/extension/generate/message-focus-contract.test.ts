import { describe, expect, it } from "vitest";
import { generateRequestContractSchema, generateRequestSchema } from "./schema";

const payload = {
  category: "linkedin_connection",
  profileMarkdown: "Synthetic recipient profile for contract testing.",
};

describe.each([
  ["active parser", generateRequestSchema],
  ["compatibility contract", generateRequestContractSchema],
] as const)("Message focus: %s", (_name, schema) => {
  it.each(["linkedin_connection", "cold_email", "linkedin_inmail"])(
    "retains normalized intent for %s without changing legacy fields",
    (category) => {
      expect(
        schema.parse({
          ...payload,
          category,
          messageFocus: "  Ｅｖａｌｓ\r\nReliability\rTesting  ",
          jd: "Original job description",
          profileUrl: "https://example.test/obsolete",
        }),
      ).toMatchObject({
        category,
        messageFocus: "Evals\nReliability\nTesting",
        jd: "Original job description",
      });
    },
  );

  it.each([undefined, "", " \t\r\n\u3000 "])(
    "preserves the serialized legacy request for absent/blank focus %#",
    (messageFocus) => {
      expect(JSON.stringify(schema.parse({ ...payload, messageFocus }))).toBe(
        JSON.stringify(schema.parse(payload)),
      );
    },
  );

  it.each(["a".repeat(500), "😀".repeat(250), "\ufb03".repeat(166) + "ab"])(
    "accepts exactly 500 normalized UTF-16 units %#",
    (messageFocus) => {
      expect(schema.parse({ ...payload, messageFocus })).toHaveProperty(
        "messageFocus",
        messageFocus.normalize("NFKC"),
      );
    },
  );

  it.each([
    "a".repeat(501),
    " ".repeat(501),
    " ".repeat(500) + "a",
    "😀".repeat(250) + "a",
    "\ufb03".repeat(167),
    null,
    1,
    false,
    ["evals"],
    { topic: "evals" },
  ])("rejects invalid or raw/normalized oversized focus %#", (messageFocus) => {
    expect(schema.safeParse({ ...payload, messageFocus }).success).toBe(false);
  });

  it("keeps obsolete/unknown outreach fields stripped, not newly strict", () => {
    const result = schema.parse({
      ...payload,
      profileUrl: "https://example.test/obsolete",
      focusWeight: 999999,
    });
    expect(result).not.toHaveProperty("profileUrl");
    expect(result).not.toHaveProperty("focusWeight");
  });
});

describe("Message focus is not a YC field", () => {
  it.each([
    { question: "Why do you want to join this company?" },
    { questions: ["Why do you want to join this company?"] },
    {
      questions: Array.from(
        { length: 5 },
        (_, i) => `Describe experience number ${i + 1}?`,
      ),
    },
  ])("preserves the supported YC request but rejects focus %#", (question) => {
    const request = {
      category: "yc_application",
      jd: "Synthetic job description about building reliable products. ".repeat(
        2,
      ),
      ...question,
    };
    expect(generateRequestContractSchema.safeParse(request).success).toBe(true);
    for (const messageFocus of ["evals", "", null]) {
      expect(
        generateRequestContractSchema.safeParse({ ...request, messageFocus })
          .success,
      ).toBe(false);
    }
  });
});
