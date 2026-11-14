import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import manifest from "../ascendia-extension/manifest.json";
import { prepareFactReview } from "../lib/candidate-profile/fact-review";
import { candidateProfileInputSchema } from "../lib/candidate-profile/schema";
import { buildOutreachGroundingContext } from "../modules/outreach/application/build-outreach-grounding-context";
import { renderLinkedinConnection } from "../modules/outreach/application/render-linkedin-connection";
import { buildProseCompositions } from "../modules/outreach/application/prose-compositions";
import { buildLinkedinCompositions } from "../modules/outreach/domain/linkedin-grounded-selection";
import { countOutputUnits } from "../lib/ai/output-constraints";
import { CLAUDE_MODEL } from "../modules/outreach/infrastructure/anthropic.repository";
import { outreachPromptVersion } from "../lib/ai/prompts/linkedin-connection";
import { runMessageFocusHostedGate } from "./message-focus-hosted-gate";
import {
  automaticShortFact,
  matchesReviewedFixture,
  fixtureNoteLimit,
  focusedAction,
  focusedOutcome,
  messageFocusCases,
  messageFocusPayload,
  focusedShortFact,
  focusCanary,
  noMatchCanary,
} from "./message-focus-hosted-fixture";

const sha = "a".repeat(40);
const off = "https://focus-off-fixture.vercel.app";
const on = "https://focus-on-fixture.vercel.app";
const database = "https://isolatedfixture.supabase.co";
const offUser = "12345678-1234-4123-8123-123456789012";
const onUser = "12345678-1234-4123-8123-123456789013";
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
  GROUNDED_GATE_OFF_USER_ID: offUser,
  GROUNDED_GATE_ON_USER_ID: onUser,
  GROUNDED_GATE_OFF_EMAIL: "off@example.test",
  GROUNDED_GATE_ON_EMAIL: "on@example.test",
  GROUNDED_GATE_OFF_PASSWORD: "off-password",
  GROUNDED_GATE_ON_PASSWORD: "on-password",
  MESSAGE_FOCUS_GATE_MAX_REQUESTS: "16",
  MESSAGE_FOCUS_GATE_MAX_OUTPUT_TOKENS: "27600",
};

const inventory = {
  deployments: [off, on].map((origin) => ({
    url: new URL(origin).hostname,
    target: null,
    state: "READY",
    meta: { githubCommitSha: sha },
  })),
};

function fixture(
  failure?:
    | "wrong-version"
    | "wrong-user"
    | "ignored"
    | "wrong-focus-fact"
    | "wrong-prose-order"
    | "legacy-alternate"
    | "leak"
    | "unknown-private-field"
    | "private-option-id"
    | "private-draft-uuid"
    | "wrong-count"
    | "429"
    | "redirect"
    | "denial-success"
    | "denial-private-message"
    | "missing-fact",
) {
  const generations: Array<{
    origin: string;
    headers: Headers;
    payload: {
      category: string;
      emailMode: string;
      jd: string;
      conversationContext: string;
      messageFocus?: string;
      connectionNoteLimit?: number;
    };
  }> = [];
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const bypass = headers.get("x-vercel-protection-bypass");
    expect(init?.redirect).toBe("manual");
    expect(init?.cache).toBe("no-store");
    if (url.origin === database) {
      expect(bypass).toBeNull();
      expect(headers.get("authorization")).toBeNull();
      expect(headers.get("apikey")).toBe("sb_publishable_fixture");
      expect(url.pathname + url.search).toBe(
        "/auth/v1/token?grant_type=password",
      );
      const credentials = JSON.parse(String(init?.body));
      const isOff = credentials.email === env.GROUNDED_GATE_OFF_EMAIL;
      expect(credentials.password).toBe(isOff ? "off-password" : "on-password");
      return Response.json({
        user: { id: isOff || failure === "wrong-user" ? offUser : onUser },
        access_token: isOff ? "off-token" : "on-token",
      });
    }
    expect([off, on]).toContain(url.origin);
    const enabled = url.origin === on;
    if (!bypass) return new Response(null, { status: 401 });
    expect(bypass).toBe(env.GROUNDED_GATE_VERCEL_BYPASS);
    if (url.pathname === "/api/health")
      return Response.json({
        status: "ok",
        deploymentSha: sha,
        supabaseOrigin: database,
        groundedResponseGate: {
          projectId: "prj_isolated",
          deploymentHost: url.hostname,
          rhetoricalPlans: false,
          providerWireDebug: false,
        },
      });
    if (url.pathname === "/api/extension/config")
      return Response.json({
        supabase_url: database,
        capabilities: { messageFocus: enabled },
      });
    if (url.pathname === "/api/extension/version")
      return Response.json({
        extensionVersion:
          enabled && failure === "wrong-version" ? "0.0.1" : manifest.version,
        api: { currentVersion: "1" },
      });
    expect(url.pathname).toBe("/api/extension/generate");
    expect(headers.get("authorization")).toBe(
      enabled ? "Bearer on-token" : "Bearer off-token",
    );
    expect(headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(headers.get("x-aletheia-operation-id")).toBe(
      headers.get("x-request-id"),
    );
    const payload = JSON.parse(String(init?.body));
    generations.push({ origin: url.origin, headers, payload });
    const focused = Boolean(payload.messageFocus);
    if (!enabled && focused && failure !== "denial-success")
      return Response.json(
        {
          success: false,
          code: "MESSAGE_FOCUS_UNAVAILABLE",
          error: "Message focus is not available yet",
          message: "Clear Message focus to use automatic generation.",
        },
        { status: 409 },
      );
    if (payload.messageFocus?.includes(noMatchCanary))
      return Response.json(
        {
          success: false,
          code: "MESSAGE_FOCUS_NO_MATCH",
          error: "No eligible reviewed experience matches this focus",
          message:
            failure === "denial-private-message"
              ? focusedAction
              : "Edit or clear Message focus, or confirm a matching fact.",
        },
        { status: 422 },
      );
    if (failure === "429")
      return Response.json(
        { code: "SHORT_WINDOW_LIMIT_REACHED", diagnostic: focusCanary },
        { status: 429 },
      );
    if (failure === "redirect")
      return Response.redirect("https://aletheia.live/");
    const connection = payload.category === "linkedin_connection";
    const fact =
      failure === "missing-fact"
        ? "I am a software engineer."
        : connection
          ? (focused && failure !== "wrong-focus-fact") ||
            (failure === "legacy-alternate" &&
              !headers.has("x-aletheia-api-version"))
            ? focusedShortFact
            : automaticShortFact
          : focusedAction;
    const draft = connection
      ? `Hi there, ${fact} Open to connecting? Thank you.`
      : [
          "Hi there,",
          ...(failure === "wrong-prose-order" && focused
            ? [automaticShortFact]
            : []),
          fact,
          ...(payload.emailMode === "follow_up" ? [] : [focusedOutcome]),
          payload.category === "cold_email"
            ? "Thank you. Would you be open to a brief conversation?"
            : "Would you be open to a brief conversation?",
        ].join("\n\n");
    const body =
      failure === "private-option-id"
        ? draft.replace("Open to", "note.1234567890abcdef1234 Open to")
        : failure === "private-draft-uuid"
          ? draft.replace("Open to", `${offUser} Open to`)
          : draft;
    return Response.json({
      success: true,
      category: payload.category,
      body,
      character_count: body.length + Number(failure === "wrong-count"),
      processingTime: 25,
      ...(connection
        ? {}
        : {
            subject_line: "A brief introduction",
            word_count: countOutputUnits(body, "words"),
          }),
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 0,
        cache_creation: null,
        service_tier: "standard",
      },
      evalMetadata: {
        generationId: "4713525c-1695-450c-b2df-e699efa0c718",
        temperature: 0.8,
        category: payload.category,
        intent: "job_inquiry",
        emailMode: payload.emailMode,
        generationTimeMs: 25,
        resumeSource: "none",
        hasPrimaryResume: false,
        safeCandidateSummaryUsed: false,
        grounding: {
          groundingLevel: "verified_evidence",
          fallbackReason: "none",
          selectedSourceCount: 1,
          selectedEvidenceCount: 1,
          selectedSourceKinds: ["evidence"],
          injectionSafeMode: false,
        },
        inputTokens: 100,
        outputTokens: 20,
        model: CLAUDE_MODEL,
        promptVersion: outreachPromptVersion(false, focused),
        injectionTriggered: false,
        quality: {
          version: 1,
          archetype: "legacy",
          selectedSourceCount: 1,
          selectedSourceKinds: ["action"],
          groundingPassed: true,
          finalizationPatternCount: 0,
        },
      },
      ...(focused && failure !== "ignored"
        ? { selectionStatus: "matched" }
        : {}),
      ...(failure === "leak" ? { nested: { supporting_excerpt: fact } } : {}),
      ...(failure === "unknown-private-field"
        ? { debug: { sources: [fact] } }
        : {}),
    });
  });
  return { transport, generations };
}

const reviewedProject = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "technical_project" as const,
  title: "Policy evaluation prototype",
  context: `${automaticShortFact} ${focusedShortFact}`,
  actions: focusedAction,
  outcome: focusedOutcome,
  metrics: [],
  skills: [],
  links: [],
  confirmed: true,
  sortOrder: 0,
};
const reviewedFacts = [
  { kind: "action", excerpt: automaticShortFact },
  { kind: "action", excerpt: focusedShortFact },
  { kind: "action", excerpt: focusedAction },
  { kind: "outcome", excerpt: focusedOutcome },
].map((fact, index) => ({
  ...fact,
  id: `22222222-2222-4222-8222-22222222222${index}`,
  confirmed: true,
}));

describe("Message Focus hosted fixtures against the real composers", () => {
  it.each(messageFocusCases)(
    "supports $mode/$name before any provider call",
    (scenario) => {
      const payload = messageFocusPayload(scenario);
      const context = buildOutreachGroundingContext({
        target: {
          category: scenario.category,
          profileMarkdown: payload.profileMarkdown ?? "",
          jobDescription: payload.jd,
          conversationContext: payload.conversationContext ?? "",
          emailMode: scenario.emailMode,
          ...(scenario.category === "linkedin_connection"
            ? { connectionNoteLimit: fixtureNoteLimit(scenario) }
            : {}),
        },
        candidate: {
          identity: { fullName: "Synthetic Engineer", linkedinUrl: "" },
          profile: candidateProfileInputSchema.parse({
            currentRole: "Evaluation Engineer",
          }),
          resume: { text: "", source: "none" },
          confirmedEvidence: [
            {
              ...reviewedProject,
              factReview: prepareFactReview(reviewedProject, reviewedFacts),
            },
          ],
        },
        ...(payload.messageFocus ? { messageFocus: payload.messageFocus } : {}),
      });
      if (scenario.expectedStatus === 409) return;
      if (scenario.expectedStatus === 422) {
        expect(context.focusSelection).toEqual({ outcome: "no_match" });
        return;
      }
      if (scenario.focus)
        expect(context.focusSelection).toEqual({ outcome: "matched" });
      if (scenario.category === "linkedin_connection") {
        const choices = buildLinkedinCompositions(
          context.atomicSources ?? [],
          "job_inquiry",
          false,
          (draft) => {
            if (
              context.focusFactIds &&
              !draft.claims?.some(({ source_id }) =>
                context.focusFactIds!.has(source_id),
              )
            )
              return undefined;
            return renderLinkedinConnection({ draft, sources: context.sources })
              .body;
          },
          fixtureNoteLimit(scenario),
        );
        expect(choices.length).toBeGreaterThan(0);
        expect(
          choices.every(({ draft }) =>
            matchesReviewedFixture(
              scenario,
              renderLinkedinConnection({
                draft,
                sources: context.sources,
              }).body,
            ),
          ),
        ).toBe(true);
      } else {
        const choices = buildProseCompositions({
          category: scenario.category,
          emailMode: scenario.emailMode,
          context,
          rhetoricalPlans: false,
          intent: "job_inquiry",
        });
        expect(choices.length).toBeGreaterThan(0);
        expect(
          choices.every(({ body }) => matchesReviewedFixture(scenario, body)),
        ).toBe(true);
      }
    },
  );
});

describe("Message Focus hosted runner", () => {
  it("checks paired categories and compatibility using scoped credentials and reports safe evidence", async () => {
    const { transport, generations } = fixture();
    const report = await runMessageFocusHostedGate(env, inventory, transport);
    expect(report.passed, JSON.stringify(report.results.at(-1))).toBe(true);
    expect(report.releaseDecision).toBe("hold");
    expect(report.results).toHaveLength(16);
    expect(generations).toHaveLength(16);
    expect(
      generations
        .slice(0, 4)
        .map(({ origin, payload }) => [origin, payload.category]),
    ).toEqual([
      [off, "linkedin_connection"],
      [on, "linkedin_connection"],
      [on, "cold_email"],
      [on, "linkedin_inmail"],
    ]);
    const positives = generations.slice(4);
    for (let i = 0; i < positives.length; i += 2) {
      const baseline = positives[i]!;
      const comparison = positives[i + 1]!;
      const { messageFocus, ...rest } = comparison.payload;
      expect(baseline.origin).toBe(off);
      expect(comparison.origin).toBe(on);
      expect(rest).toEqual(baseline.payload);
      expect(baseline.payload.messageFocus).toBeUndefined();
      if (i < 10) {
        expect(messageFocus).toContain(focusCanary);
        expect(comparison.headers.get("x-aletheia-extension-version")).toBe(
          manifest.version,
        );
      } else {
        expect(messageFocus).toBeUndefined();
        expect(comparison.headers.has("x-aletheia-api-version")).toBe(false);
        expect(baseline.headers.has("x-aletheia-extension-version")).toBe(
          false,
        );
        expect(baseline.payload.connectionNoteLimit).toBeUndefined();
        expect(baseline.payload.jd).toBe("");
      }
      if (baseline.payload.emailMode === "follow_up") {
        expect(baseline.payload.jd).toBe("");
        expect(baseline.payload.conversationContext).toContain(
          "policy evaluation",
        );
      }
    }
    const reportText = JSON.stringify(report);
    for (const privateValue of [
      focusCanary,
      noMatchCanary,
      focusedAction,
      focusedShortFact,
      "fixture-bypass",
      "off-token",
      "on-password",
      offUser,
      off,
    ]) {
      expect(reportText).not.toContain(privateValue);
    }
    expect(new Set(report.results.map(({ requestId }) => requestId)).size).toBe(
      16,
    );
    expect(report.results.filter(({ status }) => status === 200)).toHaveLength(
      12,
    );
  });

  it.each([
    { MESSAGE_FOCUS_GATE_MAX_REQUESTS: "" },
    { MESSAGE_FOCUS_GATE_MAX_REQUESTS: "15" },
    { MESSAGE_FOCUS_GATE_MAX_OUTPUT_TOKENS: "27599" },
    { GROUNDED_GATE_SUPABASE_URL: env.GROUNDED_GATE_PRODUCTION_SUPABASE_URL },
  ])(
    "blocks invalid budget or isolation configuration before networking %#",
    async (override) => {
      const { transport } = fixture();
      await expect(
        runMessageFocusHostedGate(
          { ...env, ...override },
          inventory,
          transport,
        ),
      ).rejects.toThrow();
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it("accepts either qualifying short fact in the headerless compatibility case", async () => {
    const { transport } = fixture("legacy-alternate");
    const report = await runMessageFocusHostedGate(env, inventory, transport);
    expect(report.passed, JSON.stringify(report.results.at(-1))).toBe(true);
  });

  it("writes a safe JSON setup failure and exits nonzero without approval", () => {
    const cwd = fileURLToPath(new URL("..", import.meta.url));
    let stdout = "";
    try {
      execFileSync(
        process.execPath,
        ["--import", "tsx", "scripts/message-focus-hosted-gate.ts"],
        {
          cwd,
          env: {
            ...process.env,
            ...env,
            MESSAGE_FOCUS_GATE_MAX_REQUESTS: "",
            LOG_LEVEL: "silent",
          },
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 10_000,
        },
      );
    } catch (error) {
      expect(error).toMatchObject({ status: 1 });
      stdout = (error as { stdout: string }).stdout;
    }
    expect(JSON.parse(stdout)).toMatchObject({
      passed: false,
      releaseDecision: "hold",
      setupError:
        "Set an approved MESSAGE_FOCUS_GATE_MAX_REQUESTS of at least 16",
      results: [],
    });
    expect(stdout).not.toContain(env.GROUNDED_GATE_VERCEL_BYPASS);
  });

  it("sends no credentials or bypass when either Preview is missing a matching inventory row", async () => {
    const { transport } = fixture();
    await expect(
      runMessageFocusHostedGate(
        env,
        { deployments: inventory.deployments.slice(0, 1) },
        transport,
      ),
    ).rejects.toThrow("Preview inventory");
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects an incompatible preview before either account signs in", async () => {
    const { transport } = fixture("wrong-version");
    await expect(
      runMessageFocusHostedGate(env, inventory, transport),
    ).rejects.toThrow("Extension version contract mismatch (on)");
    expect(
      transport.mock.calls.every(([, init]) => init?.method !== "POST"),
    ).toBe(true);
  });

  it("prevents generation when isolated sign-in resolves to the wrong account", async () => {
    const { transport, generations } = fixture("wrong-user");
    await expect(
      runMessageFocusHostedGate(env, inventory, transport),
    ).rejects.toThrow("Synthetic account sign-in failed (on)");
    expect(generations).toHaveLength(0);
  });

  it.each([
    ["ignored", 6, 200],
    ["wrong-focus-fact", 6, 200],
    ["wrong-prose-order", 8, 200],
    ["leak", 5, 200],
    ["unknown-private-field", 5, 200],
    ["private-option-id", 5, 200],
    ["private-draft-uuid", 5, 200],
    ["wrong-count", 5, 200],
    ["429", 5, 429],
    ["redirect", 5, 302],
    ["denial-success", 1, 200],
    ["denial-private-message", 2, 422],
    ["missing-fact", 5, 200],
  ] as const)(
    "stops without a retry on %s and preserves a safe correlation record",
    async (failure, requests, status) => {
      const { transport, generations } = fixture(failure);
      const report = await runMessageFocusHostedGate(env, inventory, transport);
      expect(report.passed).toBe(false);
      expect(generations).toHaveLength(requests);
      expect(report.results).toHaveLength(requests);
      expect(report.results.at(-1)).toMatchObject({
        passed: false,
        status,
        requestId: generations.at(-1)?.headers.get("x-request-id"),
      });
      expect(JSON.stringify(report)).not.toContain(focusCanary);
    },
  );
});
