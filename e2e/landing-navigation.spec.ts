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
  const tabletLayout = await page.evaluate(() => {
    const copy = document.querySelector(".landing-hero-copy");
    const ledger = document.querySelector(".landing-context-ledger");
    if (!copy || !ledger) return null;
    return {
      copyBottom: copy.getBoundingClientRect().bottom,
      ledgerTop: ledger.getBoundingClientRect().top,
    };
  });
  expect(tabletLayout).not.toBeNull();
  if (tabletLayout) {
    expect(tabletLayout.ledgerTop).toBeGreaterThanOrEqual(
      tabletLayout.copyBottom,
    );
  }
});

test("hero follows the tablet-to-desktop column breakpoint @smoke", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 908 });
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  for (const width of [1023, 1024, 1257, 1279, 1280]) {
    await page.setViewportSize({ width, height: 908 });

    const layout = await page.evaluate(() => {
      const copy = document.querySelector<HTMLElement>(".landing-hero-copy");
      const ledger = document.querySelector<HTMLElement>(
        ".landing-context-ledger",
      );
      const heading = document.querySelector<HTMLElement>(
        ".landing-hero-title",
      );
      const header = document.querySelector<HTMLElement>(".landing-navbar");
      if (!copy || !ledger || !heading || !header) return null;

      return {
        copy: copy.getBoundingClientRect().toJSON(),
        ledger: ledger.getBoundingClientRect().toJSON(),
        heading: heading.getBoundingClientRect().toJSON(),
        header: header.getBoundingClientRect().toJSON(),
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });

    expect(layout, `hero layout missing at ${width}px`).not.toBeNull();
    if (!layout) continue;
    if (width <= 1023) {
      expect(
        layout.ledger.top,
        `ledger position at ${width}px`,
      ).toBeGreaterThanOrEqual(layout.copy.bottom);
    } else {
      expect(
        layout.ledger.left,
        `ledger position at ${width}px`,
      ).toBeGreaterThanOrEqual(layout.copy.right + 24);
    }
    expect(layout.ledger.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.heading.top).toBeGreaterThanOrEqual(layout.header.bottom);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  }

  await page.setViewportSize({ width: 1257, height: 908 });
  await expect(
    page.getByRole("button", { name: "Open navigation menu" }),
  ).toBeVisible();
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
