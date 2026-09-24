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
  const characterCount = await page
    .locator(".landing-demo-output .landing-demo-field-label")
    .textContent();
  expect(characterCount).toContain(`${text?.length} characters`);
});

test("demo clearly identifies fictional illustrative data @smoke", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.getByText(/illustrative data only/i)).toBeVisible();
  await expect(
    page.locator(".landing-demo-review").getByText(/fictional example/i),
  ).toBeVisible();
  await expect(page.getByText(/does not show a real person/i)).toBeVisible();
});

test("demo page has back-link pointing to home @smoke", async ({ page }) => {
  await page.goto("/demo");
  const backLink = page.getByRole("link", { name: /back to home/i }).first();
  await expect(backLink).toBeVisible();
  await expect(backLink).toHaveAttribute("href", "/");
});

test("illustrative example follows the current editorial design at desktop and mobile widths @smoke", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/demo");

    const heading = page.getByRole("heading", {
      name: /one illustrative context/i,
    });
    const draft = page.getByTestId("demo-draft");
    const presentation = await page.evaluate(() => {
      const title = document.querySelector("h1");
      const draftText = document.querySelector('[data-testid="demo-draft"]');
      const input = document.querySelector('[data-testid="demo-input"]');
      const output = document.querySelector('[data-testid="demo-output"]');
      if (!title || !draftText) return null;
      return {
        titleFont: getComputedStyle(title).fontFamily,
        draftFont: getComputedStyle(draftText).fontFamily,
        input: input?.getBoundingClientRect().toJSON(),
        output: output?.getBoundingClientRect().toJSON(),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });

    await expect(heading).toBeVisible();
    await expect(draft).toBeVisible();
    expect(presentation).not.toBeNull();
    expect(presentation!.titleFont.toLowerCase()).toContain("cormorant");
    expect(presentation!.draftFont.toLowerCase()).toContain("dm sans");
    expect(presentation!.input).toBeDefined();
    expect(presentation!.output).toBeDefined();
    expect(presentation!.overflow).toBe(false);
    if (viewport.width > 1000) {
      expect(presentation!.output!.left).toBeGreaterThan(
        presentation!.input!.right,
      );
    } else {
      expect(presentation!.output!.top).toBeGreaterThan(
        presentation!.input!.bottom,
      );
    }
  }
});
