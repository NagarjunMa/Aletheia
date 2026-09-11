/** Synthetic local baseline only. No provider, database, or telemetry network I/O. */
import pino from "pino";
import { cpus } from "node:os";
import { createGenerationTiming } from "../lib/generation-timing";
import { sanitizeLogFields } from "../lib/logging-core";
import {
  observeProviderFetch,
  observeQuery,
  recordMeasurement,
} from "../lib/provider-attempt-timing";
import {
  evaluateGeneration,
  MAX_EXPORT_BYTES,
  renderReport,
  summarize,
} from "./generation-evaluation";

async function main() {
  let logBytes = 0;
  const pinoLogger = pino(
    { level: "info", timestamp: pino.stdTimeFunctions.isoTime },
    {
      write(chunk: string) {
        logBytes += Buffer.byteLength(chunk);
      },
    },
  );
  const logger = {
    info(fields: Record<string, unknown>) {
      pinoLogger.info(sanitizeLogFields(fields));
    },
  };
  const response = { status: 200 };
  const query = Promise.resolve({ error: null });
  async function request(instrumented: boolean) {
    const client = { fetch: async () => response };
    if (!instrumented) {
      await Promise.all([query, query, query, query]);
      await client.fetch();
      return;
    }
    const timing = createGenerationTiming();
    timing.category("yc_application");
    timing.enter("groundingLoad");
    await Promise.all(
      (["context", "evidence", "primary", "legacy"] as const).map((stage) =>
        observeQuery(stage, query, logger),
      ),
    );
    timing.enter("model");
    observeProviderFetch(client, logger);
    await client.fetch();
    timing.metrics({ inputUnits: 1000, outputUnits: 200 });
    recordMeasurement(logger, timing.finish(200));
  }
  const iterations = 10000;
  async function batch(instrumented: boolean) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) await request(instrumented);
    return (performance.now() - start) / iterations;
  }
  await batch(false);
  await batch(true);
  logBytes = 0;
  const baseline: number[] = [],
    measured: number[] = [];
  for (let i = 0; i < 5; i++) {
    // Alternate order to reduce warm-up/order bias.
    if (i % 2) {
      measured.push(await batch(true));
      baseline.push(await batch(false));
    } else {
      baseline.push(await batch(false));
      measured.push(await batch(true));
    }
  }
  const startTime = "2026-09-10T00:00:00Z";
  const manifest = {
    start: startTime,
    end: "2026-09-10T01:00:00Z",
    environment: "test",
    complete: true,
    server: ["synthetic"],
  };
  const lines: string[] = [];
  let bytes = 0;
  for (let i = 1; i <= 100000; i++) {
    const line = JSON.stringify({
      event: "generation.timing",
      time: Date.parse(startTime) + i,
      requestId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      category: "yc_application",
      outcome: "success",
      durationMs: 1000 + (i % 200),
      stages: { model: 1000 + (i % 200) },
      metrics: { inputUnits: 100 + (i % 1000), outputUnits: 20 + (i % 100) },
      config: { temperature: 0.3, maxOutputUnits: 1000 },
    });
    const nextBytes = Buffer.byteLength(line) + (lines.length ? 1 : 0);
    if (bytes + nextBytes > MAX_EXPORT_BYTES) break;
    bytes += nextBytes;
    lines.push(line);
  }
  const contents = lines.join("\n");
  const records = lines.length;
  lines.length = 0;
  const rssBefore = process.memoryUsage().rss;
  const start = performance.now();
  const report = evaluateGeneration(manifest, [{ kind: "server", contents }]);
  const htmlBytes = Buffer.byteLength(renderReport(report));
  const { samples: _samples, ...aggregate } = report;
  const aggregateBytes = Buffer.byteLength(JSON.stringify(aggregate));
  const reportMs = performance.now() - start;
  const baselineMedian = summarize(baseline).median ?? 0;
  const measuredMedian = summarize(measured).median ?? 0;
  const peakRssMiB = process.resourceUsage().maxRSS / 1024;
  const targets = {
    addedMsPerRequest: 1,
    reportMs: 10000,
    processPeakRssMiB: 512,
  };
  const passed =
    measuredMedian - baselineMedian <= targets.addedMsPerRequest &&
    reportMs <= targets.reportMs &&
    peakRssMiB <= targets.processPeakRssMiB;
  process.stdout.write(
    JSON.stringify(
      {
        kind: "synthetic local baseline",
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpu: cpus()[0]?.model,
        targets,
        passed,
        instrumentation: {
          iterationsPerBatch: iterations,
          batches: 5,
          baselineMsPerRequest: baseline,
          instrumentedMsPerRequest: measured,
          addedMedianMsPerRequest: measuredMedian - baselineMedian,
          serializedBytesPerRequest: logBytes / (iterations * 5),
        },
        report: {
          records,
          inputBytes: bytes,
          elapsedMs: reportMs,
          htmlBytes,
          aggregateBytes,
          rssBeforeMiB: rssBefore / 1024 ** 2,
          rssAfterMiB: process.memoryUsage().rss / 1024 ** 2,
          processPeakRssMiB: peakRssMiB,
        },
        limitations: [
          "Pino serialization and mandatory redaction use a synchronous discard sink; stdout backpressure, extension storage and production load are not measured.",
          "Per-request costs are batch averages, not individual request p95. Memory is process RSS including Node, imports and fixture construction.",
          "One near-byte-limit cohort fixture is a baseline, not a worst-case capacity proof. No live generation latency is measured.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  if (!passed) process.exitCode = 1;
}

main().catch(() => {
  process.stderr.write("Synthetic generation benchmark failed.\n");
  process.exitCode = 1;
});
