import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client BEFORE importing action
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { updateProfile } from "./actions";
import { createClient } from "@/lib/supabase/server";

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when target_job_description exceeds 20000 chars", async () => {
    const result = await updateProfile({
      full_name: "Test",
      target_job_description: "x".repeat(20_001),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/job/i);
  });

  it("returns auth error when no session", async () => {
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
    });
    const result = await updateProfile({
      full_name: "Test",
      target_job_description: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/auth|sign/i);
  });

  it("returns generic error and does NOT leak PG error message on DB failure", async () => {
    const pgError = {
      message:
        'duplicate key value violates unique constraint "profiles_email_key"',
      code: "23505",
      details: "Key (email)=(foo@bar.com) already exists.",
      hint: "Try a different email",
    };
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: pgError }),
    });
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ update: updateMock }),
    });
    const result = await updateProfile({
      full_name: "Test",
      target_job_description: "ok",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Client gets a generic message
      expect(result.error).toBe("Could not save profile. Please try again.");
      // None of the PG internals leak through
      expect(result.error).not.toContain("duplicate key");
      expect(result.error).not.toContain("constraint");
      expect(result.error).not.toContain("profiles_email_key");
      expect(result.error).not.toContain("23505");
    }
  });

  it("writes valid input to profiles row", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ update: updateMock }),
    });
    const result = await updateProfile({
      full_name: "Nagarjun",
      target_job_description: "ML infra eng",
    });
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Nagarjun",
        target_job_description: "ML infra eng",
      }),
    );
  });
});
