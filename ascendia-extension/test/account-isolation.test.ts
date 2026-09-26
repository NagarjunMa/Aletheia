import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  filterOwnedAccepted,
  getOwnedUsage,
  isMatchingAccountToken,
  isOwnedRecord,
} from "../lib/account-owned-cache.js";
import { buildGenerationRequestData } from "../background/generation-core.js";

const popupSource = readFileSync(
  new URL("../popup/popup.js", import.meta.url),
  "utf8",
);
const workerSource = readFileSync(
  new URL("../background/service-worker.js", import.meta.url),
  "utf8",
);
function section(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  return source.slice(
    startIndex,
    source.indexOf(end, startIndex + start.length),
  );
}

describe("extension account isolation", () => {
  it("does not restore signed-out usage or overwrite the next account's usage", async () => {
    const usageSource = section(
      workerSource,
      "async function logUsage(category, ownerId",
      "\n// Error handling for unhandled promise rejections",
    );
    let logoutEpoch = 0;
    let usageMutation = Promise.resolve();
    const values: Record<string, unknown> = {
      aletheia_auth: { user: { id: "user-a" } },
    };
    const sandbox = {
      chrome: {
        storage: {
          local: {
            get: async () => ({ ...values }),
            set: async (next: Record<string, unknown>) => {
              Object.assign(values, next);
            },
          },
        },
      },
      getOwnedUsage,
      log: { warn: vi.fn() },
      getSafeErrorCode: () => "USAGE_RECORD_FAILED",
      Date,
      get usageEpoch() {
        return logoutEpoch;
      },
      get usageMutation() {
        return usageMutation;
      },
      set usageMutation(next: Promise<void>) {
        usageMutation = next;
      },
    };
    logoutEpoch++;
    values.aletheia_auth = null;
    await runInNewContext(
      `(${usageSource})("cold_email", "user-a", 0)`,
      sandbox,
    );
    expect(values.dailyUsage).toBeUndefined();

    values.aletheia_auth = { user: { id: "user-b" } };
    await runInNewContext(
      `(${usageSource})("cold_email", "user-b", 1)`,
      sandbox,
    );
    await runInNewContext(
      `(${usageSource})("cold_email", "user-a", 0)`,
      sandbox,
    );
    expect(values.usageOwnerId).toBe("user-b");
    expect(Object.values(values.dailyUsage as Record<string, number>)).toEqual([
      1,
    ]);
  });

  it("waits for a pending usage write before deleting usage on logout", async () => {
    const usageSource = section(
      workerSource,
      "async function logUsage(category, ownerId",
      "\n// Error handling for unhandled promise rejections",
    );
    const logoutSource = section(
      workerSource,
      "async function handleLogout(operationId)",
      "\nasync function saveAccountRecord(",
    );
    let releaseWrite: (() => void) | undefined;
    let writeStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      writeStarted = resolve;
    });
    const pendingWrite = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const values: Record<string, unknown> = {
      aletheia_auth: { user: { id: "user-a" } },
    };
    const sandbox = {
      usageEpoch: 0,
      usageMutation: Promise.resolve(),
      personalStorageMutation: Promise.resolve(),
      logoutInProgress: false,
      getOwnedUsage,
      log: { warn: vi.fn() },
      getSafeErrorCode: () => "USAGE_RECORD_FAILED",
      Date,
      startExtensionTimedStage: () => vi.fn(),
      clearAuth: async () => {
        values.aletheia_auth = null;
      },
      chrome: {
        storage: {
          local: {
            get: async () => ({ ...values }),
            set: async (next: Record<string, unknown>) => {
              writeStarted?.();
              await pendingWrite;
              Object.assign(values, next);
            },
            remove: async (keys: string[]) => {
              for (const key of keys) delete values[key];
            },
          },
          session: { remove: vi.fn() },
        },
        alarms: { clear: vi.fn() },
      },
    };
    const generation = runInNewContext(
      `(${usageSource})("cold_email", "user-a", 0)`,
      sandbox,
    );
    await started;
    const logout = runInNewContext(`(${logoutSource})("op")`, sandbox);
    releaseWrite?.();
    await Promise.all([generation, logout]);
    expect(values.dailyUsage).toBeUndefined();
    expect(values.usageOwnerId).toBeUndefined();
  });

  it("drains an approved draft write before logout and rejects late saves", async () => {
    const save = section(
      workerSource,
      "async function saveAccountRecord(kind, requesterId, record)",
      "\nasync function handleFeedbackRequest(",
    );
    const logout = section(
      workerSource,
      "async function handleLogout(operationId)",
      "\nasync function saveAccountRecord(",
    );
    let releaseWrite: (() => void) | undefined;
    let signalWrite: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => {
      signalWrite = resolve;
    });
    const waitForWrite = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const values: Record<string, unknown> = {
      aletheia_auth: { user: { id: "user-a" } },
      accepted: [],
    };
    const record = { ownerId: "user-a", body: "private accepted draft" };
    const sandbox = {
      record,
      usageEpoch: 0,
      usageMutation: Promise.resolve(),
      personalStorageMutation: Promise.resolve(),
      logoutInProgress: false,
      isOwnedRecord,
      startExtensionTimedStage: () => vi.fn(),
      log: {},
      getSafeErrorCode: () => "LOGOUT_FAILED",
      clearAuth: async () => {
        values.aletheia_auth = null;
      },
      chrome: {
        storage: {
          local: {
            get: async () => ({ ...values }),
            set: async (next: Record<string, unknown>) => {
              signalWrite?.();
              await waitForWrite;
              Object.assign(values, next);
            },
            remove: async (keys: string[]) => {
              for (const key of keys) delete values[key];
            },
          },
          session: { remove: vi.fn() },
        },
        alarms: { clear: vi.fn() },
      },
    };
    const pendingSave = runInNewContext(
      `(${save})("accepted", "user-a", record)`,
      sandbox,
    );
    await writeStarted;
    const pendingLogout = runInNewContext(`(${logout})("op")`, sandbox);
    releaseWrite?.();
    await Promise.all([pendingSave, pendingLogout]);
    expect(values.accepted).toBeUndefined();
    await expect(
      runInNewContext(`(${save})("accepted", "user-a", record)`, {
        ...sandbox,
        record,
        logoutInProgress: true,
      }),
    ).rejects.toThrow(/account changed/);
  });
  it("stores accepted outreach messages only for the signed-in account", async () => {
    const sendBackgroundMessage = vi.fn().mockResolvedValue({ success: true });
    const save = section(
      popupSource,
      "async function saveAcceptedMessage()",
      "\nfunction updateUIForCategory()",
    );
    await runInNewContext(`(${save})()`, {
      currentUserId: "user-b",
      currentOutput: { category: "cold_email", body: "account B draft" },
      currentProfile: { name: "Contact" },
      YC_APPLICATION_CATEGORY: "yc_application",
      isOwnedRecord,
      sendBackgroundMessage,
      document: { getElementById: () => ({ value: "networking" }) },
      Date,
      chrome: {
        storage: {
          local: {
            get: async () => ({
              accepted: [
                { category: "cold_email", body: "legacy" },
                {
                  ownerId: "user-a",
                  category: "cold_email",
                  body: "account A draft",
                },
              ],
            }),
          },
        },
      },
    });
    expect(sendBackgroundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "saveAccountRecord",
        kind: "accepted",
        requesterId: "user-b",
        record: expect.objectContaining({
          ownerId: "user-b",
          body: "account B draft",
        }),
      }),
    );
  });

  it("stores outreach drafts with an owner and rejects an old account's last draft", async () => {
    const sendBackgroundMessage = vi.fn().mockResolvedValue({ success: true });
    const remove = vi.fn();
    const store = section(
      popupSource,
      "async function storeGeneration(output)",
      "\nasync function restoreLastGeneration()",
    );
    const restore = section(
      popupSource,
      "async function restoreLastGeneration()",
      "\nfunction ",
    );
    const sandbox = {
      currentUserId: "user-b",
      currentProfile: { name: "private profile" },
      document: {
        getElementById: (id: string) => ({
          value: id === "category" ? "cold_email" : "private context",
        }),
      },
      chrome: {
        storage: {
          local: {
            remove,
            get: vi.fn().mockResolvedValue({
              lastGeneration: {
                ownerId: "user-a",
                timestamp: Date.now(),
                output: { category: "cold_email", body: "private draft" },
                inputs: { category: "cold_email" },
              },
            }),
          },
        },
      },
      YC_APPLICATION_CATEGORY: "yc_application",
      isOwnedRecord,
      sendBackgroundMessage,
      Date,
      console: { error: vi.fn() },
    };
    await runInNewContext(
      `(${store})({ category: "cold_email", body: "new draft" })`,
      sandbox,
    );
    expect(sendBackgroundMessage.mock.calls[0][0].record.ownerId).toBe(
      "user-b",
    );
    await runInNewContext(`(${restore})()`, sandbox);
    expect(remove).toHaveBeenCalledWith("lastGeneration");
  });

  it("sends only the active account's accepted examples from the worker", async () => {
    const makeAPIRequest = vi.fn().mockResolvedValue({ success: true });
    const generate = section(
      workerSource,
      "async function handleGenerateRequest(payload, operationId, requesterId)",
      "\nasync function makeAPIRequest(",
    );
    const sandbox = {
      usageEpoch: 0,
      startExtensionTimedStage: () => vi.fn(),
      log: {},
      getEffectiveApiUrl: async () => "https://example.test",
      chrome: {
        storage: {
          local: {
            get: vi.fn(async () => ({
              aletheia_auth: {
                access_token: "token-b",
                user: { id: "user-b" },
              },
              accepted: [
                { category: "cold_email", body: "legacy" },
                {
                  ownerId: "user-a",
                  category: "cold_email",
                  body: "account A",
                },
                {
                  ownerId: "user-b",
                  category: "cold_email",
                  body: "account B",
                },
              ],
            })),
          },
        },
      },
      generateWithAuthRecovery: async ({
        generate,
      }: {
        generate: (token: string) => Promise<unknown>;
      }) => generate("token-b"),
      getValidAccessToken: async () => "token-b",
      clearAuthAndFetchFresh: vi.fn(),
      clearAuth: vi.fn(),
      handleAuthenticate: vi.fn(),
      filterOwnedAccepted,
      isMatchingAccountToken,
      buildGenerationRequestData,
      checkUsageLimit: vi.fn(),
      makeAPIRequest,
      logUsage: vi.fn(),
      getSafeErrorCode: () => "AUTH_ACCOUNT_CHANGED",
    };
    await runInNewContext(
      `(${generate})({ category: "cold_email" }, "op", "user-b")`,
      sandbox,
    );
    expect(
      JSON.parse(makeAPIRequest.mock.calls[0][1].body).acceptedExamples,
    ).toEqual(["account B"]);
    makeAPIRequest.mockClear();
    await expect(
      runInNewContext(
        `(${generate})({ category: "cold_email" }, "op", "user-a")`,
        sandbox,
      ),
    ).rejects.toThrow(/account changed/);
    expect(makeAPIRequest).not.toHaveBeenCalled();
  });

  it("removes personal caches on explicit logout", async () => {
    const remove = vi.fn();
    const logout = section(
      workerSource,
      "async function handleLogout(operationId)",
      "\nasync function saveAccountRecord(",
    );
    await runInNewContext(`(${logout})("op")`, {
      usageEpoch: 0,
      usageMutation: Promise.resolve(),
      personalStorageMutation: Promise.resolve(),
      logoutInProgress: false,
      startExtensionTimedStage: () => vi.fn(),
      log: {},
      clearAuth: vi.fn(),
      chrome: {
        storage: {
          local: { remove },
          session: { remove: vi.fn() },
        },
        alarms: { clear: vi.fn() },
      },
    });
    expect(remove).toHaveBeenCalledWith([
      "accepted",
      "lastGeneration",
      "dailyUsage",
      "categoryUsage",
      "usageOwnerId",
    ]);
  });

  it("rejects feedback after account A changes to account B", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    const feedback = section(
      workerSource,
      "async function handleFeedbackRequest(payload, requesterId, operationId)",
      "\nasync function handleGenerateRequest(",
    );
    const sandbox = {
      getEffectiveApiUrl: async () => "https://example.test",
      getValidAccessToken: async () => "token-b",
      chrome: {
        storage: {
          local: {
            get: async () => ({
              aletheia_auth: {
                access_token: "token-b",
                user: { id: "user-b" },
              },
            }),
          },
        },
      },
      isMatchingAccountToken,
      fetch,
      getAletheiaRequestHeaders: (headers: unknown) => headers,
      AbortSignal,
      JSON,
    };
    await expect(
      runInNewContext(
        `(${feedback})({ message: "A private draft" }, "user-a", "op")`,
        sandbox,
      ),
    ).rejects.toThrow(/account changed/);
    expect(fetch).not.toHaveBeenCalled();
    await runInNewContext(
      `(${feedback})({ message: "B draft" }, "user-b", "op")`,
      sandbox,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps an in-flight draft through transient token refresh but reloads on account switch", async () => {
    const start = popupSource.indexOf(
      "async (changes, area) => {",
      popupSource.indexOf("chrome.storage.onChanged.addListener"),
    );
    const end = popupSource.indexOf("\n  });\n});", start);
    const callback = `${popupSource.slice(start, end)}\n}`;
    const reload = vi.fn();
    const hide = vi.fn();
    const show = vi.fn();
    let storedAuth: { user: { id: string } } | null = null;
    const sandbox = {
      PROFILE_EXTRACTION_CONSENT_KEY: "profileExtractionConsent",
      generationInFlight: true,
      generationRequesterId: "user-a",
      currentUserId: "user-a",
      currentOutput: { body: "private draft" },
      feedbackOutput: null,
      currentProfile: { name: "Person" },
      popupAuthenticated: true,
      document: {
        getElementById: () => ({ classList: { add: hide, remove: show } }),
      },
      window: { location: { reload } },
      chrome: {
        storage: {
          local: { get: async () => ({ aletheia_auth: storedAuth }) },
        },
      },
    };
    await runInNewContext(
      `(${callback})({ aletheia_auth: { oldValue: { user: { id: "user-a" } }, newValue: null } }, "local")`,
      sandbox,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(sandbox.currentOutput).toEqual({ body: "private draft" });
    expect(hide).toHaveBeenCalledWith("hidden");
    storedAuth = { user: { id: "user-a" } };
    await runInNewContext(
      `(${callback})({ aletheia_auth: { oldValue: null, newValue: { user: { id: "user-a" } } } }, "local")`,
      sandbox,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(sandbox.popupAuthenticated).toBe(true);
    expect(show).toHaveBeenCalledWith("hidden");
    sandbox.generationInFlight = false;
    sandbox.currentOutput = { body: "successful paid draft" };
    await runInNewContext(
      `(${callback})({ aletheia_auth: { oldValue: { user: { id: "user-a" } }, newValue: null } }, "local")`,
      sandbox,
    );
    expect(sandbox.currentOutput).toEqual({ body: "successful paid draft" });
    expect(reload).not.toHaveBeenCalled();
    storedAuth = null;
    await runInNewContext(
      `(${callback})({ aletheia_auth: { oldValue: { user: { id: "user-a" } }, newValue: null } }, "local")`,
      sandbox,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(sandbox.currentProfile).toEqual({ name: "Person" });
    storedAuth = { user: { id: "user-a" } };
    await runInNewContext(
      `(${callback})({ aletheia_auth: { oldValue: null, newValue: { user: { id: "user-a" } } } }, "local")`,
      sandbox,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(sandbox.currentProfile).toEqual({ name: "Person" });
    expect(sandbox.currentOutput).toEqual({ body: "successful paid draft" });
    storedAuth = { user: { id: "user-b" } };
    await runInNewContext(
      `(${callback})({ aletheia_auth: { oldValue: { user: { id: "user-a" } }, newValue: { user: { id: "user-b" } } } }, "local")`,
      sandbox,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sandbox.currentUserId).toBeNull();
  });

  it("does not export another account's accepted drafts or usage", async () => {
    const exportSource = section(
      readFileSync(new URL("../settings/settings.js", import.meta.url), "utf8"),
      "async function exportUsageData()",
      "\nasync function saveAllSettings()",
    );
    let exportedBlob: Blob | undefined;
    const sandbox = {
      showLoadingOverlay: vi.fn(),
      hideLoadingOverlay: vi.fn(),
      showStatusMessage: vi.fn(),
      chrome: {
        storage: {
          local: {
            get: async () => ({
              aletheia_auth: { user: { id: "user-b" } },
              usageOwnerId: "user-a",
              dailyUsage: { "2026-09-26": 50 },
              categoryUsage: { "2026-09-26": { cold_email: 50 } },
              accepted: [
                { body: "legacy" },
                { ownerId: "user-a", body: "A private draft" },
                { ownerId: "user-b", body: "B draft" },
              ],
            }),
          },
        },
        runtime: { getManifest: () => ({ version: "1.0.19" }) },
      },
      currentSettings: { maxDailyUsage: 50 },
      profileExtractionConsent: true,
      Blob,
      URL: {
        createObjectURL: (blob: Blob) => {
          exportedBlob = blob;
          return "blob:test";
        },
        revokeObjectURL: vi.fn(),
      },
      document: {
        createElement: () => ({ click: vi.fn() }),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
      },
      Date,
      JSON,
    };
    await runInNewContext(`(${exportSource})()`, sandbox);
    expect(exportedBlob).toBeDefined();
    const exported = JSON.parse(await exportedBlob!.text());
    expect(exported.acceptedMessages).toEqual([
      { ownerId: "user-b", body: "B draft" },
    ]);
    expect(exported.dailyUsage).toEqual({});
  });

  it("does not block a new account on the prior account's local usage limit", async () => {
    const checkLimit = section(
      workerSource,
      "async function checkUsageLimit(ownerId)",
      "\nasync function logUsage(",
    );
    const today = new Date().toISOString().split("T")[0];
    const sandbox = {
      chrome: {
        storage: {
          local: {
            get: async () => ({
              usageOwnerId: "user-a",
              dailyUsage: { [today]: 50 },
              settings: { maxDailyUsage: 50 },
            }),
          },
        },
      },
      getOwnedUsage,
      Date,
    };
    await expect(
      runInNewContext(`(${checkLimit})("user-b")`, sandbox),
    ).resolves.toBeUndefined();
    await expect(
      runInNewContext(`(${checkLimit})("user-a")`, sandbox),
    ).rejects.toThrow(/Daily usage limit/);
  });
});
