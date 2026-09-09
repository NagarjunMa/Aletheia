import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("ALE-43 Phase 5 production gate wiring", () => {
  it("keeps focused resume security checks explicit in pull-request CI", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const ci = read(".github/workflows/ci.yml");

    expect(packageJson.scripts["test:resume-security"]).toBeTruthy();
    expect(ci).toContain("npm run test:resume-security");
  });

  it("provides a protected, manually dispatched production-like gate", () => {
    const workflow = read(".github/workflows/resume-production-gate.yml");
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirm_isolated_project:");
    expect(workflow).toContain(
      "RESUME_GATE_CONFIRM_ISOLATED_PROJECT: ${{ inputs.confirm_isolated_project }}",
    );
    expect(workflow).not.toContain(
      'RESUME_GATE_CONFIRM_ISOLATED_PROJECT: "yes"',
    );
    expect(workflow).toContain("environment: resume-production-gate");
    expect(workflow).toContain("RESUME_GATE_BASE_URL");
    expect(workflow).toContain("RESUME_GATE_PRODUCTION_BASE_URL");
    expect(workflow).toContain("RESUME_GATE_PRODUCTION_SUPABASE_URL");
    expect(workflow).toContain("PLAYWRIGHT_BASE_URL");
    expect(workflow).toContain("RESUME_GATE_VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(workflow).toContain("RESUME_GATE_SUPABASE_SERVICE_ROLE_KEY");
    expect(workflow).toContain("npm run test:resume-production");
    expect(workflow).toContain("test-results/**/resume-*-byte-result.json");
    expect(workflow).toContain("if-no-files-found: error");
    expect(workflow).not.toMatch(/^\s+path:\s+test-results\/\s*$/mu);
    expect(
      workflow.indexOf("RESUME_GATE_SUPABASE_SERVICE_ROLE_KEY"),
    ).toBeGreaterThan(workflow.indexOf("Run isolated resume production gate"));
    expect(packageJson.scripts["test:resume-production"]).toContain(
      "resume-upload.spec.ts",
    );
    const e2e = read("e2e/resume-upload.spec.ts");
    expect(e2e).toContain("unexpectedStorageOrigins");
    expect(e2e).toContain('route.abort("blockedbyclient")');
    expect(e2e).toContain("verifyDeploymentIdentity");
    expect(e2e).toContain("discoverRunArtifacts");
    expect(e2e).toContain("buildVercelBypassHeaders");
    expect(e2e).toContain("environment.baseUrl.origin");
    expect(e2e).toContain("page\n      .context()\n      .request.get");
    expect(e2e).toContain("setCookie: true");
    expect(e2e).not.toContain("page.route(`${environment.baseUrl.origin}/**`");
    expect(e2e).toContain('getByRole("button", { name: "Upload resume" })');
    expect(e2e).not.toContain(
      'expect(page.getByLabel("Choose resume file")).toBeVisible',
    );
    expect(e2e).toContain("clearCredentialFields");
    expect(e2e).toContain("testInfo.outputPath(");
    expect(e2e).toContain("await writeFile(evidencePath");

    const loginPage = read("app/auth/login/page.tsx");
    expect(loginPage).toContain("window.location.replace(redirectTo)");
    expect(loginPage).toContain('"error" in profileResult');
    expect(loginPage).not.toContain("router.push(redirectTo)");
    expect(loginPage).not.toContain("router.refresh()");
  });

  it("documents operations, privacy, rollback, and the future sharing gate", () => {
    const operations = read("docs/operations/resume-upload-production-gate.md");
    const privacy = read("app/privacy/page.tsx");

    expect(operations).toMatch(/resume-quarantine/);
    expect(operations).toMatch(/rollback/i);
    expect(operations).toMatch(/incident response/i);
    expect(operations).toMatch(/AV\/CDR/);
    expect(operations).toMatch(/best-effort daily cleanup/i);
    expect(operations).toMatch(/not a strict 24-hour deletion guarantee/i);
    expect(privacy).toMatch(/original resume files/i);
    expect(privacy).toMatch(/delete/i);
  });
});
