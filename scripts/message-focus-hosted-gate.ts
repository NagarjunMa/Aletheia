import {
  execFileSync,
  type ExecFileSyncOptionsWithStringEncoding,
} from "node:child_process";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import manifest from "../ascendia-extension/manifest.json";
import { parseGenerationResponse } from "../ascendia-extension/popup/popup-core.js";
import {
  EMAIL_SUBJECT_MAX_CHARACTERS,
  countOutputUnits,
  resolveOutputConstraint,
} from "../lib/ai/output-constraints";
import { EMAIL_MODES } from "../lib/ai/email-formatter";
import { qualityMetadataSchema } from "../lib/ai/generation-quality";
import { outreachPromptVersion } from "../lib/ai/prompts/linkedin-connection";
import {
  CURRENT_EXTENSION_API_VERSION,
  EXTENSION_API_VERSION_HEADER,
  EXTENSION_VERSION_HEADER,
} from "../lib/extension-contract";
import {
  CLAUDE_MODEL,
  getOutreachOutputBudget,
} from "../modules/outreach/infrastructure/anthropic.repository";
import { CANDIDATE_SOURCE_KINDS } from "../modules/candidate-context/domain/candidate-context.types";
import {
  OUTREACH_FALLBACK_REASONS,
  OUTREACH_GROUNDING_CATEGORIES,
  OUTREACH_GROUNDING_LEVELS,
} from "../modules/outreach/domain/outreach-grounding.types";
import { readHostedGateConfig } from "./grounded-response-hosted-gate";
import { bypassHeader, GateError } from "./hosted-preview-config";
import {
  matchesReviewedFixture,
  focusCanary,
  fixtureNoteLimit,
  messageFocusCases,
  messageFocusPayload,
  noMatchCanary,
} from "./message-focus-hosted-fixture";
import {
  loadMessageFocusPreviewInventory,
  runMessageFocusPreflight,
} from "./message-focus-rollout-preflight";

type Environment = Readonly<Record<string, string | undefined>>;
type Scenario = (typeof messageFocusCases)[number];
type Mode = Scenario["mode"];

const requestCount = messageFocusCases.length;
const outputAllowance = messageFocusCases.reduce(
  (total, { category }) => total + getOutreachOutputBudget(category),
  0,
);

function readRunnerConfig(env: Environment) {
  const config = readHostedGateConfig(env);
  for (const [name, needed] of [
    ["MESSAGE_FOCUS_GATE_MAX_REQUESTS", requestCount],
    ["MESSAGE_FOCUS_GATE_MAX_OUTPUT_TOKENS", outputAllowance],
  ] as const) {
    const value = env[name] ?? "";
    if (
      !/^\d+$/u.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) < needed
    )
      throw new GateError(`Set an approved ${name} of at least ${needed}`);
  }
  return config;
}

function containsPrivateResponseData(value: unknown): boolean {
  if (typeof value === "string") {
    return (
      [focusCanary, noMatchCanary].some((canary) =>
        value.toLowerCase().includes(canary.toLowerCase()),
      ) ||
      /\b(?:(?:note|prose)\.[a-f0-9]{20}(?:\.\d+)?|rp1\.[a-f0-9]{24}|evidence:[a-f0-9-]{36}(?:\.fact\.[a-f0-9-]{36})?)\b/iu.test(
        value,
      )
    );
  }
  return (
    value !== null &&
    typeof value === "object" &&
    Object.values(value).some(containsPrivateResponseData)
  );
}

const positiveInteger = z.number().int().positive();
const nonnegativeInteger = z.number().int().nonnegative();
const cacheUnits = nonnegativeInteger.nullish();
const responseContract = z.strictObject({
  success: z.literal(true),
  category: z.enum(OUTREACH_GROUNDING_CATEGORIES),
  body: z.string().min(1).max(10_000),
  subject_line: z.string().min(1).max(EMAIL_SUBJECT_MAX_CHARACTERS).optional(),
  character_count: positiveInteger,
  word_count: positiveInteger.optional(),
  processingTime: nonnegativeInteger,
  selectionStatus: z.literal("matched").optional(),
  billingMode: z.enum(["credits", "unlimited_developer"]).optional(),
  creditCost: nonnegativeInteger.optional(),
  creditsRemaining: nonnegativeInteger.nullish(),
  unlimitedCredits: z.boolean().optional(),
  usage: z.strictObject({
    input_tokens: nonnegativeInteger,
    output_tokens: positiveInteger,
    cache_read_input_tokens: cacheUnits,
    cache_creation_input_tokens: cacheUnits,
    cache_creation: z
      .strictObject({
        ephemeral_1h_input_tokens: nonnegativeInteger,
        ephemeral_5m_input_tokens: nonnegativeInteger,
      })
      .nullish(),
    service_tier: z.enum(["standard", "priority", "batch"]).nullish(),
    inference_geo: z.enum(["global", "us", "eu", "jp", "au"]).nullish(),
    speed: z.enum(["standard", "fast"]).nullish(),
    server_tool_use: z
      .strictObject({
        web_fetch_requests: nonnegativeInteger.optional(),
        web_search_requests: nonnegativeInteger.optional(),
        tool_search_tool_requests: nonnegativeInteger.optional(),
      })
      .nullish(),
    output_tokens_details: z
      .strictObject({
        thinking_tokens: nonnegativeInteger,
      })
      .nullish(),
  }),
  evalMetadata: z.strictObject({
    generationId: z.uuid(),
    model: z.literal(CLAUDE_MODEL),
    promptVersion: z.string(),
    temperature: z.number().min(0).max(1),
    category: z.enum(OUTREACH_GROUNDING_CATEGORIES),
    intent: z.literal("job_inquiry"),
    emailMode: z.enum(EMAIL_MODES),
    generationTimeMs: nonnegativeInteger,
    inputTokens: nonnegativeInteger,
    outputTokens: positiveInteger,
    resumeSource: z.enum([
      "user_resumes",
      "profiles",
      "legacy_payload",
      "none",
    ]),
    hasPrimaryResume: z.boolean(),
    injectionTriggered: z.literal(false),
    safeCandidateSummaryUsed: z.literal(false),
    grounding: z.strictObject({
      groundingLevel: z.enum(OUTREACH_GROUNDING_LEVELS),
      fallbackReason: z.enum(OUTREACH_FALLBACK_REASONS),
      selectedSourceCount: nonnegativeInteger,
      selectedEvidenceCount: nonnegativeInteger,
      selectedSourceKinds: z.array(z.enum(CANDIDATE_SOURCE_KINDS)).max(3),
      injectionSafeMode: z.literal(false),
    }),
    quality: qualityMetadataSchema,
    identityIncluded: z.boolean().optional(),
    hasCandidateRelevance: z.boolean().optional(),
  }),
});

function verifyGeneration(scenario: Scenario, value: unknown) {
  const parsed = responseContract.safeParse(value);
  if (!parsed.success) throw new GateError("Wrong generation response shape");
  const result = parsed.data;
  const { body, category, evalMetadata, usage } = result;
  const focused = scenario.focus === "match";
  const privateId = /\b[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b/iu;
  if (privateId.test(body) || privateId.test(result.subject_line ?? ""))
    throw new GateError("Private identifier in draft text");
  const rendered = parseGenerationResponse(result, undefined);
  if (
    category !== scenario.category ||
    evalMetadata.category !== category ||
    evalMetadata.emailMode !== scenario.emailMode ||
    evalMetadata.generationTimeMs !== result.processingTime ||
    evalMetadata.quality.archetype !== "legacy" ||
    rendered.body !== body ||
    result.character_count !== body.length ||
    (result.selectionStatus === "matched") !== focused ||
    evalMetadata.promptVersion !== outreachPromptVersion(false, focused) ||
    evalMetadata.outputTokens > getOutreachOutputBudget(category) ||
    evalMetadata.outputTokens !== usage.output_tokens ||
    evalMetadata.inputTokens !== usage.input_tokens ||
    evalMetadata.quality.selectedSourceCount < 1
  )
    throw new GateError("Wrong generation contract");

  const constraint = resolveOutputConstraint({
    category,
    emailMode: scenario.emailMode,
    connectionNoteLimit: fixtureNoteLimit(scenario),
  });
  const count = countOutputUnits(body, constraint.unit);
  if (count < constraint.minimum || count > constraint.maximum)
    throw new GateError("Wrong output length");

  if (!matchesReviewedFixture(scenario, body))
    throw new GateError("Wrong reviewed fixture fact or order");

  if (category === "linkedin_connection") {
    if (
      !/(?:Open to connecting\?|Open to a brief chat\?|May I ask you a question\?|Would you be open to discussing the role\?) Thank you\.$/u.test(
        body,
      )
    )
      throw new GateError("Missing complete LinkedIn invitation");
  } else if (
    !result.subject_line ||
    rendered.subject_line !== result.subject_line ||
    result.word_count !== count ||
    !/(?:^|\n|Thank you\. )(?:Would you be open to a brief conversation\?|Open to a brief chat\?)(?:$|\n)/u.test(
      body,
    )
  )
    throw new GateError("Wrong prose subject, word count or invitation");

  return {
    count,
    unit: constraint.unit,
    promptVersion: evalMetadata.promptVersion,
    inputTokens: evalMetadata.inputTokens,
    outputTokens: evalMetadata.outputTokens,
    ...(usage.cache_creation_input_tokens == null
      ? {}
      : { cacheWriteTokens: usage.cache_creation_input_tokens }),
    ...(usage.cache_read_input_tokens == null
      ? {}
      : { cacheReadTokens: usage.cache_read_input_tokens }),
  };
}

type Observation = {
  name: string;
  mode: Mode;
  category: Scenario["category"];
  emailMode: Scenario["emailMode"];
  requestId: string;
  expectedStatus: Scenario["expectedStatus"];
  status?: number;
  startedAt: string;
  latencyMs: number;
} & (
  | {
      passed: true;
      code?: "MESSAGE_FOCUS_UNAVAILABLE" | "MESSAGE_FOCUS_NO_MATCH";
      output?: ReturnType<typeof verifyGeneration>;
    }
  | { passed: false; reason: string }
);

export async function runMessageFocusHostedGate(
  env: Environment,
  inventory: unknown,
  transport = fetch,
) {
  const config = readRunnerConfig(env);
  await runMessageFocusPreflight(env, inventory, transport);
  const previewHeaders = { [bypassHeader]: config.bypass };
  function send(url: URL, init: RequestInit, timeoutMs: number) {
    return transport(url, {
      ...init,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  const versionContract = z.object({
    extensionVersion: z.literal(manifest.version),
    api: z.object({ currentVersion: z.literal(CURRENT_EXTENSION_API_VERSION) }),
  });
  for (const { mode, url } of config.targets) {
    try {
      const response = await send(
        new URL("/api/extension/version", url),
        {
          headers: previewHeaders,
        },
        15_000,
      );
      if (
        response.status !== 200 ||
        !versionContract.safeParse(await response.json()).success
      )
        throw new Error();
    } catch {
      throw new GateError(`Extension version contract mismatch (${mode})`);
    }
  }

  const sessions = new Map<Mode, string>();
  for (const { mode, email, password, userId } of config.targets) {
    try {
      const auth = await send(
        new URL("/auth/v1/token?grant_type=password", config.supabase),
        {
          method: "POST",
          headers: {
            apikey: config.publishableKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        },
        15_000,
      );
      if (auth.status !== 200) throw new Error();
      const session = z
        .object({
          access_token: z.string().min(1),
          user: z.object({ id: z.literal(userId) }),
        })
        .parse(await auth.json());
      sessions.set(mode, session.access_token);
    } catch {
      throw new GateError(`Synthetic account sign-in failed (${mode})`);
    }
  }

  const startedAt = new Date().toISOString();
  const results: Observation[] = [];
  for (const scenario of messageFocusCases) {
    const { name, mode, category, emailMode, expectedStatus, legacy } =
      scenario;
    const requestId = randomUUID();
    const requestStartedAt = new Date().toISOString();
    const started = performance.now();
    let status: number | undefined;
    try {
      const target = config.targets.find((target) => target.mode === mode)!;
      const response = await send(
        new URL("/api/extension/generate", target.url),
        {
          method: "POST",
          headers: {
            ...previewHeaders,
            "content-type": "application/json",
            "x-request-id": requestId,
            "x-aletheia-operation-id": requestId,
            authorization: `Bearer ${sessions.get(mode)!}`,
            ...(legacy
              ? {}
              : {
                  [EXTENSION_API_VERSION_HEADER]: CURRENT_EXTENSION_API_VERSION,
                  [EXTENSION_VERSION_HEADER]: manifest.version,
                }),
          },
          body: JSON.stringify(messageFocusPayload(scenario)),
        },
        180_000,
      );
      status = response.status;
      if (status !== expectedStatus)
        throw new GateError(`Expected HTTP ${expectedStatus}`);
      const data: unknown = await response.json();
      if (containsPrivateResponseData(data))
        throw new GateError("Private data in response");
      const observation = {
        name,
        mode,
        category,
        emailMode,
        requestId,
        expectedStatus,
        status,
        startedAt: requestStartedAt,
        latencyMs: Math.round(performance.now() - started),
      };
      if (expectedStatus === 200) {
        results.push({
          ...observation,
          passed: true,
          output: verifyGeneration(scenario, data),
        });
      } else {
        const expected =
          expectedStatus === 409
            ? ({
                code: "MESSAGE_FOCUS_UNAVAILABLE",
                error: "Message focus is not available yet",
                message: "Clear Message focus to use automatic generation.",
              } as const)
            : ({
                code: "MESSAGE_FOCUS_NO_MATCH",
                error: "No eligible reviewed experience matches this focus",
                message:
                  "Edit or clear Message focus, or confirm a matching fact.",
              } as const);
        const denial = z.strictObject({
          success: z.literal(false),
          code: z.literal(expected.code),
          error: z.literal(expected.error),
          message: z.literal(expected.message),
        });
        if (!denial.safeParse(data).success)
          throw new GateError("Wrong focus rejection contract");
        results.push({ ...observation, passed: true, code: expected.code });
      }
    } catch (error) {
      results.push({
        name,
        mode,
        category,
        emailMode,
        requestId,
        expectedStatus,
        ...(status === undefined ? {} : { status }),
        startedAt: requestStartedAt,
        latencyMs: Math.round(performance.now() - started),
        passed: false,
        reason:
          error instanceof GateError
            ? error.message
            : "Request or response could not be verified",
      });
      break;
    }
  }

  return {
    schemaVersion: 1,
    deploymentSha: config.sha,
    startedAt,
    extensionVersion: manifest.version,
    generationRequestCount: requestCount,
    maxOutputTokens: outputAllowance,
    passed:
      results.length === requestCount && results.every(({ passed }) => passed),
    releaseDecision: "hold",
    results,
  } as const;
}

async function main() {
  try {
    const { projectId, sha } = readRunnerConfig(process.env);
    const gitOptions: ExecFileSyncOptionsWithStringEncoding = {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
    };
    if (
      execFileSync("git", ["rev-parse", "HEAD"], gitOptions).trim() !== sha ||
      execFileSync("git", ["status", "--porcelain"], gitOptions).trim()
    )
      throw new GateError("Check out the approved SHA in a clean worktree");
    const report = await runMessageFocusHostedGate(
      process.env,
      loadMessageFocusPreviewInventory(projectId),
    );
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    const reason =
      error instanceof GateError ? error.message : "Protected request failed";
    process.stdout.write(
      JSON.stringify({
        schemaVersion: 1,
        passed: false,
        releaseDecision: "hold",
        setupError: reason,
        results: [],
      }) + "\n",
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
