import { describe, it, expect } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns 200", async () => {
    const res = await GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(200);
  });

  it("returns status: ok", async () => {
    const res = await GET(makeRequest({ method: "GET" }));
    const body = await res.json();
    expect(body.status).toBe("ok");
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
});
