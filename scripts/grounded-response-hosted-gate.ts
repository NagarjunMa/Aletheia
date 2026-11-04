import { pathToFileURL } from "node:url";
import manifest from "../ascendia-extension/manifest.json";
import {
  buildGeneratePayload,
  parseGenerationResponse,
} from "../ascendia-extension/popup/popup-core.js";
import { ycApplicationPublicSuccessSchema } from "../app/api/extension/generate/schema";
import {
  CURRENT_EXTENSION_API_VERSION,
  EXTENSION_API_VERSION_HEADER,
  EXTENSION_VERSION_HEADER,
} from "../lib/extension-contract";
import {
  PROMPT_VERSION,
  RHETORICAL_OUTREACH_PROMPT_VERSION,
} from "../lib/ai/prompts/linkedin-connection";
import {
  RHETORICAL_YC_PROMPT_VERSION,
  YC_APPLICATION_PROMPT_VERSION,
} from "../lib/ai/prompts/yc-application";
import { getOutreachOutputBudget } from "../modules/outreach/infrastructure/anthropic.repository";
import { getApplicationOutputBudget } from "../modules/application-answer/infrastructure/anthropic-yc.repository";
import { qualityMetadataSchema } from "../lib/ai/generation-quality";
import {
  LINKEDIN_CONNECTION_MAX_CHARACTERS,
  EMAIL_SUBJECT_MAX_CHARACTERS,
  countOutputUnits,
  resolveOutputConstraint,
} from "../lib/ai/output-constraints";
import { z } from "zod";
import {
  injectedProfileMarkdown,
  injectionCanary,
  job,
  linkedinCandidateFacts,
  linkedinJob,
  profileMarkdown,
  questions,
} from "./grounded-response-hosted-fixture";

const modes = ["off", "on"] as const;
type Mode = (typeof modes)[number];
const bypassHeader = "x-vercel-protection-bypass";
const shaPattern = /^[a-f0-9]{40}$/u;
const projectPattern = /^prj_[a-z0-9_]+$/iu;
const vercelHost = /^[a-z0-9][a-z0-9-]*\.vercel\.app$/u;
const supabaseHost = /^[a-z0-9]+\.supabase\.co$/u;

class GateError extends Error {}

export function readHostedGateConfig(
  env: Readonly<Record<string, string | undefined>>,
) {
  function required(key: string) {
    const value = env[`GROUNDED_GATE_${key}`];
    if (!value?.trim()) throw new GateError(`Missing configuration: ${key}`);
    return value;
  }

  function origin(key: string, hostPattern: RegExp) {
    const value = required(key);
    const url = URL.parse(value);
    if (
      !url ||
      url.protocol !== "https:" ||
      !hostPattern.test(url.hostname) ||
      (value !== url.origin && value !== `${url.origin}/`)
    )
      throw new GateError(`Invalid origin: ${key}`);
    return url;
  }

  if (required("CONFIRM") !== "yes")
    throw new GateError("Isolation confirmation required");
  const sha = required("SHA");
  if (!shaPattern.test(sha)) throw new GateError("Full workflow SHA required");

  const projectId = required("PROJECT_ID");
  const productionProjectId = required("PRODUCTION_PROJECT_ID");
  if (
    !projectPattern.test(projectId) ||
    !projectPattern.test(productionProjectId) ||
    projectId.toLowerCase() === productionProjectId.toLowerCase()
  )
    throw new GateError("Isolated Vercel project identity required");

  const productionApp = origin("PRODUCTION_APP_URL", /^[a-z0-9.-]+[a-z0-9]$/u);
  const supabase = origin("SUPABASE_URL", supabaseHost);
  const productionSupabase = origin("PRODUCTION_SUPABASE_URL", supabaseHost);
  if (supabase.origin === productionSupabase.origin)
    throw new GateError("Production Supabase project is forbidden");

  const publishableKey = required("SUPABASE_PUBLISHABLE_KEY");
  if (!/^sb_publishable_[\w-]+$/u.test(publishableKey))
    throw new GateError("Supabase publishable key required");

  const targets = modes.map((mode) => {
    const prefix = mode.toUpperCase();
    const url = origin(`${prefix}_URL`, vercelHost);
    if (url.hostname === productionApp.hostname)
      throw new GateError("Production application is forbidden");

    const userId = required(`${prefix}_USER_ID`);
    const email = required(`${prefix}_EMAIL`);
    if (
      !z.uuid().safeParse(userId).success ||
      !/^[a-z0-9._+-]+@example\.test$/iu.test(email)
    )
      throw new GateError("Dedicated synthetic account required");
    return {
      mode,
      url,
      userId,
      email,
      password: required(`${prefix}_PASSWORD`),
    };
  });
  if (
    new Set(targets.map(({ url }) => url.origin)).size !== modes.length ||
    new Set(targets.map(({ userId }) => userId.toLowerCase())).size !==
      modes.length ||
    new Set(targets.map(({ email }) => email.toLowerCase())).size !==
      modes.length
  )
    throw new GateError("Distinct Preview deployments and accounts required");

  return {
    sha,
    projectId,
    supabase,
    publishableKey,
    targets,
    bypass: required("VERCEL_BYPASS"),
  };
}

const profile = { profileMarkdown };
const cases = [
  {
    name: "linkedin_with_job",
    category: "linkedin_connection",
    profile,
    context: linkedinJob,
  },
  {
    name: "legacy_linkedin_profile_fallback",
    category: "linkedin_connection",
    profile,
    context: "",
  },
  { name: "cold_email", category: "cold_email", profile, context: job },
  { name: "inmail", category: "linkedin_inmail", profile, context: job },
  { name: "yc_two_answers", category: "yc_application", profile, context: job },
  {
    name: "mixed_profile_injection_refusal",
    category: "linkedin_connection",
    profile: { profileMarkdown: injectedProfileMarkdown },
    context: "",
  },
] as const;
type Scenario = (typeof cases)[number];

const responseContract = z.object({
  success: z.literal(true),
  category: z.enum([
    "linkedin_connection",
    "cold_email",
    "linkedin_inmail",
    "yc_application",
  ]),
  body: z.string().trim().min(1).max(22_000),
  subject_line: z.string().trim().min(1).optional(),
  character_count: z.number().int().positive(),
  word_count: z.number().int().positive().optional(),
  usage: z.object({
    input_tokens: z.number().int().positive(),
    output_tokens: z.number().int().positive(),
  }),
  evalMetadata: z.object({
    promptVersion: z.string(),
    inputTokens: z.number().int().positive(),
    outputTokens: z.number().int().positive(),
    injectionTriggered: z.boolean(),
    quality: qualityMetadataSchema,
  }),
});

const privateFields =
  /^(?:provenance|claims|atomicSources|supporting_?excerpt|selected_?source_?ids?|source_?ids?|option_?id|excludedClaims|rhetorical_?plan|targetDiagnostics|selectionDiagnostics|injectionReasons)$/iu;

function hasPrivateResponseData(value: unknown): boolean {
  if (typeof value === "string")
    return (
      value.includes(injectionCanary) || /\brp1\.[a-f0-9]{24}\b/u.test(value)
    );
  return (
    value !== null &&
    typeof value === "object" &&
    Object.entries(value).some(
      ([key, child]) =>
        privateFields.test(key) || hasPrivateResponseData(child),
    )
  );
}

function verifyGeneration(mode: Mode, scenario: Scenario, value: unknown) {
  if (hasPrivateResponseData(value))
    throw new GateError("Private response data");
  const response = responseContract.parse(value);
  const { category, body, character_count, evalMetadata } = response;
  const application = category === "yc_application";
  const promptVersion = application
    ? mode === "on"
      ? RHETORICAL_YC_PROMPT_VERSION
      : YC_APPLICATION_PROMPT_VERSION
    : mode === "on"
      ? RHETORICAL_OUTREACH_PROMPT_VERSION
      : PROMPT_VERSION;
  const outputCap = application
    ? getApplicationOutputBudget(questions.length)
    : getOutreachOutputBudget(category);
  const fallback = scenario.name === "legacy_linkedin_profile_fallback";

  if (
    category !== scenario.category ||
    body.length !== character_count ||
    evalMetadata.promptVersion !== promptVersion ||
    evalMetadata.outputTokens > outputCap ||
    evalMetadata.injectionTriggered ||
    response.usage.input_tokens !== evalMetadata.inputTokens ||
    response.usage.output_tokens !== evalMetadata.outputTokens ||
    (evalMetadata.quality.archetype === "legacy") !== (mode === "off")
  )
    throw new GateError("Generation contract mismatch");

  if (application) {
    const answer = ycApplicationPublicSuccessSchema.parse(value);
    if (answer.answers?.length !== questions.length)
      throw new GateError("Application batch shape mismatch");
    parseGenerationResponse(answer, questions);
  } else {
    const rendered = parseGenerationResponse(response, undefined);
    if (category === "linkedin_connection") {
      const target = fallback
        ? "I'm interested in AI Evaluation and your Engineering Manager role at Example."
        : "I'm interested in the openings for Engineers with the Evaluation team at Example.";
      if (
        body.length > LINKEDIN_CONNECTION_MAX_CHARACTERS ||
        !body.includes(target) ||
        evalMetadata.quality.selectedSourceCount < 2 ||
        !evalMetadata.quality.selectedSourceKinds.includes(
          "target_observation",
        ) ||
        !linkedinCandidateFacts.some((fact) => body.includes(fact))
      )
        throw new GateError("LinkedIn provenance or character budget mismatch");
    } else {
      const words = countOutputUnits(rendered.body, "words");
      const { minimum, maximum } = resolveOutputConstraint({
        category,
        emailMode: "initial_outreach",
      });
      if (
        rendered.body !== body ||
        !rendered.subject_line ||
        rendered.subject_line !== response.subject_line ||
        rendered.subject_line.length > EMAIL_SUBJECT_MAX_CHARACTERS ||
        response.word_count !== words ||
        words < minimum ||
        words > maximum
      )
        throw new GateError("Prose response contract mismatch");
    }
  }
  return {
    promptVersion,
    inputTokens: evalMetadata.inputTokens,
    outputTokens: evalMetadata.outputTokens,
  };
}

export async function runHostedGate(
  config: ReturnType<typeof readHostedGateConfig>,
  transport = fetch,
) {
  const vercelHeaders = { [bypassHeader]: config.bypass };
  const health = z.object({
    status: z.literal("ok"),
    deploymentSha: z.literal(config.sha),
    supabaseOrigin: z.literal(config.supabase.origin),
    groundedResponseGate: z.object({
      projectId: z.literal(config.projectId),
      deploymentHost: z.string(),
      rhetoricalPlans: z.boolean(),
    }),
  });

  function send(url: URL, init: RequestInit = {}, timeoutMs = 15_000) {
    return transport(url, {
      ...init,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  for (const target of config.targets) {
    const url = new URL("/api/health", target.url);
    const locked = await send(url);
    if (![301, 302, 303, 307, 308, 401, 403].includes(locked.status))
      throw new GateError(`Preview protection check failed (${target.mode})`);
    const response = await send(url, { headers: vercelHeaders });
    const identity =
      response.status === 200
        ? health.safeParse(await response.json())
        : undefined;
    if (
      !identity?.success ||
      identity.data.groundedResponseGate.deploymentHost !==
        target.url.hostname ||
      identity.data.groundedResponseGate.rhetoricalPlans !==
        (target.mode === "on")
    )
      throw new GateError(`Preview identity check failed (${target.mode})`);
  }

  const sessions = [];
  for (const target of config.targets) {
    const version = await send(new URL("/api/extension/version", target.url), {
      headers: vercelHeaders,
    });
    const versionContract = z.object({
      extensionVersion: z.literal(manifest.version),
      api: z.object({
        currentVersion: z.literal(CURRENT_EXTENSION_API_VERSION),
        supportedVersions: z
          .array(z.string())
          .refine((versions) =>
            versions.includes(CURRENT_EXTENSION_API_VERSION),
          ),
      }),
    });
    if (
      version.status !== 200 ||
      !versionContract.safeParse(await version.json()).success
    )
      throw new GateError(
        `Extension version contract mismatch (${target.mode})`,
      );

    const auth = await send(
      new URL("/auth/v1/token?grant_type=password", config.supabase),
      {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: target.email,
          password: target.password,
        }),
      },
    );
    const authContract = z.object({
      access_token: z.string().min(1),
      user: z.object({ id: z.literal(target.userId) }),
    });
    const session =
      auth.status === 200
        ? authContract.safeParse(await auth.json())
        : undefined;
    if (!session?.success)
      throw new GateError(`Synthetic account sign-in failed (${target.mode})`);
    sessions.push({ target, token: session.data.access_token });
  }

  const results = [];
  for (const scenario of cases) {
    for (const { target, token } of sessions) {
      const { mode } = target;
      const legacy = scenario.name === "legacy_linkedin_profile_fallback";
      const payload = buildGeneratePayload(
        scenario.profile,
        "",
        scenario.context,
        scenario.category,
        "job_inquiry",
        [],
        "initial_outreach",
        scenario.category === "yc_application" ? questions.join("\n") : "",
      );
      const headers = {
        ...vercelHeaders,
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(legacy
          ? {}
          : {
              [EXTENSION_API_VERSION_HEADER]: CURRENT_EXTENSION_API_VERSION,
              [EXTENSION_VERSION_HEADER]: manifest.version,
            }),
      };
      try {
        const started = performance.now();
        const response = await send(
          new URL("/api/extension/generate", target.url),
          {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          },
          180_000,
        );
        const value: unknown = await response.json();
        const latencyMs = Math.round(performance.now() - started);
        if (scenario.name === "mixed_profile_injection_refusal") {
          const rejection = z
            .strictObject({
              error: z.string().min(1),
              code: z.literal("INSUFFICIENT_GROUNDING"),
              billing: z.literal("none"),
              reasonCodes: z
                .array(z.string())
                .refine((codes) => codes.includes("TARGET_INJECTION_DETECTED")),
            })
            .safeParse(value);
          if (
            response.status !== 422 ||
            !rejection.success ||
            hasPrivateResponseData(value)
          )
            throw new GateError("Expected injection refusal");
          results.push({
            mode,
            scenario: scenario.name,
            status: 422,
            latencyMs,
          });
        } else {
          if (response.status !== 200)
            throw new GateError(
              `Expected generation success, got HTTP ${response.status}`,
            );
          results.push({
            mode,
            scenario: scenario.name,
            status: 200,
            latencyMs,
            ...verifyGeneration(mode, scenario, value),
          });
        }
      } catch (error) {
        const reason =
          error instanceof GateError
            ? error.message
            : "Request or response contract failed";
        throw new GateError(`${mode}/${scenario.name}: ${reason}`);
      }
    }
  }

  return {
    schemaVersion: 1,
    deploymentSha: config.sha,
    hostedModeChecksPassed: true,
    releaseDecision: "hold",
    results,
  } as const;
}

async function main() {
  try {
    const config = readHostedGateConfig(process.env);
    const report = await runHostedGate(config);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } catch (error) {
    const reason =
      error instanceof GateError ? error.message : "Protected request failed";
    process.stderr.write(`Grounded response hosted gate failed. ${reason}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
