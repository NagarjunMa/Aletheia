import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, OPTIONS, POST } from "./route";
import { authenticateExtensionRequest } from "@/modules/outreach/infrastructure/extension-generate.repository";
import { listConfirmedEvidence } from "@/modules/candidate-context/infrastructure/candidate-context.repository";

vi.mock(
  "@/modules/outreach/infrastructure/extension-generate.repository",
  () => ({
    authenticateExtensionRequest: vi.fn(),
  }),
);
vi.mock(
  "@/modules/candidate-context/infrastructure/candidate-context.repository",
  () => ({
    listConfirmedEvidence: vi.fn(),
  }),
);

vi.mock("@/modules/outreach/application/extension-generate.service", () => ({
  POST: vi.fn(),
}));

import { POST as generate } from "@/modules/outreach/application/extension-generate.service";

const auth = vi.mocked(authenticateExtensionRequest);
const list = vi.mocked(listConfirmedEvidence);
function request(token?: string) {
  return new NextRequest("http://localhost:3000/api/extension/evidence", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("extension evidence list", () => {
  beforeEach(() => vi.resetAllMocks());

  it("requires a verified bearer session before reading stories", async () => {
    auth.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(list).not.toHaveBeenCalled();
  });

  it("keeps concurrent requests scoped to their own sessions", async () => {
    auth.mockImplementation(async (req) => {
      const accessToken = req.headers.get("authorization")!.slice(7);
      return { userId: accessToken, accessToken, email: "" };
    });
    list.mockImplementation(async ({ userId, accessToken }) => {
      expect(accessToken).toBe(userId);
      return [
        { id: userId, kind: "technical_project", title: `Story ${userId}` },
      ];
    });

    const [a, b] = await Promise.all([GET(request("a")), GET(request("b"))]);
    for (const [response, id] of [
      [a, "a"],
      [b, "b"],
    ] as const) {
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({
        evidence: [{ id, kind: "technical_project", title: `Story ${id}` }],
      });
    }
  });

  it("returns a private generic error for a repository outage", async () => {
    auth.mockResolvedValue({
      userId: "a",
      email: "",
      accessToken: "test-token",
    });
    list.mockRejectedValue(new Error("PRIVATE_DATABASE_DETAIL"));
    const response = await GET(request("test-token"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      error: "Confirmed stories are temporarily unavailable",
      code: "CANDIDATE_CONTEXT_UNAVAILABLE",
    });
  });

  it("allows preflight without reading any private data", async () => {
    const response = await OPTIONS(request());
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, POST, OPTIONS",
    );
    expect(auth).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
});

it("routes explicit generation through the existing server-owned generator", async () => {
  const post = new NextRequest("http://localhost:3000/api/extension/evidence", {
    method: "POST",
    body: JSON.stringify({
      category: "cold_email",
      selectedEvidenceIds: ["11111111-1111-4111-8111-111111111111"],
    }),
  });
  await POST(post);
  expect(generate).toHaveBeenCalledWith(post);
});
