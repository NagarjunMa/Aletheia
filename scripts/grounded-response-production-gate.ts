import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

export async function runGroundedResponsePreflight() {
  const { default: savedBaseline } = await import(
    "../docs/evals/grounded-response-baseline.json",
    { with: { type: "json" } }
  );
  const {
    buildRhetoricalDiscourseVariant,
    compareDiscourseVariant,
    runDiscourseBaseline,
  } = await import("../lib/ai/evals/grounded-discourse-report");
  const baseline = runDiscourseBaseline();
  const comparison = compareDiscourseVariant(buildRhetoricalDiscourseVariant());
  const checks = {
    baselineMatches: isDeepStrictEqual(baseline, savedBaseline),
    baselineControlsPass: baseline.expectedPropertyChecks.every(
      (check) => check.expectedPropertiesMet,
    ),
    safetyAndObligations: comparison.safetyAndObligations,
    negativeControlsPreserved: comparison.negativeControlsPreserved,
    diversityImproved: comparison.diversityImproved,
  };

  return {
    schemaVersion: 1,
    mode: "offline_preflight",
    releaseDecision: "hold",
    offlinePassed: Object.values(checks).every(Boolean),
    providerCalls: 0,
    fixtureFingerprint: baseline.fixtureFingerprint,
    checks,
    patternDeltas: baseline.groups.map((before) => {
      const after = comparison.groups.find(
        (group) => group.group === before.group,
      );
      const baselineRate = before.pattern.rate;
      const candidateRate = after?.pattern.rate ?? null;
      return {
        group: before.group,
        baselineRate,
        candidateRate,
        baselineSamples: before.pattern.denominator,
        candidateSamples: after?.pattern.denominator ?? 0,
        deltaPercentagePoints:
          baselineRate === null || candidateRate === null
            ? null
            : Number(((candidateRate - baselineRate) * 100).toFixed(2)),
      };
    }),
    pendingEvidence: [
      "isolated_flag_comparison",
      "grounding_and_refunds",
      "privacy_log_audit",
      "latency_tokens_and_cost",
      "human_outcomes",
      "release_approval",
    ],
  } as const;
}

async function main() {
  try {
    if (process.argv.length !== 2) throw new Error("Unexpected arguments");
    const report = await runGroundedResponsePreflight();
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!report.offlinePassed) process.exitCode = 1;
  } catch {
    process.stderr.write("Grounded response offline preflight failed.\n");
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
