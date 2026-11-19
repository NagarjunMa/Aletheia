import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import acceptanceFixture from "../modules/application-answer/application/fixtures/ale-68-reviewed-evidence.json";

declare global {
  interface Window {
    aleTest: {
      messages: Array<{ action: string; payload?: Record<string, unknown> }>;
      copied: string;
      clipboardFails: boolean;
      feedbackFails: boolean;
      holdGeneration: boolean;
      generationCallback?: (response: unknown) => void;
      generationResponse?: Record<string, unknown>;
    };
  }
}

const fixtureAnswers = Array.from({ length: 5 }, (_, index) =>
  Array.from({ length: 50 }, () => `experience${index + 1}`).join(" "),
);

function captureGenerationDiagnostics(page: Page) {
  const events: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  page.on("console", (message) => {
    try {
      const event = JSON.parse(message.text());
      if (event.module !== "popup" || event.event !== "generation.complete")
        return;
      events.push(event);
      if (["warning", "error"].includes(message.type()))
        errors.push(message.text());
    } catch {
      // Non-JSON browser messages are outside the structured diagnostic contract.
    }
  });
  return { events, errors };
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
    ({ authenticated, fixtureAnswers }) => {
      window.aleTest = {
        messages: [],
        copied: "",
        clipboardFails: false,
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
            if (window.aleTest.clipboardFails) {
              throw new Error("Clipboard unavailable");
            }
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
            getManifest: () => ({ version: "1.0.18" }),
            sendMessage: (
              message: {
                action: string;
                payload?: { questions?: string[] };
                kind?: string;
                requesterId?: string;
                draft?: Record<string, unknown>;
                record?: Record<string, unknown>;
              },
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
              ) {
                if (authed) {
                  const local = JSON.parse(
                    sessionStorage.getItem("test-local") || "{}",
                  );
                  local.aletheia_auth = {
                    access_token: "test-token",
                    user: { id: "user-1" },
                  };
                  sessionStorage.setItem("test-local", JSON.stringify(local));
                }
                response = authed
                  ? { authenticated: true, user: { id: "user-1" } }
                  : { authenticated: false };
              }
              if (message.action === "authenticate") {
                sessionStorage.setItem("test-authenticated", "true");
                response = { success: true, user: { id: "user-1" } };
              }
              if (
                message.action === "saveApplicationAuthDraft" &&
                message.draft
              ) {
                const stored = JSON.parse(
                  sessionStorage.getItem("test-session") || "{}",
                );
                stored.applicationAuthDraft = message.draft;
                sessionStorage.setItem("test-session", JSON.stringify(stored));
              }
              if (message.action === "saveAccountRecord") {
                const local = JSON.parse(
                  sessionStorage.getItem("test-local") || "{}",
                );
                if (
                  local.aletheia_auth?.user?.id !== message.requesterId ||
                  message.record?.ownerId !== message.requesterId
                ) {
                  response = { success: false };
                } else if (message.kind === "lastGeneration") {
                  local.lastGeneration = message.record;
                  sessionStorage.setItem("test-local", JSON.stringify(local));
                } else if (message.kind === "accepted") {
                  local.accepted = [...(local.accepted || []), message.record];
                  sessionStorage.setItem("test-local", JSON.stringify(local));
                }
              }
              if (
                message.action === "sendFeedback" &&
                window.aleTest.feedbackFails
              )
                response = { success: false };
              if (message.action === "generate") {
                const answers = (message.payload?.questions ?? []).map(
                  (question, index) => {
                    const body = fixtureAnswers[index]!;
                    return {
                      questionId: `q${index + 1}`,
                      question,
                      body,
                      word_count: 50,
                      character_count: body.length,
                    };
                  },
                );
                response = {
                  success: true,
                  category: "yc_application",
                  body: answers[0]?.body,
                  answers,
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
    { authenticated, fixtureAnswers },
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
    (_, index) =>
      `PRIVATE QUESTION ${index + 1}: Describe your *technical* experience?`,
  );
  await page.fill("#ycQuestionInput", questions.join("\n"));
  await page.click("#generateBtn");
  await expect(page.locator(".application-answer")).toHaveCount(5);
  await expect(page.locator(".application-answer h3")).toHaveText(questions);
  await expect(page.locator(".application-answer p")).toHaveText(
    fixtureAnswers,
  );
  const copyAnswer = (index: number) =>
    page.getByRole("button", { name: `Copy answer ${index}`, exact: true });
  await copyAnswer(1).focus();
  for (let index = 2; index <= 5; index++) {
    await page.keyboard.press("Tab");
    const button = copyAnswer(index);
    await expect(button).toBeFocused();
    await expect(button).toHaveCSS("outline-style", "solid");
    await expect(button).toHaveCSS("outline-width", "2px");
  }
  for (const index of [1, 3, 5]) {
    await copyAnswer(index).click();
    await expect
      .poll(() => page.evaluate(() => window.aleTest.copied))
      .toBe(fixtureAnswers[index - 1]);
  }
  await page.click("#copyAllBtn");
  expect(await page.evaluate(() => window.aleTest.copied)).toBe(
    questions
      .map(
        (question, index) =>
          `**${question.replace("*technical*", "\\*technical\\*")}**\n${fixtureAnswers[index]}`,
      )
      .join("\n\n"),
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
  expect(JSON.stringify(reports)).not.toMatch(/PRIVATE|experience[1-5]/);
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
  const question = "PRIVATE QUESTION: Describe your experience?";
  await openPopup(page, false);
  await page.fill("#jdInput", jd);
  await page.fill("#ycQuestionInput", question);
  await page.click("#connectBtn");
  await expect(page.locator("#connectBtn")).toHaveCount(0);
  await expect(page.locator("#jdInput")).toHaveValue(jd);
  await expect(page.locator("#ycQuestionInput")).toHaveValue(question);
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
  await expect(page.locator(".application-answer h3")).toHaveText(question);
  await page
    .getByRole("button", { name: "Copy answer 1", exact: true })
    .click();
  expect(await page.evaluate(() => window.aleTest.copied)).toBe(
    fixtureAnswers[0],
  );
  await page.click("#rejectBtn");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("#rejectBtn")).toBeFocused();
});

test("clipboard failure keeps the answer available for a retry @smoke", async ({
  page,
}) => {
  await openPopup(page);
  await page.setViewportSize({ width: 340, height: 640 });
  await page.selectOption("#category", "yc_application");
  await page.fill("#jdInput", jd);
  await page.fill("#ycQuestionInput", "Describe your relevant experience?");
  await page.click("#generateBtn");
  const copy = page.getByRole("button", { name: "Copy answer 1", exact: true });
  await page.evaluate(() => {
    window.aleTest.clipboardFails = true;
  });
  await copy.click();
  await expect(copy).toHaveText("Copy failed");
  expect(await page.evaluate(() => window.aleTest.copied)).toBe("");
  await expect(page.locator(".application-answer p")).toHaveText(
    fixtureAnswers[0]!,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(copy).not.toHaveText("Copy failed");
  await page.evaluate(() => {
    window.aleTest.clipboardFails = false;
  });
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => window.aleTest.copied))
    .toBe(fixtureAnswers[0]);
});

for (const replaceDraft of [false, true]) {
  test(
    "manual sign-in retains the intended draft (new question: " +
      replaceDraft +
      ") @smoke",
    async ({ page }) => {
      await openPopup(page, false);
      const questions =
        "Describe your prototype work?\nHow did you run payroll?";
      await page.evaluate(
        ({ questions, jd }) => {
          sessionStorage.setItem(
            "test-session",
            JSON.stringify({
              applicationAuthDraft: {
                category: "yc_application",
                ownerId: "user-1",
                expiresAt: Date.now() + 30_000,
                questions,
                jd,
                skippedQuestions: [2],
              },
            }),
          );
        },
        { questions, jd },
      );
      const entered = "What did you recently build?";
      if (replaceDraft) await page.locator("#ycQuestionInput").fill(entered);
      await page.locator("#connectBtn").click();
      if (replaceDraft) {
        await expect(page.locator("#ycQuestionInput")).toHaveValue(entered);
        await expect(
          page.getByRole("button", { name: "Undo skip for Question 2" }),
        ).toHaveCount(0);
        return;
      }
      await expect(page.locator("#ycQuestionInput")).toHaveValue(questions);
      await expect(page.locator("#jdInput")).toHaveValue(jd);
      await expect(
        page.getByRole("button", { name: "Undo skip for Question 2" }),
      ).toBeVisible();
      await expect(page.locator("#generateBtn")).toHaveText(
        /1 supported answer/u,
      );
    },
  );
}

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

for (const { code, actionLabel, rationale } of [
  {
    code: "GROUNDING_PROFILE_INCOMPLETE",
    actionLabel: "Review application evidence",
  },
  { code: "INSUFFICIENT_GROUNDING", actionLabel: null },
  {
    code: "GROUNDING_PROFILE_INCOMPLETE",
    actionLabel: "Review application evidence",
    rationale: true,
  },
]) {
  test(`422 ${rationale ? "missing rationale" : code} preserves all five questions for recovery @smoke`, async ({
    page,
  }) => {
    const diagnostics = captureGenerationDiagnostics(page);
    await openPopup(page);
    await page.selectOption("#category", "yc_application");
    const questions = [
      "Describe your approach to planning a project.",
      rationale
        ? "What motivated your choice of method to measure the outcome?"
        : "How did you measure the outcome?",
      "What tradeoff did you make?",
      "How did you evaluate accessibility?",
      "What did you learn from the project?",
    ].join("\n");
    await page.fill("#jdInput", jd);
    await page.fill("#ycQuestionInput", questions);
    await page.evaluate(() => {
      window.aleTest.holdGeneration = true;
    });
    await page.click("#generateBtn");
    await expect(page.locator("#generationProgress")).toBeVisible();
    await page.evaluate(
      ({ errorCode, rationaleGap }) => {
        window.aleTest.generationCallback?.({
          success: false,
          status: 422,
          code: errorCode,
          ...(errorCode === "GROUNDING_PROFILE_INCOMPLETE"
            ? {
                missingFields: rationaleGap
                  ? ["confirmed_evidence"]
                  : ["current_role_or_resume", "confirmed_evidence"],
                recommendedFields: ["technical_project_evidence"],
                applicationProfileUrl: rationaleGap
                  ? "https://www.aletheia.live/dashboard#evidence"
                  : "https://www.aletheia.live/profile/application",
                ...(rationaleGap && {
                  evidenceGap: {
                    reason: "missing_rationale",
                    questionNumbers: [2],
                  },
                }),
              }
            : {
                error:
                  "No complete reviewed fact combination fits every answer.",
              }),
        });
      },
      { errorCode: code, rationaleGap: rationale },
    );
    await expect(page.locator("#errorMessage")).toBeFocused();
    const warning = page.locator("#ycQuestionGroup #errorMessage");
    await expect(warning).toContainText("More reviewed evidence needed");
    await expect(warning).not.toContainText(
      /confirmed_evidence|current_role_or_resume|technical_project_evidence|HTTP 422/u,
    );
    if (actionLabel) {
      await expect(page.locator("#errorAction")).toHaveText(actionLabel);
    } else {
      await expect(page.locator("#errorMessage")).toContainText(
        "Add or review facts that support your questions",
      );
      await expect(page.locator("#errorAction")).toBeHidden();
    }
    if (code === "GROUNDING_PROFILE_INCOMPLETE" && !rationale)
      await expect(warning).toContainText(
        "Add your current role or upload a resume in your application profile.",
      );
    if (rationale) {
      await expect(page.locator("#errorAction")).toHaveAttribute(
        "href",
        "https://www.aletheia.live/dashboard#evidence",
      );
      await expect(page.locator("#errorMessage")).toContainText(
        "Question 2 needs the reason behind the decision.",
      );
    }
    await expect(page.locator(".application-answer")).toHaveCount(0);
    await expect(page.locator("#jdInput")).toHaveValue(jd);
    await expect(page.locator("#ycQuestionInput")).toHaveValue(questions);
    await expect(page.locator("#generateBtn")).toBeEnabled();
    expect(diagnostics.errors).toEqual([]);
    expect(diagnostics.events).toContainEqual(
      expect.objectContaining({
        level: "info",
        errorCode: code,
        status: 422,
        outcome: "failure",
      }),
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const stored = JSON.parse(
            sessionStorage.getItem("test-session") || "{}",
          );
          return stored.aletheia_diagnostic_events_v1?.filter(
            (event: { event: string; status: number }) =>
              event.event === "generation.complete" && event.status === 422,
          );
        }),
      )
      .toEqual([expect.objectContaining({ level: "info", errorCode: code })]);
    await page.evaluate(() => {
      window.aleTest.holdGeneration = false;
    });
    await page.click("#generateBtn");
    await expect(page.locator(".application-answer h3")).toHaveText(
      questions.split("\n"),
    );
    await expect(page.locator("#errorMessage")).toBeHidden();
    const requests = await page.evaluate(() =>
      window.aleTest.messages.filter(({ action }) => action === "generate"),
    );
    expect(requests).toHaveLength(2);
    expect(requests[1]?.payload).toEqual(requests[0]?.payload);
  });
}

for (const { code, status, message, level } of [
  {
    code: "AUTH_ACCOUNT_CHANGED",
    status: 409,
    message:
      "The connected account changed. Reopen the extension and try again.",
    level: "info",
  },
  {
    code: "YC_TOOL_SCHEMA",
    status: 502,
    message: "We couldn't generate this draft. Please try again.",
    level: "warn",
  },
]) {
  test(`${code} keeps clear recovery guidance and ${level} diagnostics @smoke`, async ({
    page,
  }) => {
    const diagnostics = captureGenerationDiagnostics(page);
    await openPopup(page);
    await page.selectOption("#category", "yc_application");
    const questions = Array.from(
      { length: 5 },
      (_, i) => `Describe your work on project ${i + 1}?`,
    ).join("\n");
    await page.fill("#jdInput", jd);
    await page.fill("#ycQuestionInput", questions);
    await page.evaluate(
      ({ code, status, message }) => {
        window.aleTest.holdGeneration = true;
        window.aleTest.generationResponse = {
          success: false,
          code,
          status,
          message,
        };
      },
      { code, status, message },
    );
    await page.click("#generateBtn");
    await page.evaluate(
      ({ code, status, message }) => {
        window.aleTest.generationCallback?.({
          success: false,
          code,
          status,
          message,
        });
      },
      { code, status, message },
    );
    await expect(page.locator("#errorMessage")).toContainText(message);
    await expect(page.locator("#errorMessage")).not.toContainText(code);
    await expect(page.locator("#ycQuestionInput")).toHaveValue(questions);
    await expect(page.locator("#jdInput")).toHaveValue(jd);
    await expect(page.locator(".application-answer")).toHaveCount(0);
    expect(diagnostics.events).toContainEqual(
      expect.objectContaining({ level, errorCode: code, status }),
    );
    expect(diagnostics.errors).toHaveLength(level === "warn" ? 1 : 0);
  });
}

test("the compact application panel focuses question 4 recovery after a previous draft @smoke", async ({
  page,
}) => {
  await openPopup(page);
  await page.setViewportSize({ width: 320, height: 550 });
  await page.selectOption("#category", "yc_application");
  const questions = acceptanceFixture.cases.map(({ question }) => question);
  await page.fill("#jdInput", acceptanceFixture.jobDescription);
  await page.fill("#ycQuestionInput", questions.join("\n"));
  await page.click("#generateBtn");
  await expect(page.locator(".application-answer h3")).toHaveText(questions);
  await page.evaluate(() => {
    window.aleTest.holdGeneration = true;
  });
  await page.click("#regenerateApplicationBtn");
  await expect(page.locator("#generationProgress")).toBeVisible();
  await page.evaluate(() => {
    window.aleTest.generationCallback?.({
      success: false,
      status: 422,
      code: "GROUNDING_PROFILE_INCOMPLETE",
      missingFields: ["confirmed_evidence"],
      applicationProfileUrl: "https://www.aletheia.live/profile/application",
      evidenceGap: { reason: "missing_reviewed_facts", questionNumbers: [4] },
    });
    window.aleTest.holdGeneration = false;
  });

  const alert = page.locator("#errorMessage");
  await expect(alert).toBeFocused();
  await expect(alert).toBeInViewport({ ratio: 0.75 });
  await expect(alert).toContainText("More reviewed evidence needed");
  await expect(alert).not.toContainText("confirmed_evidence");
  await expect(alert).toContainText(
    "Question 4 needs a matching reviewed fact",
  );
  await expect(alert).toContainText(questions[3]!);
  await expect(alert).toContainText("an action, method, or result");
  await expect(page.locator("#ycQuestionGroup #errorMessage")).toBeVisible();
  await expect(page.locator("#ycQuestionInput")).toHaveAccessibleDescription(
    /Question 4 needs/u,
  );
  await expect(page.locator("#errorAction")).toHaveText(
    "Review application evidence",
  );
  await page.keyboard.press("Tab");
  await expect(page.locator("#errorAction")).toBeFocused();
  await expect(page.locator(".application-answer h3")).toHaveText(questions);
  await expect(page.locator("#jdInput")).toHaveValue(
    acceptanceFixture.jobDescription,
  );
  await expect(page.locator("#ycQuestionInput")).toHaveValue(
    questions.join("\n"),
  );

  await page.fill("#ycQuestionInput", questions.slice(0, 2).join("\n"));
  await expect(alert).toBeHidden();
  await expect(
    page.locator("#ycQuestionInput"),
  ).not.toHaveAccessibleDescription(/Question 4/u);
  await page.fill("#ycQuestionInput", questions.join("\n"));
  await page.click("#generateBtn");
  await expect(page.locator(".application-answer h3")).toHaveText(questions);
  await expect(alert).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.aleTest.messages.filter(({ action }) => action === "generate")
            .length,
      ),
    )
    .toBe(3);
});

test("skip question four, submit four, and keep the unanswered slot in order @smoke", async ({
  page,
}) => {
  await openPopup(page);
  await page.selectOption("#category", "yc_application");
  const questions = acceptanceFixture.cases.map(({ question }) => question);
  await page.fill("#jdInput", acceptanceFixture.jobDescription);
  await page.fill("#ycQuestionInput", questions.join("\n"));
  await page.evaluate(() => {
    window.aleTest.holdGeneration = true;
  });
  await page.click("#generateBtn");
  await expect(page.locator("#generationProgress")).toBeVisible();
  await page.evaluate(() => {
    window.aleTest.generationCallback?.({
      success: false,
      status: 422,
      code: "GROUNDING_PROFILE_INCOMPLETE",
      billing: "none",
      missingFields: ["confirmed_evidence"],
      evidenceGap: { reason: "missing_reviewed_facts", questionNumbers: [4] },
      applicationProfileUrl: "https://www.aletheia.live/dashboard#evidence",
    });
    window.aleTest.holdGeneration = false;
  });

  const skip = page.getByRole("button", { name: "Skip Question 4" });
  const warning = page.locator("#ycQuestionGroup #errorMessage");
  await expect(warning).toContainText("More reviewed evidence needed");
  await expect(warning).not.toContainText("confirmed_evidence");
  await expect(
    warning.getByRole("link", { name: "Review application evidence" }),
  ).toBeVisible();
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", {
      name: /Generate 4 supported answers.*4 credits/u,
    }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Undo skip for Question 4" }).click();
  await expect(page.locator("#generateBtn")).toHaveText(/Generate Answers/u);
  await page.getByRole("button", { name: "Skip Question 4" }).click();
  await page.click("#generateBtn");

  const answers = page.locator(".application-answer");
  await expect(answers.locator("h3")).toHaveText(questions);
  await expect(answers.nth(3)).toContainText("Unanswered");
  await expect(answers.nth(3).getByRole("button")).toHaveCount(0);
  await answers.nth(4).getByRole("button", { name: "Copy answer 5" }).click();
  expect(await page.evaluate(() => window.aleTest.copied)).toBe(
    fixtureAnswers[3],
  );
  await page.click("#copyAllBtn");
  const copied = await page.evaluate(() => window.aleTest.copied);
  expect(copied).not.toContain(questions[3]);
  expect(copied).not.toContain("Unanswered");
  expect(copied).toContain(fixtureAnswers[3]);
  const requests = await page.evaluate(() =>
    window.aleTest.messages.filter(({ action }) => action === "generate"),
  );
  expect(requests).toHaveLength(2);
  expect(requests[1]?.payload?.questions).toEqual(
    questions.filter((_, index) => index !== 3),
  );
  await expect(page.locator("#ycQuestionInput")).toHaveValue(
    questions.join("\n"),
  );
  const local = await page.evaluate(() => sessionStorage.getItem("test-local"));
  expect(local).not.toContain(questions[3]);
});

test("maps a later gap to the original slot and skips multiple questions @smoke", async ({
  page,
}) => {
  await openPopup(page);
  await page.selectOption("#category", "yc_application");
  const questions = acceptanceFixture.cases.map(({ question }) => question);
  await page.fill("#jdInput", jd);
  await page.fill("#ycQuestionInput", questions.join("\n"));
  const rejectQuestions = async (numbers: number[]) => {
    await page.evaluate(() => {
      window.aleTest.holdGeneration = true;
    });
    await page.click("#generateBtn");
    await expect(page.locator("#generationProgress")).toBeVisible();
    await page.evaluate((questionNumbers) => {
      window.aleTest.generationCallback?.({
        success: false,
        status: 422,
        code: "GROUNDING_PROFILE_INCOMPLETE",
        billing: "none",
        evidenceGap: { reason: "missing_reviewed_facts", questionNumbers },
      });
      window.aleTest.holdGeneration = false;
    }, numbers);
  };
  await rejectQuestions([2, 4]);
  await expect(
    page.getByRole("button", { name: "Skip Question 4" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip Question 2" }).click();
  await rejectQuestions([3]);
  await expect(page.getByRole("alert")).toContainText("Question 4 needs");
  await expect(
    page.getByRole("button", { name: "Skip Question 3" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Skip Question 4" }).click();
  await expect(page.locator("#applicationSkipStatus")).toHaveText(
    /3 of 5 questions included/u,
  );
  await page.click("#generateBtn");
  await expect(page.locator(".application-answer h3")).toHaveText(questions);
  await expect(page.getByText("Unanswered", { exact: true })).toHaveCount(2);
  const payloads = await page.evaluate(() =>
    window.aleTest.messages.filter(({ action }) => action === "generate"),
  );
  expect(payloads.map(({ payload }) => payload?.questions)).toEqual([
    questions,
    [questions[0], questions[2], questions[3], questions[4]],
    [questions[0], questions[2], questions[4]],
  ]);
});

test("sends no empty subset and discards a diagnostic for edited questions @smoke", async ({
  page,
}) => {
  await openPopup(page);
  await page.selectOption("#category", "yc_application");
  await page.fill("#jdInput", jd);
  const input = page.locator("#ycQuestionInput");
  const request = page.locator("#generateBtn");
  await input.fill("How did you lead the production migration?");
  const prepareFailure = async () => {
    await page.evaluate(() => {
      window.aleTest.holdGeneration = true;
    });
    await request.click();
    await expect(page.locator("#generationProgress")).toBeVisible();
  };
  const failure = () =>
    page.evaluate(() => {
      window.aleTest.generationCallback?.({
        success: false,
        status: 422,
        code: "GROUNDING_PROFILE_INCOMPLETE",
        billing: "none",
        evidenceGap: { reason: "missing_reviewed_facts", questionNumbers: [1] },
        applicationProfileUrl: "https://www.aletheia.live/dashboard#evidence",
      });
    });
  await prepareFailure();
  await failure();
  await page.getByRole("button", { name: "Skip Question 1" }).click();
  await expect(request).toBeDisabled();
  await expect(request).toHaveText("No questions included");
  await expect(
    page.getByRole("link", { name: "Review application evidence" }),
  ).toBeVisible();
  await expect(input).toBeEnabled();
  await request.evaluate((button) => (button as HTMLButtonElement).click());
  expect(
    await page.evaluate(() =>
      window.aleTest.messages.filter(({ action }) => action === "generate"),
    ),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Undo skip for Question 1" }).click();
  await prepareFailure();
  await input.evaluate((field) => {
    (field as HTMLTextAreaElement).value =
      "Describe your unrelated infrastructure project.";
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await failure();
  await expect(request).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Skip Question 1" }),
  ).toHaveCount(0);
  await expect(page.locator("#errorMessage")).toBeHidden();
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
  await expect(page.locator("#generateBtn")).toBeDisabled();
  await page.locator("#generateBtn").evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  expect(
    await page.evaluate(
      () =>
        window.aleTest.messages.filter(({ action }) => action === "generate")
          .length,
    ),
  ).toBe(1);
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

test("generation response is discarded if the connected account changes @smoke", async ({
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
  await page.evaluate(() => {
    const local = JSON.parse(sessionStorage.getItem("test-local") || "{}");
    local.aletheia_auth.user.id = "user-b";
    sessionStorage.setItem("test-local", JSON.stringify(local));
    window.aleTest.generationCallback?.(window.aleTest.generationResponse);
  });
  await expect(page.locator("#generationProgress")).toBeHidden();
  await expect(page.locator(".application-answer")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("test-local") || "{}").lastGeneration,
    ),
  ).toBeUndefined();
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
  await expect(
    page.locator("#mainContent > #errorMessage #errorText"),
  ).toHaveText("Please try again.");
  await expect(page.getByText("More reviewed evidence needed")).toBeHidden();
  await expect(page.locator("#generateBtn")).toBeEnabled();
  await expect(page.locator("#generateBtn")).toHaveAttribute(
    "aria-busy",
    "false",
  );
});
