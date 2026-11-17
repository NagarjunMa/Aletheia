// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const { readParams, getUser, signInWithOAuth } = vi.hoisted(() => ({
  readParams: vi.fn(),
  getUser: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: readParams }));
vi.mock("@/app/auth/actions", () => ({ ensureProfileAction: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser, signInWithOAuth } }),
}));

describe("extension sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "old-account" } } });
  });
  afterEach(cleanup);

  it.each(["google", "github"])("offers account choice with %s", (provider) => {
    readParams.mockReturnValue(
      new URLSearchParams("source=extension&switchAccount=1"),
    );
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(getUser).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Forgot?" })).toHaveAttribute(
      "href",
      "/auth/forgot-password?source=extension&switchAccount=1",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(`^${provider}$`, "i"),
      }),
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?source=extension`,
        queryParams: { prompt: "select_account" },
      },
    });
  });

  it("recognizes the existing account for an ordinary extension sign-in", async () => {
    readParams.mockReturnValue(new URLSearchParams("source=extension"));
    render(<LoginPage />);
    expect(
      await screen.findByRole("heading", { name: "Login successful" }),
    ).toBeVisible();
  });
});
