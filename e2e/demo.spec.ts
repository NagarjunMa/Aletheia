import { test, expect } from "@playwright/test";

// @smoke — Mocked E2E used in ci.yml only.
// Verifies the /demo route loads without auth and renders the sample draft.
// No Supabase auth or Anthropic calls — safe to run with dummy env vars.

test("demo page renders sample draft without auth @smoke", async ({ page }) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: /one illustrative context/i }),
  ).toBeVisible();
  const draft = page.getByTestId("demo-draft");
  await expect(draft).toBeVisible();
  const text = await draft.textContent();
  expect(text?.length ?? 0).toBeGreaterThan(100);
});

test("demo clearly identifies fictional illustrative data @smoke", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.getByText(/illustrative data only/i)).toBeVisible();
  await expect(page.getByText(/fictional example/i)).toBeVisible();
  await expect(page.getByText(/does not show a real person/i)).toBeVisible();
});

test("demo page has back-link pointing to home @smoke", async ({ page }) => {
  await page.goto("/demo");
  const backLink = page.getByRole("link", { name: /back to home/i }).first();
  await expect(backLink).toBeVisible();
  await expect(backLink).toHaveAttribute("href", "/");
});
