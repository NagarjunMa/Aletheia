import { describe, expect, it } from "vitest";
import { resolveOutputConstraint } from "@/lib/ai/output-constraints";
import {
  finalizeGroundedOutput,
  prepareGroundedText,
} from "./finalize-grounded-output";

const fact = "I built tools.";
const source = {
  id: "candidate:synthetic",
  scope: "candidate" as const,
  kind: "action" as const,
  content: fact,
};
const claim = {
  text: fact,
  kind: source.kind,
  source_id: source.id,
  supporting_excerpt: fact,
};
const defaults = {
  body: fact,
  platform: "linkedin" as const,
  bodyConstraint: resolveOutputConstraint({ category: "linkedin_connection" }),
  claims: [claim],
  sources: [source],
  excludedClaims: [],
};
function words(count: number) {
  return [
    ...Array(Math.floor(count / 3)).fill(fact),
    ...Array(count % 3).fill("Thanks,"),
  ].join(" ");
}
describe("exact final grounded output", () => {
  it.each(["cold_email", "linkedin_inmail", "yc_application"] as const)(
    "enforces %s limits after final grounding, without truncation",
    (category) => {
      const constraint = resolveOutputConstraint({
        category,
        emailMode: "initial_outreach",
      });
      for (const size of [constraint.minimum, constraint.maximum]) {
        const body = words(size);
        expect(() =>
          finalizeGroundedOutput({
            ...defaults,
            body,
            bodyConstraint: constraint,
          }),
        ).not.toThrow();
        expect(body.split(/\s+/u)).toHaveLength(size);
      }
      for (const size of [constraint.minimum - 1, constraint.maximum + 1]) {
        expect(() =>
          finalizeGroundedOutput({
            ...defaults,
            body: words(size),
            bodyConstraint: constraint,
          }),
        ).toThrow(
          expect.objectContaining({ code: "OUTPUT_LIMIT", actualCount: size }),
        );
      }
    },
  );
  it("enforces actual final character counts even when all added text is neutral", () => {
    const body = `${fact} ${"Hi there, ".repeat(40)}`.trim();
    expect(() => finalizeGroundedOutput({ ...defaults, body })).toThrow(
      expect.objectContaining({
        code: "OUTPUT_LIMIT",
        actualCount: body.length,
      }),
    );
  });
  it.each([
    { body: `${fact} I managed teams.`, code: "CLAIM_COVERAGE" },
    { body: "I built platforms.", code: "CLAIM_COVERAGE" },
    {
      body: fact,
      claims: [{ ...claim, source_id: "unknown" }],
      code: "CLAIM_SOURCE",
    },
    {
      body: fact,
      claims: [{ ...claim, supporting_excerpt: "I built" }],
      code: "CLAIM_SUPPORT",
    },
    { body: fact, excludedClaims: ["tools"], code: "CLAIM_EXCLUDED" },
    {
      body: fact,
      requiredEnding: "Open to connecting?",
      code: "CLAIM_COVERAGE",
    },
  ])(
    "rejects final mutation or evidence failure $code",
    ({ code, ...overrides }) => {
      expect(() =>
        finalizeGroundedOutput({ ...defaults, ...overrides }),
      ).toThrow(expect.objectContaining({ code }));
    },
  );
  it("does not let old component coverage hide a removed final-body fact", () => {
    expect(() =>
      finalizeGroundedOutput({
        ...defaults,
        body: "Hi there,",
        scopedFields: [{ text: fact, scope: "candidate" }],
      }),
    ).toThrow(expect.objectContaining({ code: "CLAIM_COVERAGE" }));
  });
  it("retains target versus candidate scopes in the components", () => {
    expect(() =>
      finalizeGroundedOutput({
        ...defaults,
        scopedFields: [{ text: fact, scope: "target" }],
      }),
    ).toThrow(expect.objectContaining({ code: "CLAIM_COVERAGE" }));
  });
  it("permits only the complete terminal server-owned signature", () => {
    const trustedIdentity = {
      fullName: "Synthetic",
      linkedinUrl: "https://example.test/profile",
    };
    const body = `${fact}\n\nBest,\nSynthetic\nhttps://example.test/profile`;
    expect(() =>
      finalizeGroundedOutput({ ...defaults, body, trustedIdentity }),
    ).not.toThrow();
    for (const mutated of [
      body.replace("Best,", "Regards,"),
      body.replace("Synthetic", "Another"),
      `${body}\nExtra claim.`,
    ]) {
      expect(() =>
        finalizeGroundedOutput({ ...defaults, body: mutated, trustedIdentity }),
      ).toThrow(expect.objectContaining({ code: "CLAIM_COVERAGE" }));
    }
  });
  it("rejects subject expansion beyond its final character contract", () => {
    const raw = `I ${"ﬃ".repeat(54)}.`;
    const subject = prepareGroundedText(raw);
    const subjectSource = {
      id: "candidate:subject",
      scope: "candidate" as const,
      kind: "action" as const,
      content: raw,
    };
    expect(raw.length).toBeLessThanOrEqual(160);
    expect(subject.length).toBe(165);
    expect(() =>
      finalizeGroundedOutput({
        ...defaults,
        body: words(120),
        subject,
        bodyConstraint: resolveOutputConstraint({
          category: "cold_email",
          emailMode: "initial_outreach",
        }),
        sources: [source, subjectSource],
        claims: [
          claim,
          {
            text: raw,
            source_id: subjectSource.id,
            kind: subjectSource.kind,
            supporting_excerpt: raw,
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining({ code: "OUTPUT_LIMIT", actualCount: 165 }),
    );
  });
  it("prepares encoding and outer whitespace without altering paragraphs, URLs or quoted CLI arguments", () => {
    const original =
      '  I used TypeScript v5.6 --name="two  spaces".\r\n\r\nhttps://example.test/v1?q=two--words&v=1.2  ';
    const expected =
      'I used TypeScript v5.6 --name="two  spaces".\n\nhttps://example.test/v1?q=two--words&v=1.2';
    expect(prepareGroundedText(original)).toBe(expected);
    expect(prepareGroundedText(original).length).toBe(expected.length);
    const unicode = "I built ﬃ tools.";
    expect(prepareGroundedText(unicode).length).toBe(unicode.length + 2);
  });
});
