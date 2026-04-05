import { registerOTel } from "@vercel/otel";

export async function register() {
  // Register OpenTelemetry — ships traces to Vercel's native observability
  // or any OTLP endpoint (Grafana Tempo, Jaeger) via OTEL_EXPORTER_OTLP_ENDPOINT.
  registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME ?? "aletheia" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
