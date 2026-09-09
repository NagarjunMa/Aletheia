import { writeFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { Database } from "../lib/database/types";
import {
  buildVercelBypassHeaders,
  buildResumePdfFixture,
  buildResumeTextFixture,
  parseResumeProductionGateEnv,
  type ResumeProductionGateEnvironment,
} from "../scripts/resume-production-gate";

const enabled = process.env.RESUME_GATE_ENABLED === "true";
const gate = enabled ? parseResumeProductionGateEnv(process.env) : null;
const CONTENT_CANARY = "ALE43PRIVATECONTENTCANARY";
const FILE_CANARY = "ALE43PRIVATEFILENAMECANARY";
const RUN_FILE_CANARY = `${FILE_CANARY}-${Date.now().toString(36)}-${process.pid.toString(36)}`;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

type Supabase = SupabaseClient<Database>;
type ListedResume = { id: string; label: string };
type Reservation = {
  uploadId: string;
  bucketId: "resume-quarantine";
  storagePath: string;
  uploadOptions: { contentType: string; upsert: false };
};

async function verifyDeploymentIdentity(
  environment: ResumeProductionGateEnvironment,
) {
  const response = await fetch(`${environment.baseUrl.origin}/api/health`, {
    headers: buildVercelBypassHeaders(environment.vercelAutomationBypassSecret),
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      "Isolated deployment redirected before its identity could be verified. If Vercel Deployment Protection is enabled, configure RESUME_GATE_VERCEL_AUTOMATION_BYPASS_SECRET.",
    );
  }
  if (!response.ok) {
    throw new Error("Unable to verify isolated deployment identity.");
  }
  const body = (await response.json()) as { supabaseOrigin?: unknown };
  if (body.supabaseOrigin !== environment.supabaseUrl.origin) {
    throw new Error("Resume gate deployment/project identity mismatch.");
  }
}

async function login(page: Page, environment: ResumeProductionGateEnvironment) {
  const bypassHeaders = buildVercelBypassHeaders(
    environment.vercelAutomationBypassSecret,
    { setCookie: true },
  );
  if (Object.keys(bypassHeaders).length > 0) {
    const response = await page
      .context()
      .request.get(`${environment.baseUrl.origin}/api/health`, {
        headers: bypassHeaders,
      });
    if (!response.ok()) {
      throw new Error(
        "Unable to establish the Vercel deployment-protection bypass cookie.",
      );
    }
  }
  await page.goto(
    `${environment.baseUrl.origin}/auth/login?redirectTo=/profile`,
  );
  await page.locator("#email").fill(environment.userA.email);
  await page.locator("#password").fill(environment.userA.password);
  try {
    await page.getByRole("button", { name: "Sign in" }).click();
    await clearCredentialFields(page);
    await page.waitForURL(/\/profile(?:\?|$)/u, {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });
  } finally {
    await clearCredentialFields(page);
  }
  await expect(page.getByRole("button", { name: "Upload resume" })).toBeVisible(
    { timeout: 30_000 },
  );
}

async function clearCredentialFields(page: Page) {
  for (const selector of ["#email", "#password"]) {
    await page
      .locator(selector)
      .fill("")
      .catch(() => undefined);
  }
}

async function listResumes(page: Page): Promise<ListedResume[]> {
  return page.evaluate(async () => {
    const response = await fetch("/api/resumes");
    if (!response.ok)
      throw new Error(`Resume list failed (${response.status})`);
    const body = (await response.json()) as { resumes: ListedResume[] };
    return body.resumes;
  });
}

async function reserve(page: Page, declaredSize: number): Promise<Reservation> {
  return page.evaluate(
    async ({ size, fileCanary }) => {
      const response = await fetch("/api/resumes/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: `${fileCanary}.txt`,
          declaredMime: "text/plain",
          declaredSize: size,
        }),
      });
      if (!response.ok)
        throw new Error(`Reservation failed (${response.status})`);
      return response.json() as Promise<Reservation>;
    },
    { size: declaredSize, fileCanary: RUN_FILE_CANARY },
  );
}

async function discoverRunArtifacts(service: Supabase) {
  const result = await service
    .from("resume_uploads")
    .select("id,resume_id,storage_path")
    .like("file_name", `${RUN_FILE_CANARY}%`);
  if (result.error) {
    throw new Error("Unable to discover isolated resume gate artifacts.");
  }
  return result.data;
}

async function observeStorageOrigins(page: Page, expectedOrigin: string) {
  const unexpectedStorageOrigins = new Set<string>();
  const storageRequestBodies: number[] = [];
  await page.route(
    "**/storage/v1/object/resume-quarantine/**",
    async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }
      const url = new URL(request.url());
      if (url.origin !== expectedOrigin) {
        unexpectedStorageOrigins.add(url.origin);
        await route.abort("blockedbyclient");
        return;
      }
      storageRequestBodies.push(request.postDataBuffer()?.byteLength ?? 0);
      await route.continue();
    },
  );
  return { storageRequestBodies, unexpectedStorageOrigins };
}

async function finalize(page: Page, uploadId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/resumes/uploads/${id}/finalize`, {
      method: "POST",
    });
    return { status: response.status, body: await response.json() };
  }, uploadId);
}

async function deleteResume(page: Page, resumeId: string) {
  await page.evaluate(async (id) => {
    const response = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    if (!response.ok)
      throw new Error(`Resume cleanup failed (${response.status})`);
  }, resumeId);
}

async function attachTiming(
  testInfo: TestInfo,
  fixtureBytes: number,
  durationMs: number,
  outcome: string,
) {
  const body = JSON.stringify({
    fixtureBytes,
    durationMs: Math.round(durationMs),
    outcome,
  });
  const evidencePath = testInfo.outputPath(
    `resume-${fixtureBytes}-byte-result.json`,
  );
  await writeFile(evidencePath, body, "utf8");
  await testInfo.attach(`resume-${fixtureBytes}-byte-result`, {
    path: evidencePath,
    contentType: "application/json",
  });
}

// Traces capture cookies and request details. Gate artifacts contain only the
// explicit timing attachments below, never authenticated browser traces.
test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("ALE-43 isolated resume production gate", () => {
  test.skip(
    !enabled,
    "Set RESUME_GATE_ENABLED=true in the protected workflow.",
  );
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let userA: Supabase;
  let userB: Supabase;
  let service: Supabase;
  const uploadIds = new Set<string>();
  const resumeIds = new Set<string>();
  const storagePaths = new Set<string>();

  test.beforeAll(async () => {
    if (!gate) return;
    await verifyDeploymentIdentity(gate);
    const authOptions = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    userA = createClient<Database>(
      gate.supabaseUrl.origin,
      gate.supabaseAnonKey,
      authOptions,
    );
    userB = createClient<Database>(
      gate.supabaseUrl.origin,
      gate.supabaseAnonKey,
      authOptions,
    );
    service = createClient<Database>(
      gate.supabaseUrl.origin,
      gate.supabaseServiceRoleKey,
      authOptions,
    );
    const [authA, authB] = await Promise.all([
      userA.auth.signInWithPassword(gate.userA),
      userB.auth.signInWithPassword(gate.userB),
    ]);
    if (authA.error || authB.error) {
      throw new Error(
        "Isolated resume gate test-account authentication failed.",
      );
    }
  });

  test.afterAll(async () => {
    if (!gate || !service) return;
    let cleanupFailed = false;
    try {
      for (const artifact of await discoverRunArtifacts(service)) {
        uploadIds.add(artifact.id);
        storagePaths.add(artifact.storage_path);
        if (artifact.resume_id) resumeIds.add(artifact.resume_id);
      }
    } catch {
      cleanupFailed = true;
    }
    if (resumeIds.size > 0) {
      const lookup = await service
        .from("user_resumes")
        .select("storage_path")
        .in("id", [...resumeIds]);
      cleanupFailed ||= Boolean(lookup.error);
      for (const row of lookup.data ?? []) {
        if (row.storage_path) storagePaths.add(row.storage_path);
      }
    }
    const paths = [...storagePaths];
    if (paths.length > 0) {
      const storageCleanup = await Promise.all([
        service.storage.from("resume-quarantine").remove(paths),
        service.storage.from("user-resumes").remove(paths),
      ]);
      cleanupFailed ||= storageCleanup.some(({ error }) => Boolean(error));
    }
    if (resumeIds.size > 0) {
      const result = await service
        .from("user_resumes")
        .delete()
        .in("id", [...resumeIds]);
      cleanupFailed ||= Boolean(result.error);
    }
    if (uploadIds.size > 0) {
      const result = await service
        .from("resume_uploads")
        .delete()
        .in("id", [...uploadIds]);
      cleanupFailed ||= Boolean(result.error);
    }
    await Promise.all([userA?.auth.signOut(), userB?.auth.signOut()]);
    if (cleanupFailed) {
      throw new Error("Isolated resume production-gate cleanup failed.");
    }
  });

  for (const fixtureBytes of [1024 * 1024, MAX_RESUME_BYTES]) {
    test(`uploads ${fixtureBytes} UTF-8 bytes directly without Vercel ingress`, async ({
      page,
    }, testInfo) => {
      if (!gate) return;
      await login(page, gate);
      const before = new Set((await listResumes(page)).map(({ id }) => id));
      const appRequestBodies: number[] = [];
      const { storageRequestBodies, unexpectedStorageOrigins } =
        await observeStorageOrigins(page, gate.supabaseUrl.origin);
      page.on("request", (request) => {
        if (request.method() !== "POST") return;
        const length = request.postDataBuffer()?.byteLength ?? 0;
        const url = new URL(request.url());
        if (
          url.origin === gate.baseUrl.origin &&
          url.pathname.startsWith("/api/resumes")
        ) {
          appRequestBodies.push(length);
        }
      });

      const marker = `${CONTENT_CANARY}-${fixtureBytes}-${Date.now()}`;
      const fixture = buildResumeTextFixture(fixtureBytes, marker);
      const startedAt = performance.now();
      await page.getByLabel("Choose resume file").setInputFiles({
        name: `${RUN_FILE_CANARY}-${fixtureBytes}.txt`,
        mimeType: "text/plain",
        buffer: fixture,
      });
      await expect(
        page.getByText(/Resume ready|saved with a quality note/i),
      ).toBeVisible({ timeout: 150_000 });
      const durationMs = performance.now() - startedAt;

      const created = (await listResumes(page)).find(
        ({ id }) => !before.has(id),
      );
      expect(Boolean(created)).toBe(true);
      expect(appRequestBodies.length).toBeGreaterThanOrEqual(2);
      expect(appRequestBodies.every((size) => size < 1024)).toBe(true);
      expect(storageRequestBodies.some((size) => size === fixtureBytes)).toBe(
        true,
      );
      expect([...unexpectedStorageOrigins]).toEqual([]);
      expect(durationMs).toBeLessThan(150_000);

      if (created) {
        resumeIds.add(created.id);
        await deleteResume(page, created.id);
        resumeIds.delete(created.id);
      }
      await attachTiming(testInfo, fixtureBytes, durationMs, "ready");
    });
  }

  test("validates and promotes a bounded PDF through the direct browser path", async ({
    page,
  }) => {
    if (!gate) return;
    await login(page, gate);
    const before = new Set((await listResumes(page)).map(({ id }) => id));
    const fixture = buildResumePdfFixture(`${CONTENT_CANARY}-${Date.now()}`);

    await page.getByLabel("Choose resume file").setInputFiles({
      name: `${RUN_FILE_CANARY}.pdf`,
      mimeType: "application/pdf",
      buffer: fixture,
    });
    await expect(
      page.getByText(/Resume ready|saved with a quality note/i),
    ).toBeVisible({ timeout: 60_000 });

    const created = (await listResumes(page)).find(({ id }) => !before.has(id));
    expect(Boolean(created)).toBe(true);
    if (created) {
      resumeIds.add(created.id);
      await deleteResume(page, created.id);
      resumeIds.delete(created.id);
    }
  });

  test("denies cross-user reservation reads, quarantine reads, and final writes", async ({
    page,
  }) => {
    if (!gate) return;
    await login(page, gate);
    const fixture = buildResumeTextFixture(4096, CONTENT_CANARY);
    const reservation = await reserve(page, fixture.byteLength);
    uploadIds.add(reservation.uploadId);
    storagePaths.add(reservation.storagePath);

    const upload = await userA.storage
      .from(reservation.bucketId)
      .upload(reservation.storagePath, fixture, reservation.uploadOptions);
    expect(upload.error === null).toBe(true);

    const rowLookup = await userB
      .from("resume_uploads")
      .select("id")
      .eq("id", reservation.uploadId);
    expect(rowLookup.error === null && rowLookup.data.length === 0).toBe(true);

    const quarantineRead = await userB.storage
      .from("resume-quarantine")
      .download(reservation.storagePath);
    expect(Boolean(quarantineRead.error)).toBe(true);

    const finalWrite = await userB.storage
      .from("user-resumes")
      .upload(reservation.storagePath, fixture, {
        contentType: "text/plain",
        upsert: false,
      });
    expect(Boolean(finalWrite.error)).toBe(true);

    const canceled = await page.evaluate(async (id) => {
      const response = await fetch(`/api/resumes/uploads/${id}`, {
        method: "DELETE",
      });
      return response.ok;
    }, reservation.uploadId);
    expect(canceled).toBe(true);
  });

  test("rejects binary TXT and removes its quarantined object", async ({
    page,
  }) => {
    if (!gate) return;
    await login(page, gate);
    const fixture = Buffer.from(
      "valid-looking text\u0000binary payload",
      "utf8",
    );
    const reservation = await reserve(page, fixture.byteLength);
    uploadIds.add(reservation.uploadId);
    storagePaths.add(reservation.storagePath);
    const upload = await userA.storage
      .from(reservation.bucketId)
      .upload(reservation.storagePath, fixture, reservation.uploadOptions);
    expect(upload.error === null).toBe(true);

    const result = await finalize(page, reservation.uploadId);
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({
      status: "rejected",
      code: "BINARY_TEXT",
      retryable: false,
    });

    const object = await service.storage
      .from("resume-quarantine")
      .download(reservation.storagePath);
    expect(Boolean(object.error)).toBe(true);
    const row = await service
      .from("resume_uploads")
      .select("state,failure_code")
      .eq("id", reservation.uploadId)
      .single();
    expect(row.data).toEqual({
      state: "rejected",
      failure_code: "BINARY_TEXT",
    });
  });

  test("observes secret-protected cleanup of an expired quarantine object", async ({
    page,
    request,
  }) => {
    if (!gate) return;
    await login(page, gate);
    const fixture = buildResumeTextFixture(4096, CONTENT_CANARY);
    const reservation = await reserve(page, fixture.byteLength);
    uploadIds.add(reservation.uploadId);
    storagePaths.add(reservation.storagePath);
    const upload = await userA.storage
      .from(reservation.bucketId)
      .upload(reservation.storagePath, fixture, reservation.uploadOptions);
    expect(upload.error === null).toBe(true);

    const now = Date.now();
    const backdate = await service
      .from("resume_uploads")
      .update({
        created_at: new Date(now - 120_000).toISOString(),
        expires_at: new Date(now - 60_000).toISOString(),
      })
      .eq("id", reservation.uploadId);
    expect(backdate.error === null).toBe(true);

    const cleanup = await request.get(
      `${gate.baseUrl.origin}/api/internal/resumes/cleanup`,
      {
        headers: {
          authorization: `Bearer ${gate.cronSecret}`,
          ...buildVercelBypassHeaders(gate.vercelAutomationBypassSecret),
        },
      },
    );
    expect(cleanup.ok()).toBe(true);
    const cleanupBody = (await cleanup.json()) as {
      claimed: number;
      removed: number;
      saturated: boolean;
    };
    expect(cleanupBody.claimed).toBeGreaterThanOrEqual(1);
    expect(cleanupBody.removed).toBeGreaterThanOrEqual(1);
    expect(cleanupBody.saturated).toBe(false);

    const row = await service
      .from("resume_uploads")
      .select("state,quarantine_cleaned_at")
      .eq("id", reservation.uploadId)
      .single();
    expect(row.data?.state).toBe("expired");
    expect(typeof row.data?.quarantine_cleaned_at).toBe("string");
    const object = await service.storage
      .from("resume-quarantine")
      .download(reservation.storagePath);
    expect(Boolean(object.error)).toBe(true);
  });
});
