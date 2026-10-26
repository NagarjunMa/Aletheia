import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const cookieValues = vi.hoisted(() => [] as { name: string; value: string }[]);
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => cookieValues, set: vi.fn() }),
}));

import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

it("keeps browser credentials out of privileged billing RPCs with the real SDK", async () => {
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "ordinary@example.test",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  };
  const session = {
    access_token: "synthetic-user-access-token",
    refresh_token: "synthetic-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  cookieValues.splice(0, cookieValues.length, {
    name: "sb-localhost-auth-token",
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
  });
  const rpcHeaders: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) return Response.json(user);
      if (url.includes("/rpc/")) {
        const authorization =
          new Headers(init?.headers).get("authorization") ?? "";
        rpcHeaders.push(authorization);
        if (authorization !== "Bearer test-service-key") {
          return Response.json(
            { message: "permission denied", code: "42501" },
            { status: 403 },
          );
        }
        return Response.json(
          url.includes("grant_trial")
            ? [{ granted: true, balance: 40 }]
            : [
                {
                  balance: 40,
                  lifetime_credits_purchased: 0,
                  lifetime_credits_used: 0,
                  trial_credits_granted_at: null,
                },
              ],
        );
      }
      if (url.includes("/credit_ledger")) return Response.json([]);
      throw new Error("Unexpected external request");
    }),
  );
  const response = await GET(
    new NextRequest("http://localhost/api/billing/credits"),
  );
  expect(response.status).toBe(200);
  expect(rpcHeaders).toEqual([
    "Bearer test-service-key",
    "Bearer test-service-key",
  ]);
  expect(await response.json()).toMatchObject({ balance: 40, ledger: [] });
});
