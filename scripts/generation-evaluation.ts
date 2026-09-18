import { z } from "zod";
import { GENERATION_FAILURE_CODES } from "../lib/generation-timing";

export const MAX_EXPORT_BYTES = 20 * 1024 * 1024;
const MAX_RECORDS = 100_000;
const stages = [
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
const metrics = [
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
  "itemCount",
] as const;
const enums: Record<string, readonly string[]> = {
  errorCode: GENERATION_FAILURE_CODES,
  category: [
    "yc_application",
    "linkedin_connection",
    "cold_email",
    "linkedin_inmail",
  ],
  outcome: ["success", "failure", "started"],
  model: ["claude-sonnet-4-6"],
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
};
const events = [
  "generation.timing",
  "generation.complete",
  "generation.finished",
  "generation.start",
  "request.start",
  "request.complete",
  "api.request.start",
  "api.request.complete",
  "provider.attempt",
  "candidate.query",
  "stage.complete",
];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const version =
  /^(?:[0-9]+(?:\.[0-9]+){1,3}|[a-f0-9]{7,40}|(?:v|yc-)[0-9]+(?:\.[0-9]+){0,3})$/i;
const manifestSchema = z
  .object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    environment: z.enum(["test", "development", "preview", "production"]),
    deployment: z.string().max(40).regex(version).optional(),
    clientVersion: z.string().max(40).regex(version).optional(),
    complete: z.boolean(),
    server: z.array(z.string().min(1).max(4096)).min(1).max(100),
    client: z.array(z.string().min(1).max(4096)).max(100).default([]),
  })
  .strict()
  .refine((v) => Date.parse(v.end) > Date.parse(v.start));
export type EvaluationManifest = z.infer<typeof manifestSchema>;
export function validateManifest(value: unknown): EvaluationManifest {
  const result = manifestSchema.safeParse(value);
  if (!result.success) throw new Error("Invalid evaluation manifest.");
  return result.data;
}
type Obj = Record<string, unknown>;
const object = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const number = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e9;
type Event = {
  kind: "server" | "client";
  event: string;
  time: number | null;
  requestId: string;
  operationId: string;
  values: Record<string, number | string>;
  stages: Record<string, number | null>;
  invalid: boolean;
};

/** Raw values and arbitrary strings never leave this projection boundary. IDs stay internal. */
function project(raw: Obj, kind: Event["kind"]): Event | null {
  if (typeof raw.event !== "string" || !events.includes(raw.event)) return null;
  if (
    (raw.event === "request.start" || raw.event === "request.complete") &&
    (raw.path !== "/api/extension/generate" || raw.method !== "POST")
  )
    return null;
  if (
    raw.event.startsWith("api.request.") &&
    (raw.endpoint !== "/api/extension/generate" || raw.method !== "POST")
  )
    return null;
  const values: Event["values"] = {};
  const config = object(raw.config);
  for (const [key, allowed] of Object.entries(enums)) {
    const v = raw[key] ?? config[key];
    if (typeof v === "string" && allowed.includes(v)) values[key] = v;
  }
  for (const key of ["templateVersion", "deployment", "clientVersion"]) {
    const v = raw[key] ?? config[key];
    if (typeof v === "string" && v.length <= 40 && version.test(v))
      values[key] = v;
  }
  for (const key of [
    "durationMs",
    "status",
    "attempt",
    "gapMs",
    "temperature",
    "maxOutputUnits",
    ...metrics,
  ]) {
    const v = raw[key] ?? config[key] ?? object(raw.metrics)[key];
    if (number(v)) values[key] = v;
  }
  for (const key of ["stage", "failedStage", "terminalStage"]) {
    const v = raw[key];
    if (
      typeof v === "string" &&
      [
        ...stages,
        "auth.access_token",
        "generation.workflow",
        "context",
        "evidence",
        "primary",
        "legacy",
        "repository.credit_refund",
        "repository.rate_limit_release",
      ].includes(v as never)
    )
      values[key] = v;
  }
  // Bound status cardinality as well as numeric magnitude before aggregation.
  if (
    values.status !== undefined &&
    (!Number.isInteger(values.status) ||
      Number(values.status) < 100 ||
      Number(values.status) > 599)
  )
    delete values.status;
  const measured: Event["stages"] = {};
  let invalid = false;
  for (const key of stages) {
    const v = object(raw.stages)[key];
    if (v === null || number(v)) measured[key] = v;
    else if (v !== undefined) invalid = true;
  }
  if (raw.durationMs !== undefined && !number(raw.durationMs)) invalid = true;
  const timestamp = raw.time ?? raw.timestamp;
  const time =
    typeof timestamp === "number"
      ? timestamp
      : typeof timestamp === "string"
        ? Date.parse(timestamp)
        : NaN;
  const id = (v: unknown) =>
    typeof v === "string" && uuid.test(v) ? v.toLowerCase() : "";
  return {
    kind,
    event: raw.event,
    time: Number.isFinite(time) ? time : null,
    requestId: id(raw.requestId),
    operationId: id(raw.operationId),
    values,
    stages: measured,
    invalid,
  };
}

export function summarize(input: number[]) {
  const a = input.filter(number).sort((a, b) => a - b),
    n = a.length;
  return {
    n,
    min: a[0] ?? null,
    max: a[n - 1] ?? null,
    median: n
      ? ((a[Math.floor((n - 1) / 2)] ?? 0) + (a[Math.floor(n / 2)] ?? 0)) / 2
      : null,
    p95: n >= 20 ? (a[Math.ceil(n * 0.95) - 1] ?? null) : null,
    p95Note:
      n < 20
        ? "Suppressed: fewer than 20 observations."
        : "Nearest-rank estimate; tail remains noisy at small sample sizes.",
  };
}
const measurements = (rows: Event[], key: string) =>
  rows.flatMap((r) => (number(r.values[key]) ? [r.values[key] as number] : []));

export function evaluateGeneration(
  input: unknown,
  sources: { kind: Event["kind"]; contents: string }[],
) {
  const manifest = validateManifest(input);
  if (
    sources.reduce((n, s) => n + Buffer.byteLength(s.contents, "utf8"), 0) >
    MAX_EXPORT_BYTES
  )
    throw new Error("Export byte limit exceeded.");
  const coverage = {
    decodedRecords: 0,
    malformed: 0,
    depthExceeded: 0,
    ignored: 0,
    duplicates: 0,
    conflicts: 0,
    invalidTimings: 0,
    missingTime: 0,
    outsideWindow: 0,
    missingIds: 0,
    serverSummaries: 0,
    missingServerTerminals: 0,
    matchedClientOperations: 0,
    unmatchedClientOperations: 0,
    missingClientTerminals: 0,
    omittedCohorts: 0,
    incompatibleClientDurations: 0,
    summariesWithoutStages: 0,
    missingFinishEvents: 0,
    invalidProviderAttempts: 0,
    providerAttemptsMissingIds: 0,
    unmatchedQueries: 0,
  };
  const projected: Event[] = [];
  const visit = (v: unknown, kind: Event["kind"], depth: number): void => {
    if (depth > 4) {
      coverage.depthExceeded++;
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item, kind, depth + 1);
      return;
    }
    if (++coverage.decodedRecords > MAX_RECORDS)
      throw new Error("Export record limit exceeded.");
    const raw = object(v),
      e = project(raw, kind);
    if (e) {
      projected.push(e);
      return;
    }
    let wrapped = false;
    for (const key of ["message", "msg"])
      if (typeof raw[key] === "string" && raw[key].trim().startsWith("{")) {
        let nested: unknown;
        try {
          nested = JSON.parse(raw[key]);
        } catch {
          coverage.malformed++;
          continue;
        }
        visit(nested, kind, depth + 1);
        wrapped = true;
      }
    if (Array.isArray(raw.logs)) {
      visit(raw.logs, kind, depth + 1);
      wrapped = true;
    }
    if (!wrapped) coverage.ignored++;
  };
  for (const source of sources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source.contents);
    } catch {
      for (const line of source.contents.split(/\r?\n/u)) {
        if (!line.trim()) continue;
        try {
          parsed = JSON.parse(line);
        } catch {
          coverage.malformed++;
          continue;
        }
        visit(parsed, source.kind, 0);
      }
      continue;
    }
    visit(parsed, source.kind, 0);
  }
  const seen = new Set<string>(),
    unique: Event[] = [];
  for (const e of projected) {
    const fingerprint = JSON.stringify(e);
    if (seen.has(fingerprint)) {
      coverage.duplicates++;
      continue;
    }
    seen.add(fingerprint);
    if (e.time === null) {
      coverage.missingTime++;
      continue;
    }
    if (
      e.time < Date.parse(manifest.start) ||
      e.time >= Date.parse(manifest.end)
    ) {
      coverage.outsideWindow++;
      continue;
    }
    unique.push(e);
  }
  const terminals = (
    kind: Event["kind"],
    name: string,
    idKey: "requestId" | "operationId",
  ) => {
    const groups = new Map<string, Event[]>();
    for (const e of unique.filter((e) => e.kind === kind && e.event === name)) {
      if (!e[idKey]) {
        coverage.missingIds++;
        continue;
      }
      const group = groups.get(e[idKey]) ?? [];
      group.push(e);
      groups.set(e[idKey], group);
    }
    const result: Event[] = [];
    for (const group of groups.values()) {
      if (group.length > 1) {
        coverage.conflicts++;
        continue;
      }
      const e = group[0];
      if (!e) continue;
      const sum = Object.values(e.stages).reduce<number>(
        (n, v) => n + (v ?? 0),
        0,
      );
      if (
        e.invalid ||
        !number(e.values.durationMs) ||
        (Object.keys(e.stages).length > 0 &&
          Math.abs(sum - e.values.durationMs) > 1)
      ) {
        coverage.invalidTimings++;
        continue;
      }
      result.push(e);
    }
    return result;
  };
  const server = terminals("server", "generation.timing", "requestId");
  const render = terminals("client", "generation.complete", "operationId");
  const finished = terminals("client", "generation.finished", "operationId");
  coverage.serverSummaries = server.length;
  coverage.summariesWithoutStages = server.filter(
    (e) => Object.keys(e.stages).length === 0,
  ).length;
  const finishedIds = new Set(finished.map((e) => e.operationId));
  coverage.missingFinishEvents = render.filter(
    (e) => !finishedIds.has(e.operationId),
  ).length;
  const serverIds = new Set(server.map((e) => e.requestId));
  const starts = new Set(
    unique
      .filter(
        (e) =>
          e.kind === "server" && e.event === "request.start" && e.requestId,
      )
      .map((e) => e.requestId),
  );
  coverage.missingServerTerminals = [...starts].filter(
    (id) => !serverIds.has(id),
  ).length;
  const clientStarts = new Set(
    unique
      .filter(
        (e) =>
          e.kind === "client" &&
          e.event === "generation.start" &&
          e.operationId,
      )
      .map((e) => e.operationId),
  );
  const renderIds = new Set(render.map((e) => e.operationId));
  coverage.missingClientTerminals = [...clientStarts].filter(
    (id) => !renderIds.has(id),
  ).length;
  const serverById = new Map(server.map((e) => [e.requestId, e]));
  const matched = render.filter(
    (e) =>
      e.requestId && serverById.get(e.requestId)?.operationId === e.operationId,
  );
  coverage.matchedClientOperations = matched.length;
  coverage.unmatchedClientOperations = render.length - matched.length;
  const success = server.filter((e) => e.values.outcome === "success");
  const attempts = unique.filter((e) => {
    if (e.event !== "provider.attempt" || e.kind !== "server") return false;
    if (!e.requestId) {
      coverage.providerAttemptsMissingIds++;
      return false;
    }
    if (
      e.invalid ||
      !number(e.values.durationMs) ||
      !number(e.values.attempt) ||
      !Number.isInteger(e.values.attempt) ||
      e.values.attempt < 1
    ) {
      coverage.invalidProviderAttempts++;
      return false;
    }
    return true;
  });
  const queries = unique.filter(
    (e) =>
      e.event === "candidate.query" &&
      e.kind === "server" &&
      e.requestId &&
      !e.invalid &&
      number(e.values.durationMs),
  );
  coverage.unmatchedQueries = queries.filter(
    (e) => !serverIds.has(e.requestId),
  ).length;
  const attemptsById = new Map<string, Event[]>();
  for (const e of attempts) {
    const a = attemptsById.get(e.requestId) ?? [];
    a.push(e);
    attemptsById.set(e.requestId, a);
  }
  const minutes =
    (Date.parse(manifest.end) - Date.parse(manifest.start)) / 60000;
  const httpIds = new Set([
    ...starts,
    ...serverIds,
    ...unique
      .filter(
        (e) =>
          e.kind === "server" &&
          (e.event === "request.complete" || e.event === "generation.timing") &&
          e.requestId,
      )
      .map((e) => e.requestId),
  ]);
  const groups = new Map<string, Event[]>();
  const clientByOperation = new Map(render.map((e) => [e.operationId, e]));
  const retried = (rows: Event[] | undefined) =>
    Boolean(
      rows?.some((e) => number(e.values.attempt) && e.values.attempt > 1),
    );
  for (const e of server) {
    const v = e.values;
    const key = [
      v.category ?? "unknown",
      v.outcome ?? "unknown",
      v.model ?? "unknown",
      v.templateVersion ?? "unknown",
      v.deployment ?? manifest.deployment ?? "unknown",
      v.billingMode ?? "unknown",
      retried(attemptsById.get(e.requestId))
        ? "retried"
        : attemptsById.has(e.requestId)
          ? "single"
          : "unknown",
      v.intent ?? "unknown",
      v.mode ?? "unknown",
      v.clientVersion ??
        clientByOperation.get(e.operationId)?.values.clientVersion ??
        manifest.clientVersion ??
        "unknown",
      `items:${number(v.itemCount) && Number.isInteger(v.itemCount) && v.itemCount >= 1 && v.itemCount <= 5 ? v.itemCount : "unknown"}`,
    ].join(" | ");
    const g = groups.get(key) ?? [];
    g.push(e);
    groups.set(key, g);
  }
  coverage.omittedCohorts = Math.max(0, groups.size - 128);
  const cohorts = [...groups]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 128)
    .map(([cohort, rows]) => {
      const parameters: Record<
        string,
        {
          varied: boolean;
          observed: ReturnType<typeof summarize>;
          quartiles: {
            range: [number, number];
            latency: ReturnType<typeof summarize>;
          }[];
        }
      > = {};
      for (const key of [...metrics, "temperature", "maxOutputUnits"]) {
        const pairs = rows
          .filter((r) => number(r.values[key]))
          .sort(
            (a, b) => (a.values[key] as number) - (b.values[key] as number),
          );
        const varied = new Set(pairs.map((r) => r.values[key])).size > 1;
        parameters[key] = {
          varied,
          observed: summarize(measurements(rows, key)),
          quartiles: [],
        };
        if (varied)
          for (let q = 0; q < 4; q++) {
            const subset = pairs.slice(
              Math.floor((q * pairs.length) / 4),
              Math.floor(((q + 1) * pairs.length) / 4),
            );
            if (subset.length)
              parameters[key].quartiles.push({
                range: [
                  subset[0]?.values[key] as number,
                  subset[subset.length - 1]?.values[key] as number,
                ],
                latency: summarize(measurements(subset, "durationMs")),
              });
          }
      }
      return {
        cohort,
        latency: summarize(measurements(rows, "durationMs")),
        parameters,
      };
    });
  const stageStats = Object.fromEntries(
    stages.map((stage) => [
      stage,
      summarize(
        server.flatMap((e) =>
          number(e.stages[stage]) ? [e.stages[stage] as number] : [],
        ),
      ),
    ]),
  );
  const total = measurements(server, "durationMs").reduce((a, b) => a + b, 0);
  const stageShares = stages
    .map((stage) => ({
      stage,
      share: total
        ? server.reduce((n, e) => n + (e.stages[stage] ?? 0), 0) / total
        : null,
    }))
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  const gaps = matched.flatMap((e) => {
    const s = serverById.get(e.requestId);
    const gap =
      (e.values.durationMs as number) - (s?.values.durationMs as number);
    if (!number(gap)) coverage.incompatibleClientDurations++;
    return number(gap) ? [gap] : [];
  });
  const usage = Object.fromEntries(
    ["inputUnits", "outputUnits", "cacheReadUnits", "cacheWriteUnits"].map(
      (key) => [key, summarize(measurements(server, key))],
    ),
  ) as Record<string, ReturnType<typeof summarize>>;
  const counts = (rows: Event[], key: string) =>
    Object.fromEntries(
      [...new Set(rows.map((r) => String(r.values[key] ?? "unknown")))].map(
        (v) => [
          v,
          rows.filter((r) => String(r.values[key] ?? "unknown") === v).length,
        ],
      ),
    );
  const matchedByRequest = new Map(matched.map((e) => [e.requestId, e]));
  const finishByOperation = new Map(finished.map((e) => [e.operationId, e]));
  const generationIds = new Set([
    ...httpIds,
    ...attemptsById.keys(),
    ...queries.map((e) => e.requestId),
  ]);
  const refundEvidence = (stage: string) => {
    const rows = unique.filter(
      (e) =>
        e.kind === "server" &&
        e.event === "stage.complete" &&
        e.values.stage === stage &&
        generationIds.has(e.requestId),
    );
    return {
      observed: rows.length,
      outcomes: counts(rows, "outcome"),
      failureCodes: counts(
        rows.filter((e) => e.values.outcome === "failure"),
        "errorCode",
      ),
      duration: summarize(measurements(rows, "durationMs")),
    };
  };
  return {
    schemaVersion: 1,
    window: {
      start: manifest.start,
      end: manifest.end,
      minutes,
      environment: manifest.environment,
      deployment: manifest.deployment ?? "unknown",
      clientVersion: manifest.clientVersion ?? "unknown",
      complete: manifest.complete,
    },
    coverage,
    limitations: [
      "Observed traffic only; capacity is not measured.",
      "Parameter associations are observational, not causal. Fixed configurations cannot be compared.",
      "SDK duration includes retries and processing. Fetch-to-headers is not TTFT or model decoding speed.",
      "Missing usage and terminal events are unknown, never zero.",
      "Provider/query statistics include unjoined observations; unmatched counts expose missing or invalid summaries.",
      "Retry gaps include only attempts numbered above one. Fetch aborts do not establish timeout vs caller cancellation.",
      "Refund outcomes describe observed helper completions, not an independent verification of the billing ledger.",
      "Client-minus-server gap includes auth, retries, network and client work; it is not network latency alone.",
      "Parallel query durations are nested; stage shares and percentiles must not be added.",
      "First invocation does not prove a cold start.",
      ...(manifest.complete
        ? []
        : ["Export is incomplete; rates describe only observed events."]),
    ],
    throughput: {
      observedHttpPerMinute: httpIds.size / minutes,
      successfulServerPerMinute: success.length / minutes,
      deliveredPerMinute: sources.some((s) => s.kind === "client")
        ? render.filter((e) => e.values.outcome === "success").length / minutes
        : null,
      knownOutputUnitsPerMinute: measurements(server, "outputUnits").length
        ? measurements(server, "outputUnits").reduce((a, b) => a + b, 0) /
          minutes
        : null,
      capacityMeasured: false,
    },
    latency: {
      server: summarize(measurements(server, "durationMs")),
      success: summarize(measurements(success, "durationMs")),
      failure: summarize(
        measurements(
          server.filter((e) => e.values.outcome === "failure"),
          "durationMs",
        ),
      ),
      render: summarize(
        measurements(
          render.filter((e) => e.values.outcome === "success"),
          "durationMs",
        ),
      ),
      finished: summarize(measurements(finished, "durationMs")),
      finishedSuccess: summarize(
        measurements(
          finished.filter((e) => e.values.outcome === "success"),
          "durationMs",
        ),
      ),
      finishedFailure: summarize(
        measurements(
          finished.filter((e) => e.values.outcome === "failure"),
          "durationMs",
        ),
      ),
      unexplainedClientGap: summarize(gaps),
      providerFetchToHeaders: summarize(measurements(attempts, "durationMs")),
      interAttemptGap: summarize(
        measurements(
          attempts.filter((e) => Number(e.values.attempt) > 1),
          "gapMs",
        ),
      ),
    },
    usage,
    outcomes: counts(server, "outcome"),
    stopReasons: counts(server, "stopReason"),
    failuresByStage: counts(
      server.filter((e) => e.values.outcome === "failure"),
      "failedStage",
    ),
    failuresByCode: counts(
      server.filter((e) => e.values.outcome === "failure"),
      "errorCode",
    ),
    providerFailureCodes: counts(
      attempts.filter((e) => e.values.outcome === "failure"),
      "errorCode",
    ),
    providerStatuses: counts(attempts, "status"),
    providerOutcomes: counts(attempts, "outcome"),
    refunds: {
      credit: refundEvidence("repository.credit_refund"),
      rateLimit: refundEvidence("repository.rate_limit_release"),
    },
    provider: {
      observedAttempts: attempts.length,
      retriedRequests: [...attemptsById.values()].filter(retried).length,
      unmatchedAttempts: attempts.filter((e) => !serverIds.has(e.requestId))
        .length,
    },
    clientStages: Object.fromEntries(
      ["auth.access_token", "generation.workflow"].map((stage) => [
        stage,
        summarize(
          measurements(
            unique.filter(
              (e) =>
                e.kind === "client" &&
                e.event === "stage.complete" &&
                e.values.stage === stage,
            ),
            "durationMs",
          ),
        ),
      ]),
    ),
    httpAttempts: {
      observed: unique.filter(
        (e) => e.kind === "client" && e.event === "api.request.complete",
      ).length,
      duration: summarize(
        measurements(
          unique.filter(
            (e) => e.kind === "client" && e.event === "api.request.complete",
          ),
          "durationMs",
        ),
      ),
    },
    queryTimings: Object.fromEntries(
      ["context", "evidence", "primary", "legacy"].map((stage) => [
        stage,
        summarize(
          measurements(
            queries.filter((e) => e.values.stage === stage),
            "durationMs",
          ),
        ),
      ]),
    ),
    stages: stageStats,
    stageShares,
    cohorts,
    priorities: [
      stageShares[0]?.share
        ? `Inspect ${stageShares[0].stage}: largest observed stage share.`
        : "Collect complete stage summaries.",
      "Inspect provider retries and failure stages before changing parameters.",
      "Inspect client gap and spinner completion when user turnaround exceeds server duration.",
      "Compare varied input/output sizes within matching cohorts before recommending changes.",
    ],
    samples: server.slice(0, 1000).map((e, i) => ({
      ordinal: i + 1,
      ...e.values,
      stages: e.stages,
      observedProviderAttempts: attemptsById.get(e.requestId)?.length ?? null,
      clientRenderMs:
        matchedByRequest.get(e.requestId)?.values.durationMs ?? null,
      clientFinishMs: matchedByRequest.has(e.requestId)
        ? (finishByOperation.get(e.operationId)?.values.durationMs ?? null)
        : null,
    })),
  };
}

export type GenerationReport = ReturnType<typeof evaluateGeneration>;
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );
export function renderReport(report: GenerationReport): string {
  const cell = (v: unknown) =>
    escape(
      v === null || v === undefined
        ? "unknown"
        : typeof v === "number"
          ? Number(v.toFixed(2)).toString()
          : String(v),
    );
  const table = (headers: string[], rows: unknown[][]) =>
    `<div class="table"><table><thead><tr>${headers.map((h) => `<th scope="col">${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${cell(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const statistics = (values: Record<string, ReturnType<typeof summarize>>) =>
    table(
      ["Measurement", "n", "Median", "p95*", "Min", "Max"],
      Object.entries(values).map(([name, v]) => [
        name,
        v.n,
        v.median,
        v.p95,
        v.min,
        v.max,
      ]),
    );
  const details = (name: string, value: unknown) =>
    `<details><summary>${escape(name)}</summary><pre>${escape(JSON.stringify(value, null, 2))}</pre></details>`;
  const list = (items: string[]) =>
    `<ul>${items.map((v) => `<li>${escape(v)}</li>`).join("")}</ul>`;
  const section = (name: string, html: string) =>
    `<section><h2>${escape(name)}</h2>${html}</section>`;
  const cohorts = report.cohorts
    .map(
      (c) =>
        `<details><summary>${escape(c.cohort)} — n=${c.latency.n}, median ${cell(c.latency.median)} ms</summary><p>Category | outcome | model | template | deployment | billing | retries | intent | mode | client version. Associations are observational.</p>${table(
          ["Parameter", "Observed n", "Median value", "Varies?"],
          Object.entries(c.parameters).map(([key, p]) => [
            key,
            p.observed.n,
            p.observed.median,
            p.varied ? "yes" : "no / unknown",
          ]),
        )}${Object.entries(c.parameters)
          .filter(([, p]) => p.varied)
          .map(
            ([key, p]) =>
              `<h3>${escape(key)} quartiles</h3>${table(
                ["Value range", "n", "Median latency (ms)", "p95 latency (ms)"],
                p.quartiles.map((q) => [
                  q.range.join(" – "),
                  q.latency.n,
                  q.latency.median,
                  q.latency.p95,
                ]),
              )}`,
          )
          .join("")}</details>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Generation performance evaluation</title><style>body{font:16px/1.5 system-ui;max-width:1120px;margin:40px auto;padding:0 24px;color:#18251e;background:#f4f7f5}section{background:white;padding:24px;margin:20px 0;border:1px solid #d0ddd4;border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}h1,h2,h3{color:#285d49}h1{font-size:36px;line-height:1.2}h2{font-size:22px;margin-top:0}.table{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;border-bottom:1px solid #dce6df;padding:10px 12px}th{background:#edf3ef}summary{cursor:pointer;font-weight:600;overflow-wrap:anywhere}details{padding:12px 0;border-bottom:1px solid #dce6df}li{margin-bottom:8px}.badge{display:inline-block;padding:4px 12px;border:1px solid #285d49;border-radius:24px;font-size:13px}</style></head><body><main><span class="badge">${report.window.environment === "test" ? "TEST DATA — no live performance conclusions" : "Local observation report"}</span><h1>Generation performance evaluation</h1><p>${escape(report.window.start)} → ${escape(report.window.end)}<br>${report.window.complete ? "Operator-declared complete export" : "Incomplete export — observed rates only"}. Durations are milliseconds; units are model tokens.</p>
  ${section("Investigate first", list(report.priorities))}
  ${section("Coverage", table(["Coverage signal", "Count"], Object.entries(report.coverage)) + details("Environment and versions", report.window))}
  ${section("Latency", statistics(report.latency) + "<p>* p95 is suppressed below 20 observations; estimates remain noisy with small samples. Compare success and failure separately.</p>")}
  ${section(
    "Observed throughput",
    table(
      ["Measurement", "Per minute"],
      [
        [
          "Observed server HTTP requests",
          report.throughput.observedHttpPerMinute,
        ],
        [
          "Successful server responses",
          report.throughput.successfulServerPerMinute,
        ],
        ["Client-confirmed delivery", report.throughput.deliveredPerMinute],
      ],
    ) +
      "<p>These rates do not measure saturation, concurrency capacity or service limits.</p>",
  )}
  ${section("Usage and attempts", statistics(report.usage) + table(["Provider evidence", "Count"], Object.entries(report.provider)) + details("Outcomes, failure causes and compensation", { outcomes: report.outcomes, stopReasons: report.stopReasons, failuresByStage: report.failuresByStage, failuresByCode: report.failuresByCode, providerFailureCodes: report.providerFailureCodes, providerStatuses: report.providerStatuses, providerOutcomes: report.providerOutcomes, refunds: report.refunds }))}
  ${section(
    "Server stages",
    statistics(report.stages) +
      table(
        ["Stage", "Share of observed wall time (%)"],
        report.stageShares.map((s) => [
          s.stage,
          s.share === null ? null : s.share * 100,
        ]),
      ),
  )}
  ${section("Nested queries and client work", statistics(report.queryTimings) + statistics(report.clientStages) + statistics({ httpAttempt: report.httpAttempts.duration }) + "<p>Nested query times overlap. Client stages may include auth recovery or repeated HTTP calls. Do not add percentiles.</p>")}
  ${section("Parameter comparisons", `<p>Showing up to 128 largest cohorts; global statistics include all valid summaries. Expand a cohort to inspect varied parameters and latency quartiles.</p>${cohorts}`)}
  ${section("Interpretation limits", list(report.limitations))}
  ${details("Sanitized request sample (maximum 1,000)", report.samples)}
  </main></body></html>`;
}
