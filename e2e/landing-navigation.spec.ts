import { expect, test } from "@playwright/test";

test("closed mobile navigation does not veil anchored content @smoke", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page
    .locator("#landing-mobile-navigation")
    .getByRole("link", { name: "FAQ" })
    .click();
  await expect(page).toHaveURL(/#faq$/u);

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const header = document.querySelector(".landing-navbar");
        const heading = document.querySelector("#faq h2");
        if (!header || !heading) return false;
        const headerBottom = header.getBoundingClientRect().bottom;
        const headingTop = heading.getBoundingClientRect().top;
        return headerBottom < 100 && headingTop >= headerBottom;
      });
    })
    .toBe(true);
});

test("navigation stays compact until full desktop links fit @smoke", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Open navigation menu" }),
  ).toBeVisible();
  const headerHeight = await page
    .locator(".landing-navbar")
    .evaluate((header) => header.getBoundingClientRect().height);
  expect(headerHeight).toBeLessThan(100);
  const supportWidth = await page
    .locator(".landing-hero-support > p:first-child")
    .evaluate((paragraph) => paragraph.getBoundingClientRect().width);
  expect(supportWidth).toBeGreaterThan(300);
});

test("button beam responds to focus and becomes still with reduced motion @smoke", async ({
  page,
}) => {
  await page.goto("/");
  const cta = page.locator("#pricing").getByRole("link", {
    name: "Get Aletheia on Chrome",
  });
  await expect(cta).toBeVisible();
  const beamAnimation = () =>
    cta.evaluate(
      (element) => getComputedStyle(element, "::after").animationName,
    );
  expect(await beamAnimation()).toBe("none");
  await cta.focus();
  expect(await beamAnimation()).toBe("landing-beam-orbit");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await beamAnimation()).toBe("none");
});
