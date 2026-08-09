import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseClient } = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(() => ({ scope: "caller" })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClient,
}));

import { createBearerUserClient } from "./bearer-user-client";

describe("createBearerUserClient", () => {
  beforeEach(() => {
    createSupabaseClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
  });

  it("creates a stateless typed client carrying the verified user JWT", () => {
    expect(createBearerUserClient("verified-access-token")).toEqual({
      scope: "caller",
    });
    expect(createSupabaseClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "public-anon-key",
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        global: {
          headers: { Authorization: "Bearer verified-access-token" },
        },
      },
    );
  });

  it("rejects missing configuration and blank tokens before client creation", () => {
    expect(() => createBearerUserClient(" ")).toThrow(
      "Verified Supabase access token is required",
    );

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createBearerUserClient("verified-access-token")).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL environment variable is not set",
    );

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => createBearerUserClient("verified-access-token")).toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not set",
    );
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects control characters instead of forwarding an injectable header", () => {
    expect(() =>
      createBearerUserClient("verified-token\nX-Injected: true"),
    ).toThrow("Verified Supabase access token is invalid");
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });
});
