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

test("luxury evergreen theme renders without the legacy cyan wash @smoke", async ({
  page,
}) => {
  await page.goto("/auth/login");

  const theme = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const shader = document.querySelector<HTMLElement>(".shader-background");

    return {
      ink: root.getPropertyValue("--ref-ink").trim(),
      evergreen: root.getPropertyValue("--ref-evergreen").trim(),
      emerald: root.getPropertyValue("--ref-emerald").trim(),
      mint: root.getPropertyValue("--ref-mint").trim(),
      shaderBackground: shader ? getComputedStyle(shader).backgroundImage : "",
    };
  });

  expect(theme).toMatchObject({
    ink: "#050806",
    evergreen: "#013220",
    emerald: "#50c878",
    mint: "#d1f2eb",
  });
  expect(theme.shaderBackground).toContain("rgba(80, 200, 120");
  expect(theme.shaderBackground).not.toContain("rgb(112, 184, 200)");
});

test("login remains contained at mobile width @smoke", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/login");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("health endpoint responds @smoke", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
});
