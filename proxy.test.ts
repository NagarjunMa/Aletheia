import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { proxy } from "./proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
const getUser = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerClient).mockReturnValue({
    auth: { getUser },
  } as unknown as ReturnType<typeof createServerClient>);
  getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("public landing and protected navigation", () => {
  it("serves the landing page despite stale session cookies without consulting auth", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { code: "refresh_token_already_used" },
    });
    const response = await proxy(
      new NextRequest("https://aletheia.live/", {
        headers: { cookie: "sb-test-auth-token=stale" },
      }),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "script-src",
    );
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("does not require auth provider configuration to serve the landing page", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const response = await proxy(new NextRequest("https://aletheia.live/"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/dashboard", "/profile", "/settings", "/chat"])(
    "keeps %s protected",
    async (path) => {
      const response = await proxy(
        new NextRequest(`https://aletheia.live${path}`),
      );
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/auth/login");
      expect(location.searchParams.get("redirectTo")).toBe(path);
      expect(getUser).toHaveBeenCalledOnce();
    },
  );

  it("allows authenticated dashboard navigation", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "test-user" } },
      error: null,
    });
    const response = await proxy(
      new NextRequest("https://aletheia.live/dashboard"),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(getUser).toHaveBeenCalledOnce();
  });
});
