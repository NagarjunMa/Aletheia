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
] as const;
type Stage = (typeof STAGES)[number];
type Category = (typeof CATEGORIES)[number];
type Metrics = Partial<Record<(typeof METRICS)[number], number>>;
const MAX_NUMBER = 1_000_000_000;

export function createGenerationTiming(
  now: () => number = () => performance.now(),
) {
  const initial = now();
  let elapsed = 0;
  let boundary = 0;
  let active: Stage = "authDispatch";
  let category: Category | "unknown" = "unknown";
  let failedStage: Stage | undefined;
  const stages = Object.fromEntries(
    STAGES.map((stage) => [stage, null]),
  ) as Record<Stage, number | null>;
  const metrics: Metrics = {};
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
        ? { errorCode: "GENERATION_FAILED", failedStage: failedStage ?? active }
        : {}),
      stages: { ...stages },
      metrics: { ...metrics },
    };
  }
  return {
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
