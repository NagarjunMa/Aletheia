import { type NextRequest } from "next/server";
import { createRequestLogger, type SafeLogger } from "@/lib/logger";

/**
 * Records one safe request start event and exactly one terminal outcome while
 * leaving the handler's response contract untouched.
 */
export async function withRequestLifecycle<TResponse extends Response>(
  module: string,
  request: NextRequest,
  handler: (_log: SafeLogger) => Promise<TResponse>,
): Promise<TResponse> {
  const log = createRequestLogger(module, request);
  const startedAt = Date.now();
  log.info({ event: "request.start", outcome: "started" }, "Request started");

  try {
    const response = await handler(log);
    log.info(
      {
        event: "request.complete",
        outcome: response.ok ? "success" : "failure",
        status: response.status,
        durationMs: Date.now() - startedAt,
      },
      "Request completed",
    );
    return response;
  } catch (error) {
    log.error(
      {
        event: "request.complete",
        outcome: "failure",
        status: 500,
        errorCode: "UNHANDLED_REQUEST_ERROR",
        durationMs: Date.now() - startedAt,
      },
      "Request failed unexpectedly",
    );
    throw error;
  }
}
