import { test, expect } from "@playwright/test";

// @smoke — Mocked E2E used in cd.yml only.
// Verifies the app builds, boots, and critical routes respond.
// No Supabase auth or Anthropic calls — safe to run with dummy env vars.

test("landing page loads @smoke", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveTitle(/Aletheia/);
});

test("approved Throughline mark loads on the landing page @smoke", async ({
  page,
  request,
}) => {
  await page.goto("/");

  const logo = page.getByRole("img", { name: "Aletheia" }).first();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("src", /Aletheia\.svg/u);
  await expect
    .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);

  const asset = await request.get("/Aletheia.svg");
  expect(asset.ok()).toBe(true);
  const svg = await asset.text();
  expect(svg.includes("Aletheia Throughline offset badge")).toBe(true);
  expect(svg.includes("M30 44h29c25 0 17 56 43 56")).toBe(true);
  expect(svg.includes("<image")).toBe(false);

  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/aletheia-apple-touch.png",
  );
  expect((await request.get("/aletheia-apple-touch.png")).ok()).toBe(true);
});

test("login page renders @smoke", async ({ page }) => {
  await page.goto("/auth/login");
  // Middleware may redirect authenticated sessions, but an unauthenticated
  // request with dummy Supabase env vars should land on /auth/login
  expect(page.url()).toContain("/auth/login");
});

test("login content is visually available without an animation dependency @smoke", async ({
  page,
}) => {
  await page.goto("/auth/login");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  const hasHiddenAncestor = await page.locator("form").evaluate((form) => {
    let element: HTMLElement | null = form as HTMLElement;
    while (element) {
      const style = getComputedStyle(element);
      if (style.opacity === "0" || style.visibility === "hidden") return true;
      element = element.parentElement;
    }
    return false;
  });

  expect(hasHiddenAncestor).toBe(false);
  await expect(
    page.getByText(
      /grounded drafts stay under your control from context selection to final review/i,
    ),
  ).toBeVisible();
});

test("Phthalo theme renders without the legacy cyan wash @smoke", async ({
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
    ink: "#020403",
    evergreen: "#10291f",
    emerald: "#5a9d82",
    mint: "#f7faf9",
  });
  expect(theme.shaderBackground).toContain("rgba(120, 180, 155");
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
