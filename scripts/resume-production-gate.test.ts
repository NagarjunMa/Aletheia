import { describe, expect, it } from "vitest";
import { validateResumeBytes } from "../lib/resumes/validator";
import {
  buildVercelBypassHeaders,
  buildResumePdfFixture,
  buildResumeTextFixture,
  inspectResumeLogExport,
  parseResumeProductionGateEnv,
} from "./resume-production-gate";

const validEnvironment = {
  RESUME_GATE_BASE_URL: "https://aletheia-staging.example",
  RESUME_GATE_PRODUCTION_BASE_URL: "https://aletheia.live",
  RESUME_GATE_SUPABASE_URL: "https://staging-project.supabase.co",
  RESUME_GATE_PRODUCTION_SUPABASE_URL: "https://production-project.supabase.co",
  RESUME_GATE_SUPABASE_ANON_KEY: "anon-test-key",
  RESUME_GATE_SUPABASE_SERVICE_ROLE_KEY: "service-test-key",
  RESUME_GATE_USER_A_EMAIL: "resume-gate-a@example.test",
  RESUME_GATE_USER_A_PASSWORD: "not-a-real-password-a",
  RESUME_GATE_USER_B_EMAIL: "resume-gate-b@example.test",
  RESUME_GATE_USER_B_PASSWORD: "not-a-real-password-b",
  RESUME_GATE_CRON_SECRET: "test-cron-secret-at-least-16",
  RESUME_GATE_CONFIRM_ISOLATED_PROJECT: "yes",
  RESUME_GATE_VERCEL_AUTOMATION_BYPASS_SECRET: "vercel-bypass-secret",
};

describe("resume production gate", () => {
  it("builds a scoped Vercel deployment-protection header", () => {
    expect(buildVercelBypassHeaders("  bypass-secret  ")).toEqual({
      "x-vercel-protection-bypass": "bypass-secret",
    });
    expect(buildVercelBypassHeaders(undefined)).toEqual({});
    expect(buildVercelBypassHeaders("   ")).toEqual({});
    expect(
      buildVercelBypassHeaders("bypass-secret", { setCookie: true }),
    ).toEqual({
      "x-vercel-protection-bypass": "bypass-secret",
      "x-vercel-set-bypass-cookie": "true",
    });
  });

  it("rejects incomplete or production-targeted environments", () => {
    expect(() => parseResumeProductionGateEnv({})).toThrow(
      /missing resume production gate environment/i,
    );
    expect(() =>
      parseResumeProductionGateEnv({
        ...validEnvironment,
        RESUME_GATE_BASE_URL: "https://aletheia.live",
      }),
    ).toThrow(/refuses to target production/i);
    expect(() =>
      parseResumeProductionGateEnv({
        ...validEnvironment,
        RESUME_GATE_BASE_URL: validEnvironment.RESUME_GATE_PRODUCTION_BASE_URL,
      }),
    ).toThrow(/refuses to target production/i);
    expect(() =>
      parseResumeProductionGateEnv({
        ...validEnvironment,
        RESUME_GATE_SUPABASE_URL:
          validEnvironment.RESUME_GATE_PRODUCTION_SUPABASE_URL,
      }),
    ).toThrow(/refuses to target production/i);
    expect(() =>
      parseResumeProductionGateEnv({
        ...validEnvironment,
        RESUME_GATE_BASE_URL: "http://aletheia-staging.example",
      }),
    ).toThrow(/requires HTTPS/i);
  });

  it("requires two distinct isolated test accounts", () => {
    expect(() =>
      parseResumeProductionGateEnv({
        ...validEnvironment,
        RESUME_GATE_USER_B_EMAIL: validEnvironment.RESUME_GATE_USER_A_EMAIL,
      }),
    ).toThrow(/distinct test accounts/i);
  });

  it("creates exact-size UTF-8 fixtures without unbounded allocation", () => {
    const oneMiB = buildResumeTextFixture(1024 * 1024);
    const nearLimit = buildResumeTextFixture(5 * 1024 * 1024 - 1024);

    expect(Buffer.byteLength(oneMiB)).toBe(1024 * 1024);
    expect(Buffer.byteLength(nearLimit)).toBe(5 * 1024 * 1024 - 1024);
    expect(() => buildResumeTextFixture(5 * 1024 * 1024 + 1)).toThrow(
      /fixture size/i,
    );
  });

  it("creates a bounded one-page PDF fixture with extractable text", async () => {
    const pdf = buildResumePdfFixture("ALE43_PDF_CANARY");

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeLessThan(64 * 1024);
    expect(pdf.toString("ascii")).toContain("ALE43PDFCANARY");
    expect(pdf.toString("ascii")).toContain("%%EOF");
    await expect(
      validateResumeBytes({
        bytes: Uint8Array.from(pdf),
        fileName: "resume.pdf",
        declaredMime: "application/pdf",
        declaredSize: pdf.byteLength,
      }),
    ).resolves.toMatchObject({
      status: expect.stringMatching(/ready|warning/),
    });
  });

  it("accepts required structured events with no sensitive canary", () => {
    const lines = [
      ["resume_upload.reservation", "success"],
      ["resume_upload.acknowledgement", "success"],
      ["resume_upload.validation", "success"],
      ["resume_upload.promotion", "success"],
      ["resume_upload.rejection", "failure"],
      ["resume_upload.cleanup", "success"],
    ].map(([stage, outcome]) =>
      JSON.stringify({
        event: "stage.complete",
        stage,
        outcome,
        durationMs: 12,
      }),
    );

    expect(
      inspectResumeLogExport(lines.join("\n"), ["PRIVATE_CANARY"]),
    ).toEqual({
      eventCount: 6,
      missingStages: [],
      leakedCanaries: [],
      forbiddenFields: [],
    });
  });

  it("fails when logs omit lifecycle evidence or contain sensitive markers", () => {
    const result = inspectResumeLogExport(
      JSON.stringify({
        event: "stage.complete",
        stage: "resume_upload.reservation",
        outcome: "success",
        durationMs: 4,
        fileName: "PRIVATE_CANARY",
      }),
      ["PRIVATE_CANARY"],
    );

    expect(result.leakedCanaries).toEqual(["PRIVATE_CANARY"]);
    expect(result.missingStages).toContain("resume_upload.cleanup");
  });

  it("reads structured events wrapped by a platform log envelope", () => {
    const result = inspectResumeLogExport(
      JSON.stringify({
        message: JSON.stringify({
          event: "stage.complete",
          stage: "resume_upload.cleanup",
          outcome: "success",
          durationMs: 7,
        }),
      }),
      [],
    );

    expect(result.eventCount).toBe(1);
    expect(result.missingStages).not.toContain("resume_upload.cleanup");
  });

  it("rejects forbidden sensitive fields recursively in structured logs", () => {
    const result = inspectResumeLogExport(
      [
        JSON.stringify({
          event: "stage.complete",
          stage: "resume_upload.validation",
          outcome: "success",
          durationMs: 7,
          context: { storagePath: "opaque-path" },
        }),
        JSON.stringify({
          message: JSON.stringify({
            event: "stage.complete",
            stage: "resume_upload.promotion",
            outcome: "success",
            durationMs: 9,
            content_sha256: "opaque-hash",
          }),
        }),
      ].join("\n"),
      [],
    );

    expect(result.forbiddenFields).toEqual(["content_sha256", "storagePath"]);
  });

  it("fails closed instead of ignoring records beyond the line limit", () => {
    const lines = Array.from({ length: 50_001 }, () => "{}");
    lines[50_000] = JSON.stringify({ storagePath: "must-not-be-ignored" });

    expect(() => inspectResumeLogExport(lines.join("\n"), [])).toThrow(
      /50,000-line audit limit/i,
    );
  });
});
