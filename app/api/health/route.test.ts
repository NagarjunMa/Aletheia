import { afterEach, describe, it, expect } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";
import { GET } from "./route";

describe("GET /api/health", () => {
  const originalCommitSha = process.env.VERCEL_GIT_COMMIT_SHA;

  afterEach(() => {
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

  it("returns the deployed commit SHA for gate identity checks", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA =
      "4918db33a1b9a9938470b5b48af7728a4295775d";

    const response = await GET(makeRequest({ method: "GET" }));

    await expect(response.json()).resolves.toMatchObject({
      deploymentSha: "4918db33a1b9a9938470b5b48af7728a4295775d",
    });
  });
});
