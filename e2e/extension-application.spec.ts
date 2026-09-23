import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

declare global {
  interface Window {
    aleTest: {
      messages: Array<{ action: string; payload?: Record<string, unknown> }>;
      copied: string;
      feedbackFails: boolean;
      holdGeneration: boolean;
      generationCallback?: (response: unknown) => void;
      generationResponse?: Record<string, unknown>;
    };
  }
}

async function openPopup(page: Page, authenticated = true) {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.route("**/*", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!pathname.startsWith("/extension/")) return route.abort();
    const relative = pathname.slice("/extension/".length);
    const root = path.resolve("ascendia-extension");
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return route.abort();
    const contentType = file.endsWith(".js")
      ? "text/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : file.endsWith(".html")
          ? "text/html"
          : "application/octet-stream";
    try {
      await route.fulfill({ body: await readFile(file), contentType });
    } catch {
      await route.fulfill({ status: 404, body: "" });
    }
  });
  await page.addInitScript(
    ({ authenticated }) => {
      window.aleTest = {
        messages: [],
        copied: "",
        feedbackFails: false,
        holdGeneration: false,
      };
      const storage = (
        key: string,
        defaults: Record<string, unknown> = {},
      ) => ({
        get: async () => ({
          ...defaults,
          ...JSON.parse(sessionStorage.getItem(key) || "{}"),
        }),
        set: async (value: Record<string, unknown>) =>
          sessionStorage.setItem(
            key,
            JSON.stringify({
              ...defaults,
              ...JSON.parse(sessionStorage.getItem(key) || "{}"),
              ...value,
            }),
          ),
        remove: async (keys: string | string[]) => {
          const value = JSON.parse(sessionStorage.getItem(key) || "{}");
          for (const name of Array.isArray(keys) ? keys : [keys])
            delete value[name];
          sessionStorage.setItem(key, JSON.stringify(value));
        },
        setAccessLevel: async () => {},
      });
      const noopListener = { addListener: () => {} };
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (value: string) => {
            window.aleTest.copied = value;
          },
        },
      });
      Object.assign(window, {
        chrome: {
          storage: {
            local: storage("test-local", { profileExtractionConsent: true }),
            session: storage("test-session"),
            sync: storage("test-sync"),
            onChanged: noopListener,
          },
          alarms: { create: async () => {}, clear: async () => true },
          tabs: {
            query: async () => [{ id: 1, url: "https://example.test" }],
            onUpdated: noopListener,
            onActivated: noopListener,
            create: async () => {},
          },
          runtime: {
            getManifest: () => ({ version: "1.0.17" }),
            sendMessage: (
              message: { action: string; payload?: { questions?: string[] } },
              callback?: (value: unknown) => void,
            ) => {
              window.aleTest.messages.push(message);
              let response: Record<string, unknown> = { success: true };
              const authed =
                sessionStorage.getItem("test-authenticated") === "true" ||
                authenticated;
              if (
                message.action === "getAuthStatus" ||
                message.action === "silentAuthCheck"
              )
                response = { authenticated: authed, user: { id: "user-1" } };
              if (message.action === "authenticate") {
                sessionStorage.setItem("test-authenticated", "true");
                response = { success: true, user: { id: "user-1" } };
              }
              if (
                message.action === "sendFeedback" &&
                window.aleTest.feedbackFails
              )
                response = { success: false };
              if (message.action === "generate") {
                const body = Array.from(
                  { length: 50 },
                  () => "experience",
                ).join(" ");
                response = {
                  success: true,
                  category: "yc_application",
                  body,
                  answers: (message.payload?.questions ?? []).map(
                    (question, index) => ({
                      questionId: `q${index + 1}`,
                      question,
                      body,
                      word_count: 50,
                      character_count: body.length,
                    }),
                  ),
                  evalMetadata: {
                    generationId: "33333333-3333-4333-8333-333333333333",
                    category: "yc_application",
                    promptVersion: "yc-1.2.0",
                    model: "mock",
                    generationTimeMs: 1,
                    inputTokens: 1,
                    outputTokens: 1,
                    profileFieldCount: 1,
                    confirmedEvidenceCount: 1,
                    resumeSource: "none",
                    injectionTriggered: false,
                    groundingValidationPassed: true,
                  },
                };
                if (window.aleTest.holdGeneration && callback) {
                  window.aleTest.generationCallback = callback;
                  window.aleTest.generationResponse = response;
                  return;
                }
              }
              if (callback) callback(response);
              return Promise.resolve(response);
            },
          },
        },
      });
    },
    { authenticated },
  );
  await page.goto("http://127.0.0.1:45678/extension/popup/popup.html");
  await expect(page.locator("#mainContent")).toBeVisible();
}
const jd =
  "PRIVATE JOB DESCRIPTION. Build reliable applications and work closely with customers from discovery through production delivery.";

test("ordered answers, copy controls and report modal work without persisting inputs @smoke", async ({
  page,
}) => {
  await openPopup(page);
  await page.selectOption("#category", "yc_application");
  await page.fill("#jdInput", jd);
  const questions = Array.from(
    { length: 5 },
    (_, index) => `PRIVATE QUESTION ${index + 1}: Describe your experience?`,
  );
  await page.fill("#ycQuestionInput", questions.join("\n"));
  await page.click("#generateBtn");
  await expect(page.locator(".application-answer")).toHaveCount(5);
  await expect(page.locator(".application-answer h3")).toHaveText(questions);
  await page
    .getByRole("button", { name: "Copy answer 3", exact: true })
    .click();
  expect(await page.evaluate(() => window.aleTest.copied)).not.toContain(
    "PRIVATE",
  );
  await page.click("#copyAllBtn");
  expect(await page.evaluate(() => window.aleTest.copied)).toContain(
    `**${questions[0]}**\n`,
  );
  await page.screenshot({
    path: "/tmp/ale37-application-review.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Report issue" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.fill(
    "#feedbackSummary",
    "User reports an invented leadership achievement.",
  );
  await page.evaluate(() => {
    window.aleTest.feedbackFails = true;
  });
  await page.click("#feedbackSubmit");
  await expect(page.locator("#feedbackError")).toContainText(
    "could not be saved",
  );
  await expect(page.locator("#feedbackSummary")).toHaveValue(
    "User reports an invented leadership achievement.",
  );
  await page.evaluate(() => {
    window.aleTest.feedbackFails = false;
  });
  await page.click("#feedbackSubmit");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("#rejectBtn")).toBeFocused();
  const persisted = await page.evaluate(() => ({
    local: sessionStorage.getItem("test-local"),
    messages: window.aleTest.messages,
  }));
  expect(persisted.local).not.toMatch(/PRIVATE QUESTION|PRIVATE JOB/);
  const reports = persisted.messages.filter(
    (message) => message.action === "sendFeedback",
  );
  expect(JSON.stringify(reports)).not.toMatch(/PRIVATE|experience experience/);
  expect(
    persisted.messages.filter((message) => message.action === "generate"),
  ).toHaveLength(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator(".application-answer h3").first()).toHaveText(
    "Answer 1",
  );
  await expect(page.locator("#ycQuestionInput")).toHaveValue("");
  await expect(page.locator("#regenerateApplicationBtn")).toBeDisabled();
});

test("signed-out application draft survives authentication and is consumed once @smoke", async ({
  page,
}) => {
  await openPopup(page, false);
  await page.fill("#jdInput", jd);
  await page.fill(
    "#ycQuestionInput",
    "PRIVATE QUESTION: Describe your experience?",
  );
  await page.click("#connectBtn");
  await expect(page.locator("#connectBtn")).toHaveCount(0);
  await expect(page.locator("#jdInput")).toHaveValue(jd);
  await expect(page.locator("#ycQuestionInput")).toHaveValue(
    "PRIVATE QUESTION: Describe your experience?",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("test-session") || "{}")
          .applicationAuthDraft,
    ),
  ).toBeUndefined();
  expect(
    await page.evaluate(() => sessionStorage.getItem("test-local") || ""),
  ).not.toContain("PRIVATE");
  await page.click("#generateBtn");
  await expect(page.locator(".application-answer")).toHaveCount(1);
  await page.click("#rejectBtn");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("#rejectBtn")).toBeFocused();
});

test("invalid question input explains how to recover without a request @smoke", async ({
  page,
}) => {
  await openPopup(page);
  await page.selectOption("#category", "yc_application");
  await page.fill("#jdInput", jd);
  await page.fill("#ycQuestionInput", "short");
  await expect(page.locator("#generateBtn")).toBeDisabled();
  await expect(page.locator("#applicationInputStatus")).toContainText(
    "Question 1 must contain 10–500 characters",
  );
  await expect(page.locator("#ycQuestionInput")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.fill("#ycQuestionInput", "Describe your relevant experience?");
  await expect(page.locator("#generateBtn")).toBeEnabled();
  await expect(page.locator("#ycQuestionInput")).toHaveAttribute(
    "aria-invalid",
    "false",
  );
  expect(
    await page.evaluate(() =>
      window.aleTest.messages.filter(
        (message) => message.action === "generate",
      ),
    ),
  ).toHaveLength(0);
});

test("ZIP-source popup paints the orb, reports elapsed time, and stops after success @smoke", async ({
  page,
}) => {
  await openPopup(page);
  await page.selectOption("#category", "yc_application");
  await page.fill("#jdInput", jd);
  await page.fill("#ycQuestionInput", "Describe your relevant experience?");
  await page.evaluate(() => {
    window.aleTest.holdGeneration = true;
  });
  await page.click("#generateBtn");
  await expect(page.locator("#generationProgress")).toBeVisible();
  await expect(page.locator("#generationProgressLabel")).toHaveText(
    "Generating your draft",
  );
  await expect(page.locator("#generateBtn")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect
    .poll(() =>
      page.locator("#generationOrb").evaluate((canvas) => {
        const surface = canvas as HTMLCanvasElement;
        const pixels = surface
          .getContext("2d")!
          .getImageData(0, 0, surface.width, surface.height).data;
        return pixels.some((value, index) => index % 4 === 3 && value > 0);
      }),
    )
    .toBe(true);
  await expect(page.locator("#generationElapsed")).not.toHaveText(
    "0:00 elapsed",
    { timeout: 3_000 },
  );
  await page.screenshot({ path: "/tmp/aletheia-extension-orb.png" });
  await page.evaluate(() => {
    window.aleTest.generationCallback?.(window.aleTest.generationResponse);
  });
  await expect(page.locator("#generationProgress")).toBeHidden();
  await expect(page.locator("#generateBtn")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".application-answer")).toHaveCount(1);
});

test("ZIP-source popup clears progress after failure and respects reduced motion @smoke", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPopup(page);
  await page.selectOption("#category", "yc_application");
  await page.fill("#jdInput", jd);
  await page.fill("#ycQuestionInput", "Describe your relevant experience?");
  await page.evaluate(() => {
    window.aleTest.holdGeneration = true;
  });
  await page.click("#generateBtn");
  await expect(page.locator("#generationProgress")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("#generationOrb").evaluate((canvas) => {
        const surface = canvas as HTMLCanvasElement;
        return surface
          .getContext("2d")!
          .getImageData(0, 0, surface.width, surface.height)
          .data.some((value, index) => index % 4 === 3 && value > 0);
      }),
    )
    .toBe(true);
  expect(
    await page
      .locator("#generateBtn")
      .evaluate((button) => getComputedStyle(button, "::after").animationName),
  ).toBe("none");
  await page.evaluate(() => {
    window.aleTest.generationCallback?.({
      success: false,
      code: "GENERATION_FAILED",
      message: "Please try again.",
    });
  });
  await expect(page.locator("#generationProgress")).toBeHidden();
  await expect(page.locator("#generateBtn")).toBeEnabled();
  await expect(page.locator("#generateBtn")).toHaveAttribute(
    "aria-busy",
    "false",
  );
});
