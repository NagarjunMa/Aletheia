import { test, expect } from "@playwright/test";

// @smoke — Mocked E2E used in cd.yml only.
// Verifies the app builds, boots, and critical routes respond.
// No Supabase auth or Anthropic calls — safe to run with dummy env vars.

test("landing page loads @smoke", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveTitle(/Aletheia/);
});

test("login page renders @smoke", async ({ page }) => {
  await page.goto("/auth/login");
  // Middleware may redirect authenticated sessions, but an unauthenticated
  // request with dummy Supabase env vars should land on /auth/login
  expect(page.url()).toContain("/auth/login");
});

test("health endpoint responds @smoke", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
});
