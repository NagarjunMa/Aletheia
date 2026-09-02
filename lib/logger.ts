import pino from "pino";
import { randomUUID } from "crypto";
import {
  LOG_SCHEMA_VERSION,
  createCorrelationId,
  safeDurationMs,
  sanitizeLogFields,
  type SafeLogFields,
} from "./logging-core";

const isDev = process.env.NODE_ENV !== "production";

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

type LogLevel = "debug" | "info" | "warn" | "error";

export type SafeLogger = {
  debug: (_fields: SafeLogFields | string, _message?: string) => void;
  info: (_fields: SafeLogFields | string, _message?: string) => void;
  warn: (_fields: SafeLogFields | string, _message?: string) => void;
  error: (_fields: SafeLogFields | Error | string, _message?: string) => void;
  child: (_fields: SafeLogFields) => SafeLogger;
};

function writeLog(
  logger: pino.Logger,
  level: LogLevel,
  fields: SafeLogFields | Error | string,
  message?: string,
) {
  const safeMessage =
    typeof message === "string" ? message.slice(0, 160) : undefined;
  if (typeof fields === "string") {
    logger[level](fields.slice(0, 160));
    return;
  }
  logger[level](
    sanitizeLogFields(fields instanceof Error ? { error: fields } : fields),
    safeMessage,
  );
}

function wrapLogger(logger: pino.Logger): SafeLogger {
  return {
    debug: (fields, message) => writeLog(logger, "debug", fields, message),
    info: (fields, message) => writeLog(logger, "info", fields, message),
    warn: (fields, message) => writeLog(logger, "warn", fields, message),
    error: (fields, message) => writeLog(logger, "error", fields, message),
    child: (fields) => wrapLogger(logger.child(sanitizeLogFields(fields))),
  };
}

export function createLogger(module: string) {
  return wrapLogger(
    baseLogger.child({ module, logSchemaVersion: LOG_SCHEMA_VERSION }),
  );
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
  const requestId = createCorrelationId(
    request.headers.get("x-request-id"),
    randomUUID,
  );
  const operationId = request.headers.get("x-aletheia-operation-id");
  return createLogger(module).child({
    event: "request.context",
    module,
    requestId,
    ...(operationId
      ? { operationId: createCorrelationId(operationId, randomUUID) }
      : {}),
    method: request.method,
    path: url.pathname,
    ...(extra ? sanitizeLogFields(extra) : {}),
  });
}

export function startTimedStage(
  logger: SafeLogger,
  stage: string,
  fields: SafeLogFields = {},
) {
  const startedAt = Date.now();
  logger.info(
    { event: "stage.start", stage, outcome: "started", ...fields },
    "Process stage started",
  );

  return (
    outcome: "success" | "failure",
    terminalFields: SafeLogFields = {},
  ) => {
    logger.info(
      {
        event: "stage.complete",
        stage,
        outcome,
        durationMs: safeDurationMs(startedAt),
        ...terminalFields,
      },
      "Process stage completed",
    );
  };
}
