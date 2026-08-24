import { expect, test } from "@playwright/test";

test("landing communicates review-first and no-send boundaries @smoke", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /bring the right context to every professional introduction/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/never clicks send/i).first()).toBeVisible();
  await expect(page.getByText(/optional auto-fill/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Application answers", exact: true }),
  ).toBeVisible();
});

test("landing exposes public trust resources and trial-only pricing @smoke", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Illustrative example →", exact: true }),
  ).toHaveAttribute("href", "/demo");
  await expect(
    page.getByRole("link", { name: /current status/i }),
  ).toHaveAttribute("href", "/status");
  await expect(
    page.getByText(/refill checkout is not available yet/i),
  ).toBeVisible();
  await expect(page.getByText("Starter", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Plus", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Pro", { exact: true })).toHaveCount(0);
});

test("public metadata uses the canonical domain @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://www.aletheia.live",
  );
});

test("crawler metadata exposes only public canonical routes @smoke", async ({
  request,
}) => {
  const [robots, sitemap, image] = await Promise.all([
    request.get("/robots.txt"),
    request.get("/sitemap.xml"),
    request.get("/opengraph-image"),
  ]);

  await expect(robots).toBeOK();
  await expect(sitemap).toBeOK();
  await expect(image).toBeOK();
  expect(
    (await robots.text()).includes("https://www.aletheia.live/sitemap.xml"),
  ).toBe(true);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("https://www.aletheia.live/demo");
  expect(sitemapText).toContain("https://www.aletheia.live/install");
  expect(sitemapText).not.toContain("/auth/login");
  expect(image.headers()["content-type"]).toContain("image/png");
});
