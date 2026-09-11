/** Sequential, request-local timing: stages partition wall time, never overlap.
 * Null means unvisited, not zero latency. No user/model text is accepted.
 * Input/output units are model tokens; names survive the mandatory redactor.
 */
const STAGES = [
  "authDispatch",
  "groundingLoad",
  "groundingBuild",
  "styleLoad",
  "rateLimit",
  "billing",
  "contextHydration",
  "inputBuild",
  "model",
  "postProcessing",
  "refund",
] as const;
const CATEGORIES = [
  "yc_application",
  "linkedin_connection",
  "cold_email",
  "linkedin_inmail",
] as const;
const METRICS = [
  "inputChars",
  "sourceChars",
  "sourceCount",
  "inputUnits",
  "outputUnits",
  "cacheReadUnits",
  "cacheWriteUnits",
  "targetChars",
  "contextChars",
  "exampleCount",
  "resultChars",
  "claimCount",
  "ledgerChars",
] as const;
const CONFIG_ENUMS = {
  intent: ["networking", "referral", "mentorship", "job_inquiry"],
  mode: [
    "initial_outreach",
    "founder_ceo_outreach",
    "follow_up",
    "clarification",
    "role_fit_summary",
    "referral_request",
  ],
  billingMode: ["disabled", "unlimited", "metered"],
  stopReason: [
    "end_turn",
    "max_tokens",
    "stop_sequence",
    "tool_use",
    "pause_turn",
    "refusal",
  ],
} as const;
type Config = Partial<
  Record<keyof typeof CONFIG_ENUMS, string> & {
    temperature: number;
    maxOutputUnits: number;
    clientVersion: string;
  }
>;
type Stage = (typeof STAGES)[number];
type Category = (typeof CATEGORIES)[number];
type Metrics = Partial<Record<(typeof METRICS)[number], number>>;
const MAX_NUMBER = 1_000_000_000;
// Shared with the offline projection; never accept arbitrary error text/codes.
export const GENERATION_FAILURE_CODES = [
  "GENERATION_FAILED",
  "MODEL_TIMEOUT",
  "MODEL_ABORTED",
  "MODEL_REQUEST_FAILED",
  "OUTPUT_VALIDATION_FAILED",
  "INPUT_VALIDATION_FAILED",
  "GROUNDING_CONTEXT_UNAVAILABLE",
  "FETCH_ABORTED",
  "PROVIDER_FETCH_FAILED",
  "CREDIT_REFUND_FAILED",
  "RATE_LIMIT_RELEASE_FAILED",
] as const;

export function createGenerationTiming(
  now: () => number = () => performance.now(),
) {
  const initial = now();
  let elapsed = 0;
  let boundary = 0;
  let active: Stage = "authDispatch";
  let category: Category | "unknown" = "unknown";
  let failedStage: Stage | undefined;
  let failureCode: (typeof GENERATION_FAILURE_CODES)[number] =
    "GENERATION_FAILED";
  const stages = Object.fromEntries(
    STAGES.map((stage) => [stage, null]),
  ) as Record<Stage, number | null>;
  const metrics: Metrics = {};
  const config: Config = {};
  let finished: ReturnType<typeof snapshot> | undefined;
  function tick() {
    const delta = now() - initial;
    if (Number.isFinite(delta))
      elapsed = Math.max(elapsed, Math.min(MAX_NUMBER, Math.round(delta)));
    stages[active] = (stages[active] ?? 0) + elapsed - boundary;
    boundary = elapsed;
  }
  function snapshot(status: number) {
    return {
      event: "generation.timing",
      category,
      outcome: status < 400 ? "success" : "failure",
      status,
      durationMs: elapsed,
      terminalStage: active,
      ...(status >= 400
        ? { errorCode: failureCode, failedStage: failedStage ?? active }
        : {}),
      stages: { ...stages },
      metrics: { ...metrics },
      config: { ...config },
    };
  }
  return {
    failure(code: (typeof GENERATION_FAILURE_CODES)[number]) {
      if (!finished && GENERATION_FAILURE_CODES.includes(code))
        failureCode = code;
    },
    config(values: Config) {
      if (finished) return;
      if (
        typeof values.clientVersion === "string" &&
        /^\d{1,5}(\.\d{1,5}){1,3}$/.test(values.clientVersion)
      )
        config.clientVersion = values.clientVersion;
      for (const key of Object.keys(
        CONFIG_ENUMS,
      ) as (keyof typeof CONFIG_ENUMS)[]) {
        const value = values[key];
        if (
          typeof value === "string" &&
          (CONFIG_ENUMS[key] as readonly string[]).includes(value)
        )
          config[key] = value;
      }
      for (const key of ["temperature", "maxOutputUnits"] as const) {
        const value = values[key];
        if (
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= MAX_NUMBER
        )
          config[key] = value;
      }
    },
    enter(stage: Stage) {
      if (finished || !STAGES.includes(stage)) return;
      if (stage === "refund" && active !== "refund" && !failedStage)
        failedStage = active;
      tick();
      active = stage;
    },
    category(value: Category) {
      if (!finished && CATEGORIES.includes(value)) category = value;
    },
    metrics(values: Metrics) {
      if (finished) return;
      for (const key of METRICS) {
        const value = values[key];
        if (typeof value === "number" && Number.isFinite(value) && value >= 0)
          metrics[key] = Math.min(MAX_NUMBER, Math.round(value));
      }
    },
    finish(status: number) {
      if (!finished) {
        tick();
        finished = snapshot(status);
      }
      return finished;
    },
  };
}

export type GenerationTiming = ReturnType<typeof createGenerationTiming>;
