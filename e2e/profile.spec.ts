import { test, expect } from "@playwright/test";

// @smoke — Mocked E2E used in ci.yml only.
// Verifies the /profile route exists and redirects unauthenticated visitors to /auth/login.
// Does not exercise the form itself (would require a real Supabase session).

test("/profile redirects unauthenticated to /auth/login @smoke", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/auth\/login/);
});
