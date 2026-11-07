import { buildYcPlannedOptions } from "@/modules/application-answer/application/yc-rhetorical-options";
import { createHash } from "node:crypto";
import outreachCases from "./outreach-discourse-golden-cases.json";
import applicationCases from "./application-discourse-golden-cases.json";
import { parseDiscourseFixtures, summarizeDiscourse } from "./discourse-corpus";
import { evaluateDiscourse, type DiscourseSample } from "./discourse-quality";
import { buildProseCompositions } from "@/modules/outreach/application/prose-compositions";
import {
  buildLinkedinCompositions,
  buildLinkedinSelectionTool,
  resolveLinkedinSelection,
} from "@/modules/outreach/domain/linkedin-grounded-selection";
import { renderLinkedinConnection } from "@/modules/outreach/application/render-linkedin-connection";
import {
  OUTREACH_GROUNDING_BUDGETS,
  type OutreachGroundingContext,
} from "@/modules/outreach/domain/outreach-grounding.types";
import {
  getSystemPrompt,
  PROMPT_VERSION,
} from "@/lib/ai/prompts/linkedin-connection";
import {
  buildYcApplicationPrompt,
  YC_APPLICATION_PROMPT_VERSION,
} from "@/lib/ai/prompts/yc-application";
import { getAtomicProvenanceInstructions } from "@/lib/ai/prompts/atomic-provenance";
import {
  CLAUDE_MODEL,
  OUTREACH_GENERATION_SETTINGS,
  getOutreachOutputBudget,
} from "@/modules/outreach/infrastructure/anthropic.repository";
import {
  YC_GENERATION_SETTINGS,
  getApplicationOutputBudget,
} from "@/modules/application-answer/infrastructure/anthropic-yc.repository";

export const lockedDiscourseFixtures = parseDiscourseFixtures([
  ...outreachCases,
  ...applicationCases,
]);
function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function outputInput(
  fixture: (typeof lockedDiscourseFixtures)[number],
): DiscourseSample {
  const { expectedViolations: _expected, ...sample } = fixture;
  return sample;
}
function serverOption(
  sample: DiscourseSample,
  rhetoricalPlans = false,
): DiscourseSample {
  const candidates = sample.sources.filter(
    (s) => s.scope === "candidate" && s.rootId,
  );
  const roots = [...new Set(candidates.map((s) => s.rootId!))];
  const context: OutreachGroundingContext = {
    identity: sample.identity ?? { fullName: "", linkedinUrl: "" },
    sources: roots.map((id) => ({
      id,
      type: "evidence",
      label: "Synthetic reviewed evidence",
      priority: 1,
      content: candidates
        .filter((s) => s.rootId === id)
        .map((s) => s.content)
        .join("\n"),
    })),
    atomicSources: sample.sources,
    // The locked discourse fixtures start after synthetic evidence selection.
    proseRelevantFactIds: new Set(candidates.map(({ id }) => id)),
    excludedClaims: sample.excludedClaims,
    metadata: {
      groundingLevel: candidates.length ? "verified_evidence" : "target_only",
      fallbackReason: candidates.length ? "none" : "no_confirmed_evidence",
      selectedSourceCount: roots.length,
      selectedEvidenceCount: roots.length,
      selectedSourceKinds: candidates.length ? ["evidence"] : [],
      injectionSafeMode: false,
    },
  };
  if (sample.category === "linkedin_connection") {
    const tool = buildLinkedinSelectionTool(
      sample.sources,
      undefined,
      "networking",
      rhetoricalPlans,
    );
    const option = buildLinkedinCompositions(
      sample.sources,
      "networking",
      rhetoricalPlans,
    )[0]!;
    const draft = resolveLinkedinSelection(
      {
        option_id: tool.input_schema.properties.option_id.enum[0],
        ...(option.rhetoricalPlan
          ? {
              rhetorical_plan: {
                reference: option.rhetoricalPlan.reference,
                archetype: option.rhetoricalPlan.archetype,
              },
            }
          : {}),
      },
      sample.sources,
      context.sources,
      "networking",
      rhetoricalPlans,
    );
    const rendered = renderLinkedinConnection({
      draft,
      sources: context.sources,
    });
    return { ...sample, body: rendered.body, claims: draft.claims };
  }
  if (sample.category === "yc_application") {
    if (!rhetoricalPlans) return sample;
    const option = buildYcPlannedOptions({
      question: "Synthetic evaluation question",
      jobDescription: "Synthetic evaluation context",
      sources: context.sources,
      atomicSources: sample.sources,
      excludedClaims: sample.excludedClaims,
      readiness: { ready: true, missingFields: [], recommendedFields: [] },
      metadata: {
        profileFieldCount: 1,
        confirmedEvidenceCount: roots.length,
        resumeSource: "none",
      },
    })[0]!.options[0]!;
    return { ...sample, body: option.body, claims: option.claims };
  }
  const option = buildProseCompositions({
    category: sample.category,
    emailMode: sample.emailMode,
    context,
    rhetoricalPlans,
  })[0]!;
  return {
    ...sample,
    body: option.body,
    subject: option.subject,
    claims: option.claims,
  };
}
function composedSystemPrompts() {
  const applicationSystem = (batch: boolean) =>
    buildYcApplicationPrompt({
      question: "Synthetic evaluation question",
      jobDescription: "Synthetic evaluation context",
      sources: [],
      atomicSources: [],
      excludedClaims: [],
      readiness: { ready: false, missingFields: [], recommendedFields: [] },
      metadata: {
        profileFieldCount: 0,
        confirmedEvidenceCount: 0,
        resumeSource: "none",
      },
      ...(batch
        ? {
            questions: Array.from({ length: 5 }, (_, index) => ({
              questionId: `q${index + 1}`,
              question: "Synthetic evaluation question",
              sourceIds: [],
            })),
          }
        : {}),
    }).systemPrompt;
  return [
    ...(["linkedin_connection", "cold_email", "linkedin_inmail"] as const).map(
      (category) =>
        `${getSystemPrompt(category)}\n\n${getAtomicProvenanceInstructions(category)}`,
    ),
    applicationSystem(false),
    applicationSystem(true),
  ];
}
export function runDiscourseBaseline() {
  const checks = lockedDiscourseFixtures.map((f) => {
    const result = evaluateDiscourse(outputInput(f));
    return {
      id: f.id,
      expectedPropertiesMet:
        JSON.stringify(result.violations) ===
        JSON.stringify(f.expectedViolations),
    };
  });
  const rows = lockedDiscourseFixtures
    .filter((f) => f.expectedViolations.length === 0)
    .map((f) => {
      const sample = outputInput(f);
      return {
        origin:
          sample.category === "yc_application"
            ? ("synthetic_reference_no_provider" as const)
            : ("first_server_option_no_provider" as const),
        ...evaluateDiscourse(serverOption(sample)),
      };
    });
  return {
    schemaVersion: 1,
    mode: "offline" as const,
    fixtureFingerprint: hash(lockedDiscourseFixtures),
    configuration: {
      outreachPromptVersion: PROMPT_VERSION,
      applicationPromptVersion: YC_APPLICATION_PROMPT_VERSION,
      model: CLAUDE_MODEL,
      temperatures: {
        outreach: OUTREACH_GENERATION_SETTINGS.temperature,
        application: YC_GENERATION_SETTINGS.temperature,
      },
      promptFingerprint: hash(composedSystemPrompts()),
      configuredOutputTokenCeilings: {
        connection: getOutreachOutputBudget("linkedin_connection"),
        prose: getOutreachOutputBudget("cold_email"),
        applicationSingle: getApplicationOutputBudget(),
        applicationFive: getApplicationOutputBudget(5),
      },
      configuredInputTokenCeiling: null,
      configuredSourceCharacterBudgets: OUTREACH_GROUNDING_BUDGETS,
      measuredProviderTokenUsage: null,
      providerCalls: 0,
    },
    expectedPropertyChecks: checks,
    rows,
    groups: summarizeDiscourse(rows),
    activation: "not_evaluated_offline_baseline" as const,
  };
}
export function compareDiscourseVariant(input: unknown) {
  const fixtures = parseDiscourseFixtures(input);
  if (fixtures.length !== lockedDiscourseFixtures.length)
    throw new Error("Variant does not match the locked fixture contract");
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  for (const locked of lockedDiscourseFixtures) {
    const candidate = byId.get(locked.id);
    const fixed = (value: typeof locked) => {
      const {
        body: _body,
        subject: _subject,
        claims: _claims,
        ...context
      } = value;
      return context;
    };
    if (!candidate || hash(fixed(candidate)) !== hash(fixed(locked)))
      throw new Error("Variant does not match the locked fixture contract");
  }
  const baseline = runDiscourseBaseline();
  const results = baseline.rows.map((row) =>
    evaluateDiscourse(outputInput(byId.get(row.id)!)),
  );
  const safetyAndObligations = results.every((result, index) => {
    const before = baseline.rows[index]!;
    return (
      result.violations.length === 0 &&
      result.unsupportedAssertionCount === 0 &&
      result.factualCoverage &&
      result.candidateReferenceCount >= before.candidateReferenceCount &&
      result.targetReferenceCount >= before.targetReferenceCount
    );
  });
  const groups = summarizeDiscourse(results);
  const relevant = baseline.groups.filter(
    (g) => g.diversityEvidence === "measured",
  );
  const diversityImproved =
    relevant.some((g) => g.harmfulPattern) &&
    relevant.every((before) => {
      const after = groups.find((g) => g.group === before.group);
      return (
        !!after &&
        after.diversityEvidence === "measured" &&
        after.pattern.denominator === before.pattern.denominator &&
        before.pattern.rate !== null &&
        after.pattern.rate !== null &&
        (before.harmfulPattern
          ? before.pattern.rate - after.pattern.rate >= 0.15
          : after.pattern.rate <= before.pattern.rate)
      );
    });
  const controls = fixtures
    .filter((f) => f.expectedViolations.length > 0)
    .every(
      (f) =>
        JSON.stringify(evaluateDiscourse(outputInput(f)).violations) ===
        JSON.stringify(f.expectedViolations),
    );
  return {
    schemaVersion: 1,
    fixtureFingerprint: baseline.fixtureFingerprint,
    configuration: baseline.configuration,
    mode: "offline_variant_comparison" as const,
    variantOrigin: "synthetic_proposed_outputs" as const,
    rows: results,
    groups,
    safetyAndObligations,
    negativeControlsPreserved: controls,
    diversityImproved,
    decision:
      safetyAndObligations && controls && diversityImproved
        ? ("eligible_for_human_and_provider_review" as const)
        : ("no_go" as const),
  };
}

/** Actual enabled server composers over immutable synthetic sources; negative controls remain unchanged. */
export function buildRhetoricalDiscourseVariant() {
  return lockedDiscourseFixtures.map((f) =>
    f.expectedViolations.length
      ? structuredClone(f)
      : { ...f, ...serverOption(f, true) },
  );
}
