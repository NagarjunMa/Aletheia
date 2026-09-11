import type { SafeLogFields } from "./logging-core";
import type Anthropic from "@anthropic-ai/sdk";
type MeasurementLogger = { info: (_fields: SafeLogFields) => void };

/** Observability must never replace a generation result or its original error. */
export function recordMeasurement(
  logger: MeasurementLogger,
  fields: SafeLogFields,
): void {
  try {
    logger.info(fields);
  } catch {
    /* Existing stdout telemetry is best effort. */
  }
}
const elapsed = (start: number, now: () => number) =>
  Math.max(0, Math.min(1e9, Math.round(now() - start)));

function fetchFailureCode(error: unknown) {
  // A fetch abort can be the SDK timer or a caller signal. Only the SDK can
  // classify the final timeout; do not guess here or read the error message.
  try {
    return error instanceof Error && error.name === "AbortError"
      ? "FETCH_ABORTED"
      : "PROVIDER_FETCH_FAILED";
  } catch {
    return "PROVIDER_FETCH_FAILED";
  }
}

/** The pinned SDK's transport is private. Its public per-attempt timeout
 * boundary preserves that transport and includes only timer/signal setup. */
export function observeAnthropicAttempts(
  client: Anthropic,
  logger: MeasurementLogger,
): void {
  if (typeof client.fetchWithTimeout !== "function") return;
  const transport = { fetch: client.fetchWithTimeout.bind(client) };
  observeProviderFetch(transport, logger);
  client.fetchWithTimeout = transport.fetch;
}

/** Wrap only the client's existing fetch. The SDK still owns retries, signals,
 * request serialization and response consumption. Resolution measures headers,
 * not body consumption, first generated token or model decoding speed. */
export function observeProviderFetch<
  A extends unknown[],
  R extends { status: number },
>(
  client: { fetch: (..._args: A) => Promise<R> },
  logger: MeasurementLogger,
  now: () => number = () => performance.now(),
): void {
  const transport = client.fetch;
  // Mocked/alternate SDK clients may not expose a transport; usage is unknown.
  if (typeof transport !== "function") return;
  let attempt = 0,
    previousEnd: number | undefined;
  client.fetch = async function (this: unknown, ...args: A): Promise<R> {
    const start = now(),
      ordinal = ++attempt;
    const gapMs =
      previousEnd === undefined ? undefined : elapsed(previousEnd, () => start);
    try {
      const response = await transport.apply(this, args);
      previousEnd = now();
      recordMeasurement(logger, {
        event: "provider.attempt",
        attempt: ordinal,
        durationMs: elapsed(start, () => previousEnd ?? start),
        status: response.status,
        outcome: response.status < 400 ? "success" : "failure",
        ...(gapMs === undefined ? {} : { gapMs }),
      });
      return response;
    } catch (error) {
      previousEnd = now();
      recordMeasurement(logger, {
        event: "provider.attempt",
        attempt: ordinal,
        durationMs: elapsed(start, () => previousEnd ?? start),
        outcome: "failure",
        errorCode: fetchFailureCode(error),
        ...(gapMs === undefined ? {} : { gapMs }),
      });
      throw error;
    }
  };
}

export async function observeQuery<T extends { error: unknown }>(
  stage: "context" | "evidence" | "primary" | "legacy",
  query: PromiseLike<T>,
  logger: MeasurementLogger,
): Promise<T> {
  const start = performance.now();
  let outcome = "failure";
  try {
    const result = await query;
    outcome = result.error ? "failure" : "success";
    return result;
  } finally {
    recordMeasurement(logger, {
      event: "candidate.query",
      stage,
      outcome,
      durationMs: elapsed(start, () => performance.now()),
    });
  }
}
