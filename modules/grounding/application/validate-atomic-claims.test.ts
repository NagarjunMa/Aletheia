import { describe, expect, it } from "vitest";
import { validateAtomicOutput } from "./validate-atomic-claims";

const source = {
  id: "profile.current_responsibilities",
  scope: "candidate",
  kind: "action",
  content: "I supported the rollout; I did not lead it.",
} as const;
const claim = {
  text: source.content,
  kind: "action",
  source_id: source.id,
  supporting_excerpt: source.content,
};
const run = (overrides: Record<string, unknown> = {}) =>
  validateAtomicOutput({
    claims: [claim],
    sources: [source],
    excludedClaims: [],
    fields: [{ text: claim.text, scope: "candidate" }],
    ...overrides,
  });

describe("atomic final-output provenance", () => {
  it("accepts a complete supported claim", () =>
    expect(() => run()).not.toThrow());
  it.each([
    { ...claim, source_id: "unknown" },
    { ...claim, supporting_excerpt: "I led the rollout." },
    { ...claim, text: "I led the rollout." },
    {
      ...claim,
      text: "I supported the rollout",
      supporting_excerpt: "I supported the rollout",
    },
    { ...claim, kind: "outcome" },
    {
      ...claim,
      supporting_excerpt: "I supported the rollout I did not lead it.",
    },
    { ...claim, text: "I supported the rollоut; I did not lead it." },
  ])("rejects unsupported, misclassified or partial claims %#", (invalid) => {
    expect(() =>
      run({
        claims: [invalid],
        fields: [{ text: invalid.text, scope: "candidate" }],
      }),
    ).toThrow();
  });
  it("rejects another source's excerpt", () => {
    expect(() =>
      run({ sources: [{ ...source, content: "I write documentation." }] }),
    ).toThrow();
  });
  it("rejects hidden claims even when the declared ledger is valid", () => {
    expect(() =>
      run({
        fields: [
          {
            text: `${claim.text} I increased revenue by 90%.`,
            scope: "candidate",
          },
        ],
      }),
    ).toThrow();
  });
  it("rejects excluded statements", () =>
    expect(() => run({ excludedClaims: ["supported the rollout"] })).toThrow());
  it("rejects target evidence used as a candidate assertion", () => {
    expect(() =>
      run({
        sources: [{ ...source, scope: "target", kind: "target_observation" }],
      }),
    ).toThrow();
  });
  it("rejects candidate claims without candidate sources", () =>
    expect(() => run({ sources: [] })).toThrow());
  it("permits documented Unicode/whitespace equivalence", () => {
    expect(() =>
      run({
        sources: [
          {
            ...source,
            content: "Ｉ supported\r\n the rollout; I did not lead it.",
          },
        ],
      }),
    ).not.toThrow();
  });
  it("permits a neutral target-only invitation", () => {
    expect(() =>
      run({
        claims: [],
        sources: [],
        fields: [{ text: "Open to connecting?", scope: "target" }],
      }),
    ).not.toThrow();
  });
  it("rejects an unused ledger entry", () => {
    expect(() =>
      run({ fields: [{ text: "Open to connecting?", scope: "candidate" }] }),
    ).toThrow();
  });
  it("rejects unknown keys and oversized raw strings", () => {
    expect(() => run({ claims: [{ ...claim, secret: "no" }] })).toThrow();
    expect(() =>
      run({ claims: [{ ...claim, text: " ".repeat(10001) + claim.text }] }),
    ).toThrow();
  });
  it("does not turn target first-person text into the candidate's experience", () => {
    const target = {
      id: "target.profile.0",
      scope: "target" as const,
      kind: "target_observation" as const,
      content: "I led the launch.",
    };
    const quoted = 'The supplied context says: "I led the launch."';
    const evidence = {
      text: quoted,
      kind: target.kind,
      source_id: target.id,
      supporting_excerpt: target.content,
    };
    expect(() =>
      run({
        sources: [target],
        claims: [evidence],
        fields: [{ text: quoted, scope: "target" }],
      }),
    ).not.toThrow();
    expect(() =>
      run({
        sources: [target],
        claims: [{ ...evidence, text: target.content }],
        fields: [{ text: target.content, scope: "candidate" }],
      }),
    ).toThrow();
  });
  it("allows only the typed current-role rewrite", () => {
    const role = {
      id: "profile.current_role.value",
      scope: "candidate" as const,
      kind: "role" as const,
      content: "Engineer",
      rewrite: "current_role" as const,
    };
    const text = "My current role is Engineer.";
    const claims = [
      {
        text,
        kind: "role",
        source_id: role.id,
        supporting_excerpt: "Engineer",
      },
    ];
    expect(() =>
      run({ sources: [role], claims, fields: [{ text, scope: "candidate" }] }),
    ).not.toThrow();
    expect(() =>
      run({
        sources: [{ ...role, rewrite: undefined }],
        claims,
        fields: [{ text, scope: "candidate" }],
      }),
    ).toThrow();
  });
  it("bounds aggregate ledger size and count", () => {
    expect(() => run({ claims: Array(13).fill(claim) })).toThrow();
    const long = {
      ...claim,
      text: "a".repeat(600),
      supporting_excerpt: "a".repeat(600),
    };
    expect(() => run({ claims: Array(6).fill(long) })).toThrow();
  });
  it("does not include private values in validation errors", () => {
    try {
      run({
        claims: [
          {
            ...claim,
            source_id: "PRIVATE_SOURCE_CANARY",
            supporting_excerpt: "PRIVATE_EXCERPT_CANARY",
          },
        ],
      });
    } catch (error) {
      expect(String(error)).not.toContain("CANARY");
      expect(JSON.stringify(error)).not.toContain("CANARY");
      return;
    }
    throw new Error("Expected a validation failure");
  });
});
