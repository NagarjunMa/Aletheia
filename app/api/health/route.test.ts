import { afterEach, describe, it, expect, vi } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";
import { GET } from "./route";

describe("GET /api/health", () => {
  const originalCommitSha = process.env.VERCEL_GIT_COMMIT_SHA;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalCommitSha === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    } else {
      process.env.VERCEL_GIT_COMMIT_SHA = originalCommitSha;
    }
  });

  it("returns 200", async () => {
    const res = await GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(200);
  });

  it("returns status: ok", async () => {
    const res = await GET(makeRequest({ method: "GET" }));
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.supabaseOrigin).toBe(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin,
    );
  });

  it("returns a valid ISO timestamp", async () => {
    const before = Date.now();
    const res = await GET(makeRequest({ method: "GET" }));
    const after = Date.now();
    const body = await res.json();
    expect(typeof body.timestamp).toBe("string");
    const ts = new Date(body.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it.each([
    ["preview", "true", true, true],
    ["preview", "true", false, true],
    ["preview", "", true, false],
    ["production", "true", true, false],
  ] as const)(
    "limits rollout attestation to opted-in previews (%s %s %s)",
    async (env, attestation, flag, visible) => {
      vi.stubEnv("VERCEL_ENV", env);
      vi.stubEnv("VERCEL_PROJECT_ID", "prj_isolated");
      vi.stubEnv("VERCEL_URL", "fixture-test.vercel.app");
      vi.stubEnv("GROUNDED_RESPONSE_GATE_ATTESTATION", attestation);
      vi.stubEnv("RHETORICAL_PLANS_ENABLED", String(flag));

      const response = await GET(makeRequest({ method: "GET" }));
      expect(response.headers.get("cache-control")).toBe("no-store");
      const result = await response.json();
      if (!visible) expect(result).not.toHaveProperty("groundedResponseGate");
      else
        expect(result.groundedResponseGate).toEqual({
          projectId: "prj_isolated",
          deploymentHost: "fixture-test.vercel.app",
          rhetoricalPlans: flag,
        });
    },
  );

  it("returns the deployed commit SHA for gate identity checks", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA =
      "4918db33a1b9a9938470b5b48af7728a4295775d";

    const response = await GET(makeRequest({ method: "GET" }));

    await expect(response.json()).resolves.toMatchObject({
      deploymentSha: "4918db33a1b9a9938470b5b48af7728a4295775d",
    });
  });
});
