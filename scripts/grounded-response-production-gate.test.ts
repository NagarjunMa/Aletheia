import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as discourse from "../lib/ai/evals/grounded-discourse-report";
import { runGroundedResponsePreflight } from "./grounded-response-production-gate";

function runPreflightCli(preload: string) {
  const directory = mkdtempSync(join(tmpdir(), "ale50-offline-"));
  try {
    const guard = join(directory, "preload.cjs");
    writeFileSync(guard, preload);
    return spawnSync(
      process.execPath,
      [
        "--require",
        guard,
        "--import",
        "tsx",
        "scripts/grounded-response-production-gate.ts",
      ],
      {
        encoding: "utf8",
        timeout: 10_000,
        env: { NODE_ENV: "test", LOG_LEVEL: "silent" },
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("grounded response gate offline preflight", () => {
  it("records the locked comparison and holds release when offline checks pass", async () => {
    const report = await runGroundedResponsePreflight();

    expect(report).toMatchObject({
      offlinePassed: true,
      releaseDecision: "hold",
      providerCalls: 0,
      checks: {
        baselineMatches: true,
        safetyAndObligations: true,
        negativeControlsPreserved: true,
        diversityImproved: true,
      },
    });
    expect(report.pendingEvidence).toContain("isolated_flag_comparison");
    expect(report.patternDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          baselineRate: 1,
          candidateRate: expect.any(Number),
          baselineSamples: expect.any(Number),
        }),
      ]),
    );
  });

  it("fails if the current disabled baseline drifts from the saved report", async () => {
    const baseline = discourse.runDiscourseBaseline();
    const runner = vi.spyOn(discourse, "runDiscourseBaseline").mockReturnValue({
      ...baseline,
      fixtureFingerprint: "drifted",
    });
    try {
      expect(await runGroundedResponsePreflight()).toMatchObject({
        offlinePassed: false,
        releaseDecision: "hold",
        checks: { baselineMatches: false },
      });
    } finally {
      runner.mockRestore();
    }
  });

  it("does not pass an unchanged template-heavy candidate", async () => {
    const variant = vi
      .spyOn(discourse, "buildRhetoricalDiscourseVariant")
      .mockReturnValue(discourse.lockedDiscourseFixtures);
    try {
      expect(await runGroundedResponsePreflight()).toMatchObject({
        offlinePassed: false,
        releaseDecision: "hold",
        checks: { diversityImproved: false },
      });
    } finally {
      variant.mockRestore();
    }
  });

  it("runs without credentials or network and prints only the evidence projection", () => {
    const { status, stdout } = runPreflightCli(
      "const deny=()=>{throw new Error('unexpected network')}; globalThis.fetch=deny; require('node:net').Socket.prototype.connect=deny;",
    );
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({
      offlinePassed: true,
      releaseDecision: "hold",
      providerCalls: 0,
    });
    expect(stdout).not.toMatch(
      /supporting_excerpt|source_id|"body"|fictional orchard/u,
    );
  });
  it("contains fixture loading failures without printing source identifiers", () => {
    const { status, stdout, stderr } = runPreflightCli(`
      require("node:module").registerHooks({
        load(url, context, nextLoad) {
          if (url.endsWith("/outreach-discourse-golden-cases.json")) {
            throw new Error("SYNTHETIC_PRIVATE_ID");
          }
          return nextLoad(url, context);
        }
      });
    `);

    expect(status).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe("Grounded response offline preflight failed.\n");
  });
});
