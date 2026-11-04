import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Route,
  type Worker,
} from "@playwright/test";
import { resolve } from "node:path";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const test = base.extend<{ slowReader: boolean }>({
  slowReader: [false, { option: true }],
});

const first = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Policy prototype",
  kind: "technical_project",
};
const second = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Review guide",
  kind: "technical_project",
};
const jd =
  "Build and maintain a policy evaluation system, working with engineers to measure behavior and document deployment limits.";
const answer = Array.from({ length: 50 }, (_, index) => `word${index}`).join(
  " ",
);

declare const chrome: {
  storage: {
    session: { get: (_key: string) => Promise<Record<string, unknown>> };
    local: {
      set: (_values: Record<string, unknown>) => Promise<void>;
      get: (_key: string) => Promise<Record<string, unknown>>;
    };
  };
};

async function signIn(worker: Worker, id: string, expiresIn = 3600) {
  await worker.evaluate(
    async ({ userId, expiresIn }) => {
      await chrome.storage.local.set({
        profileExtractionConsent: true,
        aletheia_auth: {
          access_token: `token-${userId}`,
          refresh_token: "unused",
          expires_at: Math.floor(Date.now() / 1000) + expiresIn,
          supabase_url: "https://www.aletheia.live",
          supabase_anon_key: "synthetic-key",
          user: { id: userId, email: `${userId}@example.test` },
        },
      });
    },
    { userId: id, expiresIn },
  );
}

let browser: BrowserContext;
let scratchExtension: string | undefined;
test.beforeEach(async ({ slowReader }) => {
  let extension = resolve("ascendia-extension/dist");
  if (slowReader) {
    scratchExtension = await mkdtemp(resolve(tmpdir(), "ale55-chromium-"));
    await cp(extension, scratchExtension, { recursive: true });
    extension = scratchExtension;
    // Exercise the built panel and worker with a controllably delayed reader.
    await writeFile(
      resolve(extension, "content/linkedin-reader.js"),
      `
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.action !== "getProfile") return;
        const name = document.title;
        const respond = () => sendResponse({ success: true, profile: {
          name, profileMarkdown: name + " builds evaluation tools for applied AI systems.",
        } });
        if (name !== "Alice") { respond(); return; }
        const root = document.documentElement;
        root.dataset.readerPending = "true";
        if (root.dataset.releaseReader) { respond(); return; }
        const observer = new MutationObserver(() => {
          if (!root.dataset.releaseReader) return;
          observer.disconnect();
          respond();
        });
        observer.observe(root, { attributes: true, attributeFilter: ["data-release-reader"] });
        return true;
      });
    `,
    );
  }
  browser = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      "--host-resolver-rules=MAP www.aletheia.live 127.0.0.1, MAP aletheia.live 127.0.0.1, MAP www.linkedin.com 127.0.0.1",
    ],
  });
});
test.afterEach(async () => {
  await browser?.close();
  if (scratchExtension) {
    await rm(scratchExtension, { recursive: true, force: true });
    scratchExtension = undefined;
  }
});

async function openPanel(worker: Worker) {
  const page = await browser.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
  );
  await expect(page.locator("#userBadge")).toBeVisible();
  return page;
}

test("uses the selected endpoint, recovers from stale stories and clears before automatic generation", async () => {
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  let refusal: 422 | 405 | null = null;
  let listAvailable = false;
  const refreshRequests: string[] = [];
  await browser.route(
    "https://www.aletheia.live/auth/v1/token?*",
    async (route) => {
      refreshRequests.push(route.request().method());
      await route.fulfill({ status: 401 });
    },
  );
  await browser.route(
    "https://www.aletheia.live/api/extension/**",
    async (route) => {
      const req = route.request();
      if (req.method() === "GET")
        return listAvailable
          ? route.fulfill({ json: { evidence: [first, second] } })
          : route.fulfill({ status: 404 });
      posts.push({
        path: new URL(req.url()).pathname,
        body: req.postDataJSON(),
      });
      if (refusal)
        return route.fulfill({
          status: refusal,
          json: {
            success: false,
            code: "EVIDENCE_SELECTION_UNAVAILABLE",
            message: "The story is unavailable.",
          },
        });
      return route.fulfill({
        json: { success: true, category: "yc_application", body: answer },
      });
    },
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", 120);
  const page = await openPanel(worker);
  await page.locator("#category").selectOption("yc_application");
  await page.locator("#jdInput").fill(jd);
  await page.getByText("Story focus · Automatic", { exact: true }).click();
  await expect(page.locator("#evidenceStatus")).toContainText(
    "unavailable on this server",
  );
  listAvailable = true;
  await page.getByRole("button", { name: "Reload stories" }).click();
  await page.getByRole("checkbox", { name: /Policy prototype/ }).check();
  await page.getByRole("checkbox", { name: /Review guide/ }).check();
  await expect(page.locator("#evidenceSummary")).toHaveText(/2 selected/);
  await page.locator("#generateBtn").click();
  await expect(page.locator("#output")).toBeVisible();
  expect(posts[0]).toMatchObject({
    path: "/api/extension/evidence",
    body: { selectedEvidenceIds: [first.id, second.id] },
  });
  expect(
    await worker.evaluate(() => chrome.storage.local.get("lastGeneration")),
  ).toEqual({});

  refusal = 422;
  await page.locator("#generateBtn").click();
  await expect(page.locator("#evidenceStatus")).toContainText(
    "Change your selection",
  );
  await expect(
    page.getByRole("checkbox", { name: /Policy prototype/ }),
  ).toBeChecked();

  refusal = 405;
  await page.locator("#generateBtn").click();
  await expect(page.locator("#errorText")).toContainText(
    "cannot generate with selected stories",
  );
  expect(posts).toHaveLength(3);
  expect(posts.every(({ path }) => path === "/api/extension/evidence")).toBe(
    true,
  );

  expect(refreshRequests).toEqual([]);
  refusal = null;
  await signIn(worker, "user-a");
  await page
    .locator("#jdInput")
    .fill(jd + " The role also supports customer research.");
  await expect(
    page.getByRole("checkbox", { name: /Policy prototype/ }),
  ).not.toBeChecked();
  await page.locator("#generateBtn").click();
  await expect.poll(() => posts.length).toBe(4);
  expect(posts[3]?.path).toBe("/api/extension/generate");
  expect(posts[3]?.body).not.toHaveProperty("selectedEvidenceIds");
});

test("uses the near-expiry bearer without changing auth and discards a delayed response after an account switch", async () => {
  let delayed: Route | undefined;
  const refreshRequests: string[] = [];
  await browser.route(
    "https://www.aletheia.live/auth/v1/token?*",
    async (route) => {
      refreshRequests.push(route.request().method());
      await route.fulfill({ status: 401 });
    },
  );
  await browser.route(
    "https://www.aletheia.live/api/extension/evidence",
    async (route) => {
      if (route.request().headers().authorization === "Bearer token-user-a") {
        delayed = route;
        return;
      }
      await route.fulfill({ json: { evidence: [second] } });
    },
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", 120);
  const page = await openPanel(worker);
  await page.getByText("Story focus · Automatic", { exact: true }).click();
  await expect
    .poll(() => (delayed ? "list" : (refreshRequests[0] ?? "waiting")))
    .toBe("list");
  await expect(page.locator("#evidenceStatus")).toContainText(
    "Loading confirmed stories",
  );
  await signIn(worker, "user-b");
  await expect(page.locator("#userBadge")).toContainText("user-b@example.test");
  await delayed?.fulfill({ json: { evidence: [first] } });
  await page.getByText("Story focus · Automatic", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Review guide/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Policy prototype/ }),
  ).toHaveCount(0);
  expect(refreshRequests).toEqual([]);
});

test("an expired startup session cannot restore the previous account", async () => {
  let pending: Route | undefined;
  await browser.route(
    "https://www.aletheia.live/api/extension/session",
    (route) => {
      pending = route;
    },
  );
  await browser.route("https://www.aletheia.live/auth/v1/token?*", (route) => {
    pending = route;
  });
  await browser.route(
    "https://www.aletheia.live/api/extension/evidence",
    (route) =>
      route.fulfill({
        json: {
          evidence:
            route.request().headers().authorization === "Bearer token-user-b"
              ? [second]
              : [first],
        },
      }),
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", -60);
  const page = await browser.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
  );
  await expect.poll(() => pending?.request().method()).toMatch(/^(GET|POST)$/u);
  await signIn(worker, "user-b");
  await pending?.fulfill({
    json: {
      access_token: "token-user-a",
      refresh_token: "unused",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      supabase_url: "https://www.aletheia.live",
      supabase_anon_key: "synthetic-key",
      user: { id: "user-a", email: "user-a@example.test" },
    },
  });
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const key = "aletheia_diagnostic_events_v1";
        const stored = await chrome.storage.session.get(key);
        const events = stored[key] as Array<{ event: string }> | undefined;
        return events?.some(
          ({ event }) => event === "auth.silent_check.complete",
        );
      }),
    )
    .toBe(true);
  expect(
    await worker.evaluate(() => chrome.storage.local.get("aletheia_auth")),
  ).toMatchObject({ aletheia_auth: { user: { id: "user-b" } } });
  await expect(page.locator("#userBadge")).toContainText("user-b@example.test");
  await page.getByText("Story focus · Automatic", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Review guide/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Policy prototype/ }),
  ).toHaveCount(0);
});

test("renews the connected account before checking the web session", async () => {
  let webSessionRequests = 0;
  await browser.route(
    "https://www.aletheia.live/api/extension/session",
    (route) => {
      webSessionRequests++;
      return route.fulfill({ status: 401, json: {} });
    },
  );
  await browser.route("https://www.aletheia.live/auth/v1/token?*", (route) =>
    route.fulfill({
      json: {
        access_token: "renewed-user-a",
        refresh_token: "rotated-user-a",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "user-a", email: "user-a@example.test" },
      },
    }),
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", -60);
  const page = await openPanel(worker);
  await expect(page.locator("#userBadge")).toContainText("user-a@example.test");
  expect(
    await worker.evaluate(() => chrome.storage.local.get("aletheia_auth")),
  ).toMatchObject({
    aletheia_auth: { user: { id: "user-a" }, access_token: "renewed-user-a" },
  });
  expect(webSessionRequests).toBe(0);
});

test("a delayed automatic generation 401 leaves the newly connected account intact", async () => {
  let pending: Route | undefined;
  let webSessionRequests = 0;
  await browser.route(
    "https://www.aletheia.live/api/extension/generate",
    async (route) => {
      if (route.request().method() === "POST") {
        pending = route;
        return;
      }
      await route.fulfill({ json: {} });
    },
  );
  await browser.route(
    "https://www.aletheia.live/api/extension/session",
    (route) => {
      webSessionRequests++;
      return route.fulfill({ status: 401, json: {} });
    },
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a");
  const page = await openPanel(worker);
  await page.locator("#category").selectOption("yc_application");
  await page.locator("#jdInput").fill(jd);
  await page.locator("#generateBtn").click();
  await expect.poll(() => Boolean(pending)).toBe(true);

  await signIn(worker, "user-b");
  await pending?.fulfill({
    status: 401,
    json: { code: "SESSION_UNAVAILABLE" },
  });
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const key = "aletheia_diagnostic_events_v1";
        const stored = await chrome.storage.session.get(key);
        const events = stored[key] as
          Array<{ stage?: string; errorCode?: string }> | undefined;
        return events?.some(
          (entry) =>
            entry.stage === "generation.workflow" &&
            entry.errorCode === "AUTH_ACCOUNT_CHANGED",
        );
      }),
    )
    .toBe(true);
  await expect(page.locator("#userBadge")).toContainText("user-b@example.test");
  expect(webSessionRequests).toBe(0);
  expect(
    await worker.evaluate(() => chrome.storage.local.get("aletheia_auth")),
  ).toMatchObject({ aletheia_auth: { user: { id: "user-b" } } });
});

test("adopts a different web account only after the user explicitly connects", async () => {
  await browser.route("https://www.aletheia.live/auth/v1/token?*", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await browser.route(
    "https://www.aletheia.live/api/extension/session",
    (route) =>
      route.fulfill({
        json: {
          access_token: "token-user-b",
          refresh_token: "new-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          supabase_url: "https://www.aletheia.live",
          supabase_anon_key: "synthetic-key",
          user: { id: "user-b", email: "user-b@example.test" },
        },
      }),
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", -60);
  const page = await browser.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
  );
  const connect = page.getByRole("button", { name: "Connect to Aletheia" });
  await expect(connect).toBeVisible();
  expect(
    await worker.evaluate(() => chrome.storage.local.get("aletheia_auth")),
  ).toMatchObject({ aletheia_auth: { user: { id: "user-a" } } });
  await connect.click();
  await expect(page.locator("#userBadge")).toContainText("user-b@example.test");
});

test.describe("delayed profile read", () => {
  test.use({ slowReader: true });

  test("ignores the previous profile and clears the old account's visible stories during startup", async () => {
    await browser.route("https://www.linkedin.com/in/*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<title>${route.request().url().endsWith("alice") ? "Alice" : "Bob"}</title>`,
      }),
    );
    await browser.route(
      "https://www.aletheia.live/api/extension/evidence",
      (route) =>
        route.fulfill({
          json: {
            evidence:
              route.request().headers().authorization === "Bearer token-user-a"
                ? [first]
                : [second],
          },
        }),
    );
    const worker =
      browser.serviceWorkers()[0] ??
      (await browser.waitForEvent("serviceworker"));
    await signIn(worker, "user-a");
    const alice = await browser.newPage();
    await alice.goto("https://www.linkedin.com/in/alice");
    const bob = await browser.newPage();
    await bob.goto("https://www.linkedin.com/in/bob");
    const page = await browser.newPage();
    await alice.bringToFront();
    await page.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
    );
    await expect(alice.locator("html")).toHaveAttribute(
      "data-reader-pending",
      "true",
    );
    await page.getByText("Story focus · Automatic", { exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: /Policy prototype/ }),
    ).toBeVisible();

    // Both events happen before the old profile read resolves.
    await bob.bringToFront();
    await expect(page.locator("#profileName")).toHaveText("Bob");
    await page.getByRole("checkbox", { name: /Policy prototype/ }).check();
    await signIn(worker, "user-b");
    await expect(page.locator("#userBadge")).toContainText(
      "user-b@example.test",
    );
    await expect(page.locator("#profileName")).toHaveText("Bob");
    await alice
      .locator("html")
      .evaluate((element) =>
        element.setAttribute("data-release-reader", "yes"),
      );
    await page.getByText("Story focus · Automatic", { exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: /Review guide/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /Policy prototype/ }),
    ).toHaveCount(0);
    await expect(page.locator("#profileName")).toHaveText("Bob");
  });
});
