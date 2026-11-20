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

test("offerings disclosure explains drafts and restores keyboard focus @smoke", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  const toggle = nav.getByRole("button", { name: "What we offer" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const linkedin = nav.getByRole("link", {
    name: /LinkedIn connection notes/u,
  });
  await expect(linkedin).toContainText("selected profile");
  await expect(
    nav.getByRole("link", { name: /Cold email and InMail/u }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: /Application answers/u }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(linkedin).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(linkedin).toBeHidden();
  await toggle.click();
  await page.locator("main").click({ position: { x: 12, y: 120 } });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("compact menu explains offerings and links back from legal pages @smoke", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/privacy");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Open navigation menu" }).click();
  const menu = nav.locator("#landing-mobile-navigation");
  await expect(menu.getByText("What we offer", { exact: true })).toBeVisible();
  await menu.getByRole("link", { name: /Application answers/u }).click();
  await expect(page).toHaveURL(/\/#application-answers$/u);
  await expect(menu).toBeHidden();
  const footer = page
    .getByRole("contentinfo")
    .getByRole("navigation", { name: "Footer navigation" });
  await expect(
    footer.getByRole("link", { name: "Privacy", exact: true }),
  ).toHaveAttribute("href", "/privacy");
});

test("landing progress follows the full page and remains readable on mobile @smoke", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const indicator = page.locator("[data-landing-scroll-progress]");
  await expect(indicator).toHaveText("0%");
  await page.evaluate(() => {
    const end = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: end / 2, behavior: "instant" });
  });
  await expect(indicator).toHaveText("50%");
  await expect
    .poll(() =>
      indicator.locator("span > span").evaluate((fill) => {
        const scale = new DOMMatrix(getComputedStyle(fill).transform).d;
        return Math.abs(scale - 0.5);
      }),
    )
    .toBeLessThan(0.01);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "instant",
    }),
  );
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveText("100%");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/u);
  await expect(indicator).toHaveCount(0);
});
