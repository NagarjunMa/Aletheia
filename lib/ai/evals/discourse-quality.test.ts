import { describe, expect, it } from "vitest";
import {
  allowedClaimTexts,
  type AtomicSource,
} from "@/modules/grounding/domain/atomic-claim";
import { evaluateOutreachDiscourse } from "./outreach-discourse-quality";
import { evaluateApplicationDiscourse } from "./application-discourse-quality";
import type { DiscourseSample } from "./discourse-quality";

const fact =
  "I designed a fictional orchard sensor exercise using invented measurements, compared the expected warnings with the observed decisions, and documented the disagreements for a local classroom review, without deploying the exercise to real farms or claiming that its results measured customer outcomes, commercial reliability, or any actual changes in crop production.";
function fixture(
  category: DiscourseSample["category"] = "linkedin_connection",
): DiscourseSample {
  const source: AtomicSource = {
    id: "synthetic-candidate",
    rootId: "synthetic-root",
    scope: "candidate",
    kind: "action",
    content:
      category === "linkedin_connection"
        ? "I built a fictional orchard sensor exercise."
        : fact,
  };
  const target: AtomicSource = {
    id: "synthetic-target",
    scope: "target",
    kind: "target_observation",
    content: "Engineering Manager at Example | Applied AI",
    rewrite: "linkedin_profile_interest",
  };
  const targetText = allowedClaimTexts(target)[0]!;
  const claims = [source, target].map((s) => ({
    text: s.scope === "target" ? targetText : s.content,
    kind: s.kind,
    source_id: s.id,
    supporting_excerpt: s.content,
  }));
  return {
    id: "synthetic-control",
    category,
    emailMode: "follow_up",
    body: `Hi there, ${source.content} ${targetText} Open to connecting?`,
    claims,
    sources: [source, target],
    excludedClaims: [],
    targetRequired: true,
  };
}

describe("grounded discourse dimensions", () => {
  it("accepts a source-backed concise introduction", () => {
    expect(evaluateOutreachDiscourse(fixture()).violations).toEqual([]);
  });
  it("rejects unsupported generic praise instead of treating overlap as grounding", () => {
    const sample = fixture();
    sample.body = sample.body.replace(
      "Open to connecting?",
      "Your revolutionary work changed the industry. Open to connecting?",
    );
    const result = evaluateOutreachDiscourse(sample);
    expect(result.violations).toContain("factual_coverage");
    expect(result.unsupportedAssertionCount).toBeNull();
  });
  it("counts an invalid declared assertion without claiming a semantic count of hidden prose", () => {
    const sample = fixture();
    sample.claims[0]!.text = "I deployed commercial sensor systems.";
    const result = evaluateOutreachDiscourse(sample);
    expect(result.unsupportedAssertionCount).toBe(1);
    expect(result.factualCoverage).toBe(false);
  });
  it("requires the target claim in the actual body", () => {
    const sample = fixture();
    sample.body = `Hi there, ${sample.claims[0]!.text} Open to connecting?`;
    sample.claims = sample.claims.slice(0, 1);
    expect(evaluateOutreachDiscourse(sample).violations).toContain(
      "target_specificity",
    );
  });
  it("allows explicit target-only fallback without a candidate-introduction penalty", () => {
    const sample = fixture();
    sample.body = `Hi there, ${sample.claims[1]!.text} Open to connecting?`;
    sample.claims = sample.claims.slice(1);
    sample.sources = sample.sources.slice(1);
    const result = evaluateOutreachDiscourse(sample);
    expect(result.violations).toEqual([]);
    expect(result.diversityEligible).toBe(false);
  });
  it("distinguishes repeated optional explanation from complete source qualifications", () => {
    const sample = fixture();
    sample.body = sample.body.replace(
      "Open to connecting?",
      `${"I'd welcome a conversation. ".repeat(5)}Open to connecting?`,
    );
    expect(evaluateOutreachDiscourse(sample).violations).toContain(
      "explanation_budget",
    );
    const application = fixture("yc_application");
    application.body = fact;
    application.claims = application.claims.slice(0, 1);
    application.targetRequired = false;
    const result = evaluateApplicationDiscourse(application);
    expect(result.optionalFramingWords).toBe(0);
    expect(result.violations).toEqual([]);
  });
  it("detects repeated complete facts without penalizing mandatory proof labels", () => {
    const sample = fixture();
    sample.body = sample.body.replace(
      "Open to connecting?",
      `${sample.claims[0]!.text} Open to connecting?`,
    );
    expect(evaluateOutreachDiscourse(sample).duplicateFactCount).toBe(1);
    expect(evaluateOutreachDiscourse(sample).violations).toContain(
      "repetition",
    );
  });
  it("requires a complete final outreach invitation and no invitation in application answers", () => {
    const sample = fixture();
    sample.body = sample.body.replace("Open to connecting?", "Open to");
    expect(evaluateOutreachDiscourse(sample).violations).toContain("cta");
    const app = fixture("yc_application");
    app.body = `${fact} Open to connecting?`;
    app.claims = app.claims.slice(0, 1);
    app.targetRequired = false;
    expect(evaluateApplicationDiscourse(app).violations).toContain("cta");
  });
  it("does not let valid grounding conceal a broken greeting or channel limit", () => {
    const sample = fixture();
    sample.body = sample.body.replace("Hi there, ", "");
    expect(evaluateOutreachDiscourse(sample).violations).toContain(
      "channel_format",
    );
  });
  it("rejects excluded claims using canonical denial rules", () => {
    const sample = fixture();
    sample.excludedClaims = ["orchard"];
    expect(evaluateOutreachDiscourse(sample).factualCoverage).toBe(false);
  });
  it("bounds evaluation inputs without echoing private values", () => {
    const sample = fixture();
    sample.body = "PRIVATE_CANARY".repeat(1000);
    expect(() => evaluateOutreachDiscourse(sample)).toThrow(
      "Invalid offline evaluation sample",
    );
    const app = fixture();
    expect(() => evaluateApplicationDiscourse(app)).toThrow();
  });
});

it("ALE48-R1-001 charges surplus required framing and rejects misplaced application greetings", () => {
  const sample = fixture("yc_application");
  sample.body = fact + "\n\nHi there,";
  sample.claims = sample.claims.slice(0, 1);
  sample.targetRequired = false;
  expect(evaluateApplicationDiscourse(sample).violations).toContain(
    "channel_format",
  );
  const email = fixture("cold_email");
  email.subject = "A brief introduction";
  email.body = `Hi there,\n\n${"Hi there,\n\n".repeat(12)}${email.claims[0]!.text}\n\n${email.claims[1]!.text}\n\nOpen to connecting?`;
  const result = evaluateOutreachDiscourse(email);
  expect(result.optionalFramingWords).toBe(24);
  expect(result.violations).toContain("channel_format");
  expect(result.violations).toContain("explanation_budget");
});
it("ALE48-R1-002 keeps output-limit classification separate from source/safety failures", () => {
  const sample = fixture("cold_email");
  sample.subject = Array(10).fill("A brief introduction").join(" ");
  sample.body = `Hi there,\n\n${sample.claims[0]!.text} ${sample.claims[1]!.text}\n\nOpen to connecting?`;
  const result = evaluateOutreachDiscourse(sample);
  expect(result.factualCoverage).toBe(true);
  expect(result.unsupportedAssertionCount).toBe(0);
  expect(result.violations).toContain("channel_format");
  sample.subject = "UNSUPPORTED_ASSERTION ".repeat(20);
  expect(evaluateOutreachDiscourse(sample).factualCoverage).toBe(false);
});

it.each(["Best,", "Thanks,"])(
  "ALE48-R1-001 applies canonical application framing policy to terminal %s",
  (closing) => {
    const sample = fixture("yc_application");
    sample.body = fact + "\n\n" + closing;
    sample.claims = sample.claims.slice(0, 1);
    sample.targetRequired = false;
    expect(evaluateApplicationDiscourse(sample).violations).toContain(
      "channel_format",
    );
  },
);
