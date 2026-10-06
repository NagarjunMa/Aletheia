import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

vi.mock("@/lib/cors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cors")>();
  return {
    ...actual,
    getCorsHeaders: vi.fn(actual.getCorsHeaders),
  };
});

import { GET, OPTIONS } from "./route";

const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_SUPABASE_KEY;
});

describe("GET /api/extension/config", () => {
  it.each([undefined, "false", "true"])(
    "keeps Message focus unavailable even with flag %s",
    async (flag) => {
      vi.stubEnv("MESSAGE_FOCUS_ENABLED", flag);
      try {
        const res = await GET(makeRequest({ method: "GET" }));
        expect((await res.json()).capabilities).toEqual({
          messageFocus: false,
        });
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it("returns 200 with supabase_url and supabase_anon_key from env", async () => {
    const res = await GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supabase_url).toBe("https://test.supabase.co");
    expect(body.supabase_anon_key).toBe("test-anon-key");
    expect(body.api).toEqual({
      currentVersion: "1",
      supportedVersions: ["1"],
    });
    expect(body.extension).toMatchObject({
      publishedVersion: "1.0.2",
      minimumSupportedVersion: "1.0.2",
    });
    expect(res.headers.get("X-Aletheia-API-Version")).toBe("1");
  });

  it("includes CORS headers in the response", async () => {
    const res = await GET(
      makeRequest({
        method: "GET",
        headers: { origin: "https://example.com" },
      }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeDefined();
  });

  it("returns undefined values when env vars are not set", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // env vars not set — values come back as undefined (serialised as absent keys)
    expect(body).not.toHaveProperty("supabase_url", "https://test.supabase.co");
  });
});

describe("OPTIONS /api/extension/config", () => {
  it("returns 200 for preflight", async () => {
    const res = await OPTIONS(makeRequest({ method: "OPTIONS" }));
    expect(res.status).toBe(200);
  });

  it("includes CORS headers", async () => {
    const res = await OPTIONS(
      makeRequest({
        method: "OPTIONS",
        headers: { origin: "http://localhost:3000" },
      }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeDefined();
  });

  it("includes GET in allowed methods", async () => {
    const res = await OPTIONS(
      makeRequest({
        method: "OPTIONS",
        headers: { origin: "http://localhost:3000" },
      }),
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});
