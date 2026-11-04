import { describe, expect, it, vi } from "vitest";
import { buildQualityMetadata } from "../lib/ai/generation-quality";
import { prepareFactReview } from "../lib/candidate-profile/fact-review";
import { candidateProfileInputSchema } from "../lib/candidate-profile/schema";
import { buildOutreachGroundingContext } from "../modules/outreach/application/build-outreach-grounding-context";
import {
  buildLinkedinCompositions,
  buildLinkedinSelectionTool,
} from "../modules/outreach/domain/linkedin-grounded-selection";
import { buildProseCompositions } from "../modules/outreach/application/prose-compositions";
import { buildYcGroundingContext } from "../modules/application-answer/application/build-yc-grounding-context";
import { buildYcPlannedOptions } from "../modules/application-answer/application/yc-rhetorical-options";
import {
  candidateIdentity,
  currentRole,
  injectedProfileMarkdown,
  evidence,
  job,
  linkedinCandidateFacts,
  linkedinJob,
  profileMarkdown,
  questions,
} from "./grounded-response-hosted-fixture";
import {
  readHostedGateConfig,
  runHostedGate,
} from "./grounded-response-hosted-gate";

const sha = "a".repeat(40);
const off = "https://fixture-off-test.vercel.app";
const on = "https://fixture-on-test.vercel.app";
const database = "https://isolatedfixture.supabase.co";
const env = {
  GROUNDED_GATE_CONFIRM: "yes",
  GROUNDED_GATE_SHA: sha,
  GROUNDED_GATE_OFF_URL: off,
  GROUNDED_GATE_ON_URL: on,
  GROUNDED_GATE_PRODUCTION_APP_URL: "https://aletheia.live",
  GROUNDED_GATE_PROJECT_ID: "prj_isolated",
  GROUNDED_GATE_PRODUCTION_PROJECT_ID: "prj_production",
  GROUNDED_GATE_SUPABASE_URL: database,
  GROUNDED_GATE_PRODUCTION_SUPABASE_URL:
    "https://productionfixture.supabase.co",
  GROUNDED_GATE_VERCEL_BYPASS: "fixture-bypass",
  GROUNDED_GATE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  GROUNDED_GATE_OFF_USER_ID: "12345678-1234-4123-8123-123456789012",
  GROUNDED_GATE_ON_USER_ID: "12345678-1234-4123-8123-123456789013",
  GROUNDED_GATE_OFF_EMAIL: "off@example.test",
  GROUNDED_GATE_ON_EMAIL: "on@example.test",
  GROUNDED_GATE_OFF_PASSWORD: "off-password",
  GROUNDED_GATE_ON_PASSWORD: "on-password",
};

describe("hosted gate isolation", () => {
  it.each([
    { GROUNDED_GATE_CONFIRM: "" },
    { GROUNDED_GATE_OFF_URL: on },
    { GROUNDED_GATE_ON_URL: "https://www.aletheia.live" },
    { GROUNDED_GATE_OFF_URL: "https://fixture-off-test.vercel.app./" },
    { GROUNDED_GATE_OFF_URL: "https://user@fixture-off-test.vercel.app/" },
    { GROUNDED_GATE_OFF_URL: `${off}/anything` },
    { GROUNDED_GATE_PRODUCTION_APP_URL: off },
    { GROUNDED_GATE_PRODUCTION_PROJECT_ID: env.GROUNDED_GATE_PROJECT_ID },
    { GROUNDED_GATE_PRODUCTION_SUPABASE_URL: database },
    { GROUNDED_GATE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" },
    { GROUNDED_GATE_ON_USER_ID: env.GROUNDED_GATE_OFF_USER_ID },
    { GROUNDED_GATE_SHA: "abcdef" },
  ])("rejects unsafe configuration %#", (overrides) => {
    expect(() => readHostedGateConfig({ ...env, ...overrides })).toThrow();
  });

  it.each([
    "flag",
    "sha",
    "origin",
    "project",
    "url",
    "redirect",
    "unprotected",
  ])(
    "stops on a second-preview %s mismatch before either sign-in",
    async (failure) => {
      const transport = vi.fn<typeof fetch>(async (url, init) => {
        const target = new URL(String(url));
        const enabled = target.origin === on;
        expect(init?.redirect).toBe("manual");
        expect(target.pathname).toBe("/api/health");
        const protectedRequest = new Headers(init?.headers).has(
          "x-vercel-protection-bypass",
        );
        if (!protectedRequest)
          return new Response(null, {
            status: enabled && failure === "unprotected" ? 200 : 401,
          });
        if (enabled && failure === "redirect")
          return Response.redirect("https://productionfixture.supabase.co");
        return Response.json({
          status: "ok",
          deploymentSha: enabled && failure === "sha" ? "b".repeat(40) : sha,
          supabaseOrigin:
            enabled && failure === "origin"
              ? "https://other.supabase.co"
              : database,
          groundedResponseGate: {
            projectId:
              enabled && failure === "project" ? "prj_other" : "prj_isolated",
            deploymentHost:
              enabled && failure === "url"
                ? "other.vercel.app"
                : target.hostname,
            rhetoricalPlans: enabled && failure !== "flag",
          },
        });
      });
      await expect(
        runHostedGate(readHostedGateConfig(env), transport),
      ).rejects.toThrow(/identity|protection/i);
      expect(
        transport.mock.calls.every(
          ([url]) => new URL(String(url)).pathname === "/api/health",
        ),
      ).toBe(true);
    },
  );
});

describe("paired hosted workload", () => {
  function fixtureTransport(
    defect?:
      | "wrong-account"
      | "redirect-auth"
      | "leak"
      | "wrong-prompt"
      | "wrong-provenance"
      | "wrong-prose-length"
      | "refusal-with-draft"
      | "refusal-with-refund",
  ) {
    return vi.fn<typeof fetch>(async (url, init) => {
      const target = new URL(String(url));
      const enabled = target.origin === on;
      const headers = new Headers(init?.headers);
      expect(init?.redirect).toBe("manual");
      if (target.pathname === "/api/health") {
        if (!headers.has("x-vercel-protection-bypass"))
          return new Response(null, { status: 401 });
        return Response.json({
          status: "ok",
          deploymentSha: sha,
          supabaseOrigin: database,
          groundedResponseGate: {
            projectId: "prj_isolated",
            deploymentHost: target.hostname,
            rhetoricalPlans: enabled,
          },
        });
      }
      if (target.pathname === "/api/extension/version") {
        const { default: manifest } =
          await import("../ascendia-extension/manifest.json");
        return Response.json({
          extensionVersion: manifest.version,
          api: { currentVersion: "1", supportedVersions: ["1"] },
        });
      }
      if (target.pathname === "/auth/v1/token") {
        expect(target.origin).toBe(database);
        expect(target.searchParams.get("grant_type")).toBe("password");
        expect(headers.get("apikey")).toBe("sb_publishable_fixture");
        expect(headers.has("x-vercel-protection-bypass")).toBe(false);
        if (defect === "redirect-auth") return Response.redirect(on, 307);
        const credentials = JSON.parse(String(init?.body));
        const offAccount = credentials.email === env.GROUNDED_GATE_OFF_EMAIL;
        expect(credentials.password).toBe(
          offAccount
            ? env.GROUNDED_GATE_OFF_PASSWORD
            : env.GROUNDED_GATE_ON_PASSWORD,
        );
        const useOffId = offAccount || defect === "wrong-account";
        return Response.json({
          access_token: offAccount ? "off-token" : "on-token",
          user: {
            id: useOffId
              ? env.GROUNDED_GATE_OFF_USER_ID
              : env.GROUNDED_GATE_ON_USER_ID,
          },
        });
      }

      expect(target.pathname).toBe("/api/extension/generate");
      expect(headers.get("authorization")).toBe(
        enabled ? "Bearer on-token" : "Bearer off-token",
      );
      expect(headers.has("apikey")).toBe(false);
      const payload = JSON.parse(String(init?.body));
      const injection = String(payload.profileMarkdown).includes(
        "GROUNDEDGATEINJECTIONCANARY",
      );
      if (injection) {
        return Response.json(
          {
            error:
              "The selected profile contains instruction-like text. No draft was generated.",
            code: "INSUFFICIENT_GROUNDING",
            reasonCodes: ["TARGET_INJECTION_DETECTED"],
            billing: defect === "refusal-with-refund" ? "refunded" : "none",
            ...(defect === "refusal-with-draft"
              ? { success: true, body: "A draft slipped through." }
              : {}),
          },
          { status: 422 },
        );
      }

      const legacy =
        payload.category === "linkedin_connection" && payload.jd === "";
      expect(headers.has("x-aletheia-api-version")).toBe(!legacy);
      expect(headers.has("x-aletheia-extension-version")).toBe(!legacy);
      const isYc = payload.category === "yc_application";
      const quality = {
        version: 1,
        archetype: enabled ? "evidence_led" : "legacy",
        selectedSourceCount: 2,
        selectedSourceKinds: ["action", "target_observation"],
        groundingPassed: true,
        finalizationPatternCount: 0,
      };
      const evalMetadata = {
        promptVersion: isYc
          ? enabled
            ? "yc-3.0.0"
            : "yc-2.0.1"
          : enabled && defect !== "wrong-prompt"
            ? "7.0.0"
            : "6.0.0",
        inputTokens: 100,
        outputTokens: 20,
        injectionTriggered: injection,
        quality,
      };
      let body = `${linkedinCandidateFacts[0]} I'm interested in the openings for Engineers with the Evaluation team at Example.`;
      if (legacy) {
        expect(payload.profileMarkdown).toBe(profileMarkdown);
        body = `${linkedinCandidateFacts[0]} I'm interested in AI Evaluation and your Engineering Manager role at Example.`;
      }
      const prose =
        payload.category === "cold_email" ||
        payload.category === "linkedin_inmail";
      if (prose && defect !== "wrong-prose-length")
        body = Array(payload.category === "cold_email" ? 25 : 20)
          .fill("I built synthetic evaluation tools.")
          .join(" ");
      if (defect === "leak") body += " GROUNDEDGATEINJECTIONCANARY";
      if (defect === "wrong-provenance")
        body = `${linkedinCandidateFacts[0]} I was fired from the Evaluation team at Example.`;
      if (isYc) {
        const answerBody = Array(10)
          .fill("I built synthetic evaluation tools.")
          .join(" ");
        const answers = payload.questions.map(
          (question: string, index: number) => ({
            questionId: `q${index + 1}`,
            question,
            body: answerBody,
            word_count: 50,
            character_count: answerBody.length,
          }),
        );
        body = answers
          .map(
            ({ question }: { question: string }) =>
              `**${question}**\n${answerBody}`,
          )
          .join("\n\n");
        return Response.json({
          success: true,
          category: payload.category,
          body,
          answers,
          character_count: body.length,
          word_count: body.split(/\s+/u).length,
          usage: { input_tokens: 100, output_tokens: 20 },
          processingTime: 50,
          evalMetadata: {
            ...evalMetadata,
            generationId: "12345678-1234-4123-8123-123456789099",
            model: "fixture-model",
            category: payload.category,
            generationTimeMs: 50,
            profileFieldCount: 3,
            confirmedEvidenceCount: 2,
            resumeSource: "none",
            groundingValidationPassed: true,
          },
          billingMode: "credits",
          creditCost: 4,
          creditsRemaining: 5,
        });
      }
      return Response.json({
        success: true,
        category: payload.category,
        body,
        character_count: body.length,
        ...(payload.category === "linkedin_connection"
          ? {}
          : { subject_line: "Synthetic outreach" }),
        evalMetadata,
        usage: { input_tokens: 100, output_tokens: 20 },
        ...(prose ? { word_count: body.split(/\s+/u).length } : {}),
      });
    });
  }

  it("runs the same inputs in both modes and projects only approved evidence", async () => {
    const transport = fixtureTransport();
    const report = await runHostedGate(readHostedGateConfig(env), transport);
    expect(report).toMatchObject({
      hostedModeChecksPassed: true,
      releaseDecision: "hold",
      deploymentSha: sha,
    });
    expect(report.results).toHaveLength(12);
    expect(report.results.filter(({ status }) => status === 422)).toHaveLength(
      2,
    );
    const generated = transport.mock.calls.filter(
      ([url]) => new URL(String(url)).pathname === "/api/extension/generate",
    );
    expect(generated).toHaveLength(12);
    for (let index = 0; index < generated.length; index += 2) {
      expect(generated[index]?.[1]?.body).toBe(generated[index + 1]?.[1]?.body);
    }
    expect(JSON.stringify(report)).not.toMatch(
      /example\.test|supabase\.co|vercel\.app|off-token|password|GROUNDEDGATEINJECTIONCANARY|Evaluation team at Example/,
    );
  });

  it.each(["wrong-account", "redirect-auth"] as const)(
    "stops on %s before generation",
    async (defect) => {
      const transport = fixtureTransport(defect);
      await expect(
        runHostedGate(readHostedGateConfig(env), transport),
      ).rejects.toThrow(/Synthetic account sign-in failed/);
      expect(
        transport.mock.calls.some(
          ([url]) =>
            new URL(String(url)).pathname === "/api/extension/generate",
        ),
      ).toBe(false);
    },
  );

  it.each(["leak", "wrong-prompt", "wrong-provenance"] as const)(
    "fails without echoing data for %s",
    async (defect) => {
      const transport = fixtureTransport(defect);
      await expect(
        runHostedGate(readHostedGateConfig(env), transport),
      ).rejects.toThrow(
        /linkedin_with_job: (Private response data|Generation contract mismatch|LinkedIn provenance or character budget mismatch)/,
      );
      expect(
        transport.mock.calls.filter(
          ([url]) =>
            new URL(String(url)).pathname === "/api/extension/generate",
        ).length,
      ).toBeLessThanOrEqual(2);
    },
  );
  it("rejects an undersized prose draft accepted by a permissive popup parser", async () => {
    await expect(
      runHostedGate(
        readHostedGateConfig(env),
        fixtureTransport("wrong-prose-length"),
      ),
    ).rejects.toThrow(/off\/cold_email: Prose response contract mismatch/);
  });
  it.each(["refusal-with-draft", "refusal-with-refund"] as const)(
    "rejects an injection refusal with %s",
    async (defect) => {
      await expect(
        runHostedGate(readHostedGateConfig(env), fixtureTransport(defect)),
      ).rejects.toThrow(
        /off\/mixed_profile_injection_refusal: Expected injection refusal/,
      );
    },
  );
});

describe("protected workflow contract", () => {
  it("limits execution and secret exposure to the protected main-branch dispatch", async () => {
    const { readFileSync } = await import("node:fs");
    const workflow = readFileSync(
      new URL(
        "../.github/workflows/grounded-response-production-gate.yml",
        import.meta.url,
      ),
      "utf8",
    );
    expect(workflow).toMatch(/^on:\n  workflow_dispatch:/mu);
    expect(workflow).not.toMatch(
      /^  (?:pull_request(?:_target)?|push|schedule):/mu,
    );
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain(
      "environment: grounded-response-production-gate",
    );
    expect(workflow).toContain("GROUNDED_GATE_SHA: ${{ github.sha }}");
    const steps = workflow.split(/^      - name: /mu).slice(1);
    const secretSteps = steps.filter((step) => step.includes("${{ secrets."));
    expect(secretSteps).toHaveLength(1);
    expect(secretSteps[0]).toMatch(/^Verify flag-off and flag-on previews\n/u);
    expect(workflow).not.toMatch(/secrets\.[A-Z_]*(?:SERVICE_ROLE|ANTHROPIC)/u);
    const artifact = steps.find((step) =>
      step.startsWith("Upload projected evidence"),
    );
    expect(artifact).toContain("if: success()");
    expect(artifact).toContain(
      "path: ${{ runner.temp }}/grounded-response-gate.json",
    );
  });
});

describe("hosted fixture eligibility through the real composers", () => {
  const candidate = {
    identity: { fullName: candidateIdentity, linkedinUrl: "" },
    profile: candidateProfileInputSchema.parse({ currentRole }),
    resume: { text: "", source: "none" } as const,
    confirmedEvidence: evidence.map((entry, index) => {
      const record = {
        ...entry,
        id: `11111111-1111-4111-8111-11111111111${index}`,
        metrics: [],
        skills: [],
        links: [],
        confirmed: true,
        sortOrder: index,
      };
      return {
        ...record,
        factReview: prepareFactReview(record, [
          {
            id: `88888888-8888-4888-8888-88888888888${index}`,
            kind: "action",
            excerpt: record.actions,
            confirmed: true,
          },
          {
            id: `99999999-9999-4999-8999-99999999999${index}`,
            kind: "outcome",
            excerpt: record.outcome,
            confirmed: true,
          },
          ...(record.context
            ? [
                {
                  id: "33333333-3333-4333-8333-333333333333",
                  kind: "action" as const,
                  excerpt: record.context,
                  confirmed: true as const,
                },
              ]
            : []),
        ]),
      };
    }),
  };

  it.each([false, true])(
    "has complete options in both flag modes (%s)",
    (enabled) => {
      for (const [jobDescription, expectedTarget] of [
        [
          linkedinJob,
          "I'm interested in the openings for Engineers with the Evaluation team at Example.",
        ],
        [
          "",
          "I'm interested in AI Evaluation and your Engineering Manager role at Example.",
        ],
      ] as const) {
        const context = buildOutreachGroundingContext({
          candidate,
          target: {
            category: "linkedin_connection",
            profileMarkdown,
            jobDescription,
            conversationContext: "",
          },
        });
        const options = buildLinkedinCompositions(
          context.atomicSources ?? [],
          "job_inquiry",
          enabled,
        );
        expect(options.length).toBeGreaterThan(0);
        for (const { body, draft } of options) {
          expect(body).toContain(expectedTarget);
          expect(
            linkedinCandidateFacts.some((fact) => body.includes(fact)),
          ).toBe(true);
          const quality = buildQualityMetadata({
            claims: draft.claims,
            sources: context.atomicSources ?? [],
            patternCount: 0,
          });
          expect(quality.selectedSourceCount).toBeGreaterThanOrEqual(2);
          expect(quality.selectedSourceKinds).toContain("target_observation");
        }
      }
      for (const category of ["cold_email", "linkedin_inmail"] as const) {
        const context = buildOutreachGroundingContext({
          candidate,
          target: {
            category,
            profileMarkdown,
            jobDescription: job,
            conversationContext: "",
          },
        });
        expect(
          buildProseCompositions({
            category,
            emailMode: "initial_outreach",
            context,
            rhetoricalPlans: enabled,
            intent: "job_inquiry",
          }).length,
        ).toBeGreaterThan(0);
      }
    },
  );

  it.each([false, true])(
    "refuses the exact mixed profile before any option can be selected (%s)",
    (enabled) => {
      const context = buildOutreachGroundingContext({
        candidate,
        target: {
          category: "linkedin_connection",
          profileMarkdown: injectedProfileMarkdown,
          jobDescription: "",
          conversationContext: "",
        },
      });
      expect(() =>
        buildLinkedinSelectionTool(
          context.atomicSources ?? [],
          context.targetDiagnostics,
          "job_inquiry",
          enabled,
        ),
      ).toThrow(
        expect.objectContaining({ reasonCodes: ["TARGET_INJECTION_DETECTED"] }),
      );
    },
  );

  it("offers grounded complete enabled YC choices for both questions", () => {
    const context = buildYcGroundingContext({
      candidate,
      question: questions[0]!,
      questions,
      jobDescription: job,
    });
    const options = buildYcPlannedOptions(context);
    expect(options).toHaveLength(2);
    for (const question of options)
      expect(question.options.length).toBeGreaterThan(0);
  });
});
