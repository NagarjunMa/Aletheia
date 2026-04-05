import pino from "pino";
import { trace } from "@opentelemetry/api";
import { Writable } from "node:stream";

const isDev = process.env.NODE_ENV !== "production";

// Inject active OTel trace/span IDs into every log line so Grafana
// Loki logs link directly to Grafana Tempo traces.
function otelMixin() {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
}

const pinoOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin: otelMixin,
};

// Build a writable stream that pushes each log line to Grafana Loki via HTTP.
// Uses fetch only — no Node.js stream dependencies — so it works in API routes
// (Node.js runtime) without touching Edge Runtime code paths.
function buildLokiStream(
  host: string,
  username: string,
  password: string,
): Writable {
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const labels = {
    app: "aletheia",
    env:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "production",
  };

  async function push(line: string): Promise<void> {
    // Loki expects nanosecond timestamps as a string
    const nsTimestamp = `${Date.now()}000000`;
    const body = JSON.stringify({
      streams: [{ stream: labels, values: [[nsTimestamp, line]] }],
    });
    try {
      await fetch(`${host}/loki/api/v1/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body,
      });
    } catch (err) {
      // Never throw from the log path — a failed Loki push must not crash the request.
      console.error("[logger] Loki push failed:", err);
    }
  }

  return new Writable({
    write(chunk, _encoding, callback) {
      // Fire-and-forget: push to Loki, then immediately signal pino to continue.
      push(chunk.toString()).finally(() => callback());
    },
  });
}

function buildLogger(): pino.Logger {
  const lokiHost = process.env.LOKI_HOST;
  const lokiUsername = process.env.LOKI_USERNAME;
  const lokiPassword = process.env.LOKI_PASSWORD;

  if (lokiHost && lokiUsername && lokiPassword) {
    try {
      const lokiStream = buildLokiStream(lokiHost, lokiUsername, lokiPassword);

      // Write to both stdout (visible in Vercel logs) and Loki simultaneously.
      return pino(
        pinoOptions,
        pino.multistream([{ stream: process.stdout }, { stream: lokiStream }]),
      );
    } catch (err) {
      // Loki stream setup failed — fall through to stdout only
      console.error(
        "[logger] Failed to initialise Loki stream, falling back to stdout:",
        err,
      );
    }
  }

  return pino(pinoOptions);
}

const baseLogger = buildLogger();

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
