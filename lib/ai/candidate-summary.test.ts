import { describe, expect, it } from "vitest";
import { deriveSafeCandidateSummary } from "./candidate-summary";

describe("deriveSafeCandidateSummary", () => {
  it("keeps broad candidate context while removing contact details", () => {
    const summary = deriveSafeCandidateSummary(
      "Nagarjun Mallesh nagarjun@example.com +1 857 799 0214 backend engineer with 4+ years of experience building AWS, Terraform, Docker, Python, and RAG systems.",
    );

    expect(summary).toContain("High-level candidate summary");
    expect(summary).toContain("4+ years of experience");
    expect(summary).toContain("cloud infrastructure");
    expect(summary).not.toContain("nagarjun@example.com");
    expect(summary).not.toContain("857");
  });
});
