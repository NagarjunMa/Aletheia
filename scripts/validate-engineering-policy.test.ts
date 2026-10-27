import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ENGINEERING_POLICY_MARKERS,
  POLICY_EVIDENCE_MARKERS,
  validateEngineeringPolicy,
} from "./validate-engineering-policy";

const temporaryDirectories: string[] = [];

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "engineering-policy-"));
  temporaryDirectories.push(root);

  await mkdir(path.join(root, "docs/agents"), { recursive: true });
  await mkdir(path.join(root, ".github"), { recursive: true });
  await writeFile(
    path.join(root, "AGENTS.md"),
    [
      "# Agent entry point",
      "",
      "Read `docs/agents/engineering-guide.md`.",
      "The Mandatory Engineering Loop applies to every non-trivial change.",
    ].join("\n"),
  );
  await writeFile(
    path.join(root, "docs/agents/engineering-guide.md"),
    [
      "# Engineering Guide",
      "",
      "## Mandatory Engineering Loop",
      "",
      ...ENGINEERING_POLICY_MARKERS,
    ].join("\n"),
  );
  await writeFile(
    path.join(root, ".github/pull_request_template.md"),
    `${POLICY_EVIDENCE_MARKERS.join("\n")}\n`,
  );

  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("validateEngineeringPolicy", () => {
  it("accepts a complete repository policy installation", async () => {
    const root = await createFixture();

    await expect(validateEngineeringPolicy(root)).resolves.toEqual([]);
  });

  it("reports missing required policy files", async () => {
    const root = await createFixture();
    await rm(path.join(root, "docs/agents/engineering-guide.md"));

    const errors = await validateEngineeringPolicy(root);

    expect(errors).toContain(
      "Missing required file: docs/agents/engineering-guide.md",
    );
  });

  it("requires AGENTS.md to activate the repository-owned loop", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "AGENTS.md"), "# Agent entry point\n");

    const errors = await validateEngineeringPolicy(root);

    expect(errors).toContain(
      "AGENTS.md must reference docs/agents/engineering-guide.md",
    );
    expect(errors).toContain(
      "AGENTS.md must require the Mandatory Engineering Loop",
    );
  });

  it("requires every engineering policy section marker", async () => {
    const root = await createFixture();
    const missingMarker = ENGINEERING_POLICY_MARKERS[0];
    await writeFile(
      path.join(root, "docs/agents/engineering-guide.md"),
      `${ENGINEERING_POLICY_MARKERS.slice(1).join("\n")}\n`,
    );

    const errors = await validateEngineeringPolicy(root);

    expect(errors).toContain(
      `Engineering guide is missing policy marker: ${missingMarker}`,
    );
  });

  it("requires every pull request evidence marker", async () => {
    const root = await createFixture();
    const missingMarker = POLICY_EVIDENCE_MARKERS[0];
    await writeFile(
      path.join(root, ".github/pull_request_template.md"),
      `${POLICY_EVIDENCE_MARKERS.slice(1).join("\n")}\n`,
    );

    const errors = await validateEngineeringPolicy(root);

    expect(errors).toContain(
      `Pull request template is missing evidence marker: ${missingMarker}`,
    );
  });

  it("detects unfinished scaffold placeholders in policy files", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "docs/agents/engineering-guide.md"),
      `${ENGINEERING_POLICY_MARKERS.join("\n")}\n\nTODO: replace this scaffold.\n`,
    );

    const errors = await validateEngineeringPolicy(root);

    expect(errors).toContain(
      "Unfinished scaffold placeholder in docs/agents/engineering-guide.md",
    );
  });

  it("does not modify repository files while validating", async () => {
    const root = await createFixture();
    const guidePath = path.join(root, "docs/agents/engineering-guide.md");
    const beforeContent = await readFile(guidePath, "utf8");
    const beforeStat = await stat(guidePath);

    await validateEngineeringPolicy(root);

    const afterContent = await readFile(guidePath, "utf8");
    const afterStat = await stat(guidePath);
    expect(afterContent).toBe(beforeContent);
    expect(afterStat.mtimeMs).toBe(beforeStat.mtimeMs);
  });
});

describe("PR evidence contract", () => {
  const complete =
    "## Summary\nImprove the CI contract.\n## Risk\nRisk: Significant — shared CI execution boundary.\n## Verification\n- Passed: npm run policy:check\n- Not run: hosted CI awaits the pull request.\n";
  it("accepts explicit risk and verification without requiring hidden template markers", async () => {
    const { validatePullRequestEvidence } =
      await import("./validate-engineering-policy");
    expect(validatePullRequestEvidence(complete)).toEqual([]);
  });
  it.each([
    null,
    "",
    "## Validation\n- Passed: npm test\n",
    "Risk: Critical\n## Verification\n- Passed: npm test",
    "Risk: Standard — CI update\n## Verification\n- Passed:",
    "Risk: Standard — CI update\n## Verification\n- Passed: TBD",
    "Risk: <select tier> — <reason>\n## Verification\n- Passed: npm test",
  ])("rejects absent or placeholder PR evidence %#", async (body) => {
    const { validatePullRequestEvidence } =
      await import("./validate-engineering-policy");
    expect(validatePullRequestEvidence(body).length).toBeGreaterThan(0);
  });
  it("accepts honest blocked/not-run evidence without claiming success", async () => {
    const { validatePullRequestEvidence } =
      await import("./validate-engineering-policy");
    expect(
      validatePullRequestEvidence(
        "Risk: Standard — repository policy only.\n## Validation\n- Not run: browser checks do not exercise this policy-only change.",
      ),
    ).toEqual([]);
  });
  it("rejects scaffold prefixes in risk and evidence", async () => {
    const { validatePullRequestEvidence } =
      await import("./validate-engineering-policy");
    expect(
      validatePullRequestEvidence(
        "Risk: Standard — TODO: describe risk\n## Verification\n- Passed: TODO: supply command",
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each([
    "## Verification\n### Unit tests\nPassed: npm test",
    "## Verification ##\nPassed: npm test",
  ])("accepts ordinary verification heading structure %#", async (section) => {
    const { validatePullRequestEvidence } =
      await import("./validate-engineering-policy");
    expect(
      validatePullRequestEvidence(`Risk: Standard — CI boundary.\n${section}`),
    ).toEqual([]);
  });
  it("does not count evidence after leaving the verification section", async () => {
    const { validatePullRequestEvidence } =
      await import("./validate-engineering-policy");
    expect(
      validatePullRequestEvidence(
        "Risk: Standard — CI boundary.\n## Verification\n### Unit tests\nPending details.\n## Examples\nPassed: npm test",
      ),
    ).toContain(
      "Under Verification or Validation, add Passed/Failed/Blocked/Not run: check and result or reason.",
    );
  });
  it("ignores an unclosed HTML comment through end of input", async () => {
    const { validatePullRequestEvidence } =
      await import("./validate-engineering-policy");
    expect(validatePullRequestEvidence(`<!--\n${complete}`).length).toBe(2);
  });
  it("does not mistake code examples or comments for actual evidence", async () => {
    const { validatePullRequestEvidence } =
      await import("./validate-engineering-policy");
    expect(
      validatePullRequestEvidence(
        "<!-- Risk: Standard — example only. -->\n```md\nRisk: Standard — example only.\n## Verification\n- Passed: npm test\n```",
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe("actual Node24 CLI boundary", () => {
  const script = fileURLToPath(
    new URL("./validate-engineering-policy.ts", import.meta.url),
  );
  const body =
    "Risk: Standard — CI policy boundary.\n## Verification\n- Passed: npm run policy:check";
  it("accepts a valid event and rejects missing evidence with a failing process exit", async () => {
    const root = await createFixture();
    const event = path.join(root, "event.json");
    await writeFile(event, JSON.stringify({ pull_request: { body } }));
    const passed = spawnSync(process.execPath, [script, "--event", event], {
      cwd: root,
      encoding: "utf8",
    });
    expect(passed.status).toBe(0);
    await writeFile(
      event,
      JSON.stringify({ pull_request: { body: "Unfilled PR" } }),
    );
    const failed = spawnSync(process.execPath, [script, "--event", event], {
      cwd: root,
      encoding: "utf8",
    });
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("Add Risk:");
  });
  it("keeps event contents out of malformed-input diagnostics", async () => {
    const root = await createFixture();
    const event = path.join(root, "event.json");
    await writeFile(event, '{"private":"SYNTHETIC_SECRET_CANARY",invalid}');
    const failed = spawnSync(process.execPath, [script, "--event", event], {
      cwd: root,
      encoding: "utf8",
    });
    expect(failed.status).toBe(1);
    expect(failed.stderr + failed.stdout).not.toContain(
      "SYNTHETIC_SECRET_CANARY",
    );
  });
  it("fails closed on oversized or nonexistent event files", async () => {
    const root = await createFixture();
    const event = path.join(root, "event.json");
    await writeFile(event, "x".repeat(2_097_153));
    expect(
      spawnSync(process.execPath, [script, "--event", event], { cwd: root })
        .status,
    ).toBe(1);
    expect(
      spawnSync(
        process.execPath,
        [script, "--event", path.join(root, "missing.json")],
        { cwd: root },
      ).status,
    ).toBe(1);
  });
  it("fails when policy files are missing even if PR evidence is valid", async () => {
    const root = await createFixture();
    const event = path.join(root, "event.json");
    await writeFile(event, JSON.stringify({ pull_request: { body } }));
    await rm(path.join(root, "AGENTS.md"));
    expect(
      spawnSync(process.execPath, [script, "--event", event], { cwd: root })
        .status,
    ).toBe(1);
  });
});
