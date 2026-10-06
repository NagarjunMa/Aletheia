import { expect, test } from "@playwright/test";

const pages = [
  "/",
  "/demo",
  "/privacy",
  "/terms",
  "/status",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
];

for (const width of [375, 900, 1440]) {
  for (const pathname of pages) {
    test(`theme and layout stay intact at ${pathname}, ${width}px @smoke`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      // These are rendering checks, never real auth, analytics or provider calls.
      const appOrigin = new URL(
        test.info().project.use.baseURL ?? "http://localhost:3000",
      ).origin;
      await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === appOrigin
          ? route.continue()
          : route.abort(),
      );
      const response = await page.goto(pathname);
      expect(response?.status()).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("h1").first()).toBeVisible();
      const styles = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        return {
          background: body.backgroundColor,
          color: body.color,
          font: body.fontFamily,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(styles).toEqual({
        background: "rgb(2, 4, 3)",
        color: "rgb(246, 249, 248)",
        font: expect.stringContaining("DM Sans"),
        overflow: false,
      });

      if (pathname === "/auth/login" || pathname === "/auth/register") {
        const email = page.locator("#email");
        await expect(email).toBeVisible();
        expect(
          await email.evaluate((el) => el.getBoundingClientRect().height),
        ).toBeCloseTo(47, 0);
        await email.focus();
        await expect(email).toBeFocused();
      }
    });
  }
}
