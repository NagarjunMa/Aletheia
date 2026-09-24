import { expect, test } from "@playwright/test";
import { OPENSPEECH_WIDGET_URL } from "../components/landing/OpenSpeechWidget";

const MOCK_WIDGET_SCRIPT = `
  const host = document.createElement("div");
  host.id = "openspeech-widget-host";
  host.style.display = "block";
  const shadowRoot = host.attachShadow({ mode: "open" });
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Open chat");
  shadowRoot.appendChild(button);
  document.body.appendChild(host);
`;

test("support widget does not initialize on a direct non-landing visit @smoke", async ({
  page,
}) => {
  let widgetRequestCount = 0;
  await page.route(OPENSPEECH_WIDGET_URL, (route) => {
    widgetRequestCount += 1;
    return route.fulfill({
      contentType: "application/javascript",
      body: MOCK_WIDGET_SCRIPT,
    });
  });

  await page.goto("/privacy");
  await expect(page.locator("#openspeech-ai-chat-widget")).toHaveCount(0);
  await expect(page.locator("#openspeech-widget-host")).toHaveCount(0);
  expect(widgetRequestCount).toBe(0);
});

test("support widget remains scoped to the landing route @smoke", async ({
  page,
}) => {
  await page.route(OPENSPEECH_WIDGET_URL, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: MOCK_WIDGET_SCRIPT,
    }),
  );

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open chat" })).toBeVisible();

  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("button", { name: "Open chat" })).toBeHidden();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Open chat" })).toBeVisible();
});

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
    page.getByRole("link", { name: "Application answers", exact: true }),
  ).toBeVisible();
});

test("landing uses the editorial evergreen hierarchy and semantic navigation @smoke", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  await expect(page.locator("#main-content")).toHaveCount(1);
  await expect(
    page.getByRole("complementary", {
      name: /how aletheia prepares a review-first draft/i,
    }),
  ).toBeVisible();

  const typography = await page.evaluate(() => {
    const landing = document.querySelector<HTMLElement>(".landing-marketing");
    const heading = document.querySelector<HTMLElement>(".landing-hero-title");

    return {
      body: landing ? getComputedStyle(landing).fontFamily : "",
      heading: heading ? getComputedStyle(heading).fontFamily : "",
    };
  });

  expect(typography.body.toLowerCase()).toContain("dm");
  expect(typography.heading.toLowerCase()).toContain("cormorant");
});

test("landing remains readable with reduced motion and at mobile width @smoke", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /bring the right context to every professional introduction/i,
    }),
  ).toBeVisible();

  const state = await page.evaluate(() => {
    const reveal = document.querySelector<HTMLElement>(
      "[data-landing-hero-item]",
    );
    return {
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > window.innerWidth,
      transform: reveal ? getComputedStyle(reveal).transform : "missing",
      visibility: reveal ? getComputedStyle(reveal).visibility : "missing",
    };
  });

  expect(state.hasHorizontalOverflow).toBe(false);
  expect(state.transform).toBe("none");
  expect(state.visibility).toBe("visible");
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

test("public metadata uses route-specific canonical URLs @smoke", async ({
  page,
}) => {
  const publicRoutes = [
    "/",
    "/demo",
    "/install",
    "/status",
    "/privacy",
    "/terms",
  ];

  for (const route of publicRoutes) {
    await page.goto(route);
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    await expect(canonical).toHaveAttribute(
      "href",
      `https://www.aletheia.live${route === "/" ? "" : route}`,
    );
  }
});

test("public contact links use the support inbox @smoke", async ({ page }) => {
  for (const route of ["/", "/privacy", "/terms"]) {
    await page.goto(route);
    await expect(
      page.locator('a[href="mailto:support@aletheia.live"]').first(),
    ).toBeVisible();
    await expect(page.locator('a[href^="mailto:hello@"]')).toHaveCount(0);
  }
});

test("public feedback form explains the email-app handoff @smoke", async ({
  page,
}) => {
  await page.goto("/");
  const feedback = page.locator("#feedback");
  await expect(
    feedback.getByRole("heading", { name: /share your perspective/i }),
  ).toBeVisible();
  await expect(
    feedback.getByRole("textbox", { name: "Your name" }),
  ).toBeVisible();
  await expect(
    feedback.getByRole("textbox", { name: "Your message" }),
  ).toHaveAttribute("maxlength", "1200");
  await expect(
    feedback.getByRole("button", { name: /open email draft/i }),
  ).toBeVisible();
  await expect(
    feedback.getByText(
      /nothing is sent until you send it from your email app/i,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Feedback" }),
  ).toHaveAttribute("href", "/#feedback");

  const message = feedback.getByRole("textbox", { name: "Your message" });
  await message.fill("            ");
  await feedback.getByRole("button", { name: /open email draft/i }).click();
  expect(
    await message.evaluate(
      (element: HTMLTextAreaElement) => element.validity.customError,
    ),
  ).toBe(true);
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
