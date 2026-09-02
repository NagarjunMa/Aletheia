import {
  LOG_SCHEMA_VERSION,
  createCorrelationId,
  sanitizeLogFields,
} from "./logging-core";

// Edge Runtime-compatible logger — console only, no pino, no Node.js streams.
// Used exclusively by proxy.ts at the Next.js network boundary.
// API routes use lib/logger.ts (Node.js runtime, pino JSON stdout).

type LogObj = Record<string, unknown>;

function makeEdgeLogger(module: string) {
  function log(
    level: "debug" | "info" | "warn" | "error",
    obj: LogObj | string,
    msg?: string,
  ) {
    const entry =
      typeof obj === "string"
        ? {
            level,
            module,
            logSchemaVersion: LOG_SCHEMA_VERSION,
            msg: obj.slice(0, 160),
            time: new Date().toISOString(),
          }
        : {
            level,
            module,
            logSchemaVersion: LOG_SCHEMA_VERSION,
            ...sanitizeLogFields(obj),
            msg: msg?.slice(0, 160) ?? "",
            time: new Date().toISOString(),
          };
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else if (level === "debug") console.debug(line);
    else console.log(line);
  }

  return {
    debug: (obj: LogObj | string, msg?: string) => log("debug", obj, msg),
    info: (obj: LogObj | string, msg?: string) => log("info", obj, msg),
    warn: (obj: LogObj | string, msg?: string) => log("warn", obj, msg),
    error: (obj: LogObj | string, msg?: string) => log("error", obj, msg),
  };
}

export function createLogger(module: string) {
  return makeEdgeLogger(module);
}

export function getEdgeCorrelationIds(headers: Headers) {
  return {
    requestId: createCorrelationId(
      headers.get("x-request-id"),
      crypto.randomUUID,
    ),
    operationId: headers.get("x-aletheia-operation-id")
      ? createCorrelationId(
          headers.get("x-aletheia-operation-id"),
          crypto.randomUUID,
        )
      : undefined,
  };
}
