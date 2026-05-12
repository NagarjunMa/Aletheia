import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createLogger(module: string) {
  return baseLogger.child({ module });
}

export function createRequestLogger(
  module: string,
  request: {
    method: string;
    url: string;
    headers: { get(_name: string): string | null };
  },
  extra?: Record<string, unknown>,
) {
  const url = new URL(request.url, "http://localhost");
  return baseLogger.child({
    module,
    requestId: request.headers.get("x-request-id") ?? undefined,
    method: request.method,
    path: url.pathname,
    origin: request.headers.get("origin") ?? undefined,
    ...extra,
  });
}
