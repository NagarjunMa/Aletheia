import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";
import { GET, OPTIONS } from "./route";

const ORIGINAL_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
const ORIGINAL_PUBLIC_COMMIT_SHA =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
const ORIGINAL_STORE_URL = process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL;

beforeEach(() => {
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  delete process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL;
});

afterEach(() => {
  process.env.VERCEL_GIT_COMMIT_SHA = ORIGINAL_COMMIT_SHA;
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = ORIGINAL_PUBLIC_COMMIT_SHA;
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL = ORIGINAL_STORE_URL;
});

describe("GET /api/extension/version", () => {
  it("returns local metadata when deployment env is absent", async () => {
    const res = await GET(makeRequest({ method: "GET" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      appVersion: "0.1.0",
      extensionVersion: "1.0.2",
      sha: "local",
      builtAt: "local",
      chromeWebStoreUrl: null,
    });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("returns deployment metadata and Chrome Web Store URL when configured", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "1234567890abcdef";
    process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL =
      "https://chromewebstore.google.com/detail/aletheia/example";

    const res = await GET(makeRequest({ method: "GET" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      appVersion: "0.1.0",
      extensionVersion: "1.0.2",
      sha: "1234567890ab",
      chromeWebStoreUrl:
        "https://chromewebstore.google.com/detail/aletheia/example",
    });
    expect(body).not.toHaveProperty("builtAt");
  });

  it("falls back to the public commit SHA when the Vercel server SHA is absent", async () => {
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = "fedcba0987654321";

    const res = await GET(makeRequest({ method: "GET" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sha).toBe("fedcba098765");
  });
});

describe("OPTIONS /api/extension/version", () => {
  it("returns 200 for CORS preflight", async () => {
    const res = await OPTIONS(makeRequest({ method: "OPTIONS" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
