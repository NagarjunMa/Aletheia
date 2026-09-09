const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_LOG_EXPORT_BYTES = 20 * 1024 * 1024;
const MAX_LOG_EXPORT_LINES = 50_000;

export const REQUIRED_RESUME_LOG_STAGES = [
  "resume_upload.reservation",
  "resume_upload.acknowledgement",
  "resume_upload.validation",
  "resume_upload.promotion",
  "resume_upload.rejection",
  "resume_upload.cleanup",
] as const;

const requiredEnvironmentKeys = [
  "RESUME_GATE_BASE_URL",
  "RESUME_GATE_PRODUCTION_BASE_URL",
  "RESUME_GATE_SUPABASE_URL",
  "RESUME_GATE_PRODUCTION_SUPABASE_URL",
  "RESUME_GATE_SUPABASE_ANON_KEY",
  "RESUME_GATE_SUPABASE_SERVICE_ROLE_KEY",
  "RESUME_GATE_USER_A_EMAIL",
  "RESUME_GATE_USER_A_PASSWORD",
  "RESUME_GATE_USER_B_EMAIL",
  "RESUME_GATE_USER_B_PASSWORD",
  "RESUME_GATE_CRON_SECRET",
  "RESUME_GATE_CONFIRM_ISOLATED_PROJECT",
  "RESUME_GATE_EXPECTED_COMMIT_SHA",
] as const;

type Environment = Record<string, string | undefined>;

export type ResumeProductionGateEnvironment = {
  baseUrl: URL;
  supabaseUrl: URL;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  vercelAutomationBypassSecret?: string;
  userA: { email: string; password: string };
  userB: { email: string; password: string };
  cronSecret: string;
  expectedCommitSha: string;
};

type ResumeGateDeploymentIdentity = {
  deploymentSha?: unknown;
  supabaseOrigin?: unknown;
};

export function assertResumeGateDeploymentIdentity(
  identity: ResumeGateDeploymentIdentity,
  environment: ResumeProductionGateEnvironment,
): void {
  if (identity.supabaseOrigin !== environment.supabaseUrl.origin) {
    throw new Error("Resume gate deployment/project identity mismatch.");
  }
  if (identity.deploymentSha !== environment.expectedCommitSha) {
    throw new Error(
      "Resume gate deployment commit does not match the workflow commit.",
    );
  }
}

type CleanupResult = { error: unknown };

type ResumeGateCleanupInput = {
  paths: string[];
  resumeIds: string[];
  uploadIds: string[];
  removeStorageObjects: (paths: string[]) => Promise<CleanupResult[]>;
  deleteResumeRows: (ids: string[]) => Promise<CleanupResult>;
  deleteUploadRows: (ids: string[]) => Promise<CleanupResult>;
};

export async function cleanupResumeGateArtifacts({
  paths,
  resumeIds,
  uploadIds,
  removeStorageObjects,
  deleteResumeRows,
  deleteUploadRows,
}: ResumeGateCleanupInput): Promise<boolean> {
  if ((resumeIds.length > 0 || uploadIds.length > 0) && paths.length === 0) {
    return false;
  }

  if (paths.length > 0) {
    try {
      const storageCleanup = await removeStorageObjects(paths);
      if (storageCleanup.some(({ error }) => Boolean(error))) return false;
    } catch {
      return false;
    }
  }

  if (resumeIds.length > 0) {
    try {
      const result = await deleteResumeRows(resumeIds);
      if (result.error) return false;
    } catch {
      return false;
    }
  }

  if (uploadIds.length > 0) {
    try {
      const result = await deleteUploadRows(uploadIds);
      if (result.error) return false;
    } catch {
      return false;
    }
  }

  return true;
}

export function buildVercelBypassHeaders(
  secret: string | undefined,
  options: { setCookie?: boolean } = {},
): Record<string, string> {
  const normalizedSecret = secret?.trim();
  return normalizedSecret
    ? {
        "x-vercel-protection-bypass": normalizedSecret,
        ...(options.setCookie ? { "x-vercel-set-bypass-cookie": "true" } : {}),
      }
    : {};
}

export function parseResumeProductionGateEnv(
  environment: Environment,
): ResumeProductionGateEnvironment {
  const missing = requiredEnvironmentKeys.filter(
    (key) => !environment[key]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing resume production gate environment: ${missing.join(", ")}`,
    );
  }

  const value = (key: (typeof requiredEnvironmentKeys)[number]) =>
    environment[key]!.trim();
  const baseUrl = new URL(value("RESUME_GATE_BASE_URL"));
  const productionBaseUrl = new URL(value("RESUME_GATE_PRODUCTION_BASE_URL"));
  const supabaseUrl = new URL(value("RESUME_GATE_SUPABASE_URL"));
  const productionSupabaseUrl = new URL(
    value("RESUME_GATE_PRODUCTION_SUPABASE_URL"),
  );
  const productionHosts = new Set(["aletheia.live", "www.aletheia.live"]);

  if (
    baseUrl.protocol !== "https:" ||
    supabaseUrl.protocol !== "https:" ||
    productionBaseUrl.protocol !== "https:" ||
    productionSupabaseUrl.protocol !== "https:"
  ) {
    throw new Error("Resume production gate requires HTTPS targets.");
  }
  if (
    productionHosts.has(baseUrl.hostname.toLowerCase()) ||
    baseUrl.origin === productionBaseUrl.origin ||
    supabaseUrl.origin === productionSupabaseUrl.origin
  ) {
    throw new Error("Resume production gate refuses to target production.");
  }
  if (value("RESUME_GATE_CONFIRM_ISOLATED_PROJECT") !== "yes") {
    throw new Error(
      "Resume production gate requires explicit isolated-project confirmation.",
    );
  }

  const userAEmail = value("RESUME_GATE_USER_A_EMAIL").toLowerCase();
  const userBEmail = value("RESUME_GATE_USER_B_EMAIL").toLowerCase();
  if (userAEmail === userBEmail) {
    throw new Error(
      "Resume production gate requires two distinct test accounts.",
    );
  }
  const expectedCommitSha = value("RESUME_GATE_EXPECTED_COMMIT_SHA");
  if (!/^[a-f0-9]{40,64}$/iu.test(expectedCommitSha)) {
    throw new Error("Resume production gate requires a valid commit SHA.");
  }

  return {
    baseUrl,
    supabaseUrl,
    supabaseAnonKey: value("RESUME_GATE_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: value("RESUME_GATE_SUPABASE_SERVICE_ROLE_KEY"),
    ...(environment.RESUME_GATE_VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
      ? {
          vercelAutomationBypassSecret:
            environment.RESUME_GATE_VERCEL_AUTOMATION_BYPASS_SECRET.trim(),
        }
      : {}),
    userA: {
      email: userAEmail,
      password: value("RESUME_GATE_USER_A_PASSWORD"),
    },
    userB: {
      email: userBEmail,
      password: value("RESUME_GATE_USER_B_PASSWORD"),
    },
    cronSecret: value("RESUME_GATE_CRON_SECRET"),
    expectedCommitSha: expectedCommitSha.toLowerCase(),
  };
}

export function buildResumeTextFixture(size: number, marker = "gate"): Buffer {
  if (!Number.isInteger(size) || size < 1 || size > MAX_RESUME_BYTES) {
    throw new Error("Resume fixture size must be between 1 byte and 5 MiB.");
  }
  const safeMarker = marker.replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 32);
  const pattern = Buffer.from(
    `Professional experience ${safeMarker}. Built reliable systems, improved accessibility, and collaborated across product teams. Education and skills include TypeScript, databases, testing, and operations.\n`,
    "utf8",
  );
  const fixture = Buffer.allocUnsafe(size);
  for (let offset = 0; offset < size; offset += pattern.length) {
    pattern.copy(fixture, offset, 0, Math.min(pattern.length, size - offset));
  }
  return fixture;
}

export function buildResumePdfFixture(marker = "gate"): Buffer {
  const safeMarker = marker.replace(/[^a-zA-Z0-9-]/gu, "").slice(0, 32);
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    `(Professional resume ${safeMarker}) Tj`,
    "0 -20 Td",
    "(Experience building reliable software and accessible products.) Tj",
    "0 -20 Td",
    "(Skills include TypeScript databases testing security and operations.) Tj",
    "0 -20 Td",
    "(Education and collaborative delivery across product teams.) Tj",
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
  ];
  let document = "%PDF-1.7\n%ALE43\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document, "ascii"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, "ascii");
  document += `xref\n0 ${objects.length + 1}\n`;
  document += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  document += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document, "ascii");
}

export type ResumeLogAudit = {
  eventCount: number;
  missingStages: string[];
  leakedCanaries: string[];
  forbiddenFields: string[];
};

const FORBIDDEN_LOG_FIELD_NAMES = new Set([
  "contentsha256",
  "contenthash",
  "documentcontent",
  "filename",
  "originalfilename",
  "parsedtext",
  "resumecontent",
  "storagepath",
]);

function collectForbiddenLogFields(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenLogFields(item, found);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const canonicalKey = key.replace(/[_-]/gu, "").toLowerCase();
    if (FORBIDDEN_LOG_FIELD_NAMES.has(canonicalKey)) found.add(key);
    collectForbiddenLogFields(nested, found);
  }
}

export function inspectResumeLogExport(
  contents: string,
  sensitiveCanaries: string[],
): ResumeLogAudit {
  if (Buffer.byteLength(contents, "utf8") > MAX_LOG_EXPORT_BYTES) {
    throw new Error("Resume log export exceeds the 20 MiB audit limit.");
  }
  const canaries = sensitiveCanaries.filter(Boolean);
  const leakedCanaries = canaries.filter((canary) => contents.includes(canary));
  const observedStages = new Set<string>();
  const forbiddenFields = new Set<string>();
  let eventCount = 0;

  const recordEvent = (event: Record<string, unknown>) => {
    if (
      event.event === "stage.complete" &&
      typeof event.stage === "string" &&
      (event.outcome === "success" || event.outcome === "failure") &&
      typeof event.durationMs === "number"
    ) {
      eventCount += 1;
      observedStages.add(event.stage);
      return true;
    }
    return false;
  };

  let lineCount = 0;
  for (const line of contents.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    lineCount += 1;
    if (lineCount > MAX_LOG_EXPORT_LINES) {
      throw new Error("Resume log export exceeds the 50,000-line audit limit.");
    }
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      collectForbiddenLogFields(event, forbiddenFields);
      if (recordEvent(event)) continue;
      const wrapped = [event.message, event.msg].find(
        (value): value is string => typeof value === "string",
      );
      if (wrapped) {
        const wrappedEvent = JSON.parse(wrapped) as Record<string, unknown>;
        collectForbiddenLogFields(wrappedEvent, forbiddenFields);
        recordEvent(wrappedEvent);
      }
    } catch {
      // Platform prefixes may wrap or precede JSON; the raw canary scan still runs.
    }
  }

  return {
    eventCount,
    missingStages: REQUIRED_RESUME_LOG_STAGES.filter(
      (stage) => !observedStages.has(stage),
    ),
    leakedCanaries,
    forbiddenFields: [...forbiddenFields].sort(),
  };
}
