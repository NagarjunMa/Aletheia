import { vi } from "vitest";

// ─── In-memory chrome.storage mock ───

export function createStorageMock() {
  const store: Record<string, unknown> = {};

  const mock = {
    get: vi.fn(
      (keys: unknown, cb?: (result: Record<string, unknown>) => void) => {
        let result: Record<string, unknown> = {};
        if (typeof keys === "string") {
          result = { [keys]: store[keys] };
        } else if (Array.isArray(keys)) {
          keys.forEach((k: string) => {
            if (k in store) result[k] = store[k];
          });
        } else if (keys === null || keys === undefined) {
          result = { ...store };
        }
        if (cb) cb(result);
        return Promise.resolve(result);
      },
    ),

    set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(store, items);
      if (cb) cb();
      return Promise.resolve();
    }),

    remove: vi.fn((keys: string | string[], cb?: () => void) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach((k) => delete store[k]);
      if (cb) cb();
      return Promise.resolve();
    }),

    clear: vi.fn((cb?: () => void) => {
      Object.keys(store).forEach((k) => delete store[k]);
      if (cb) cb();
      return Promise.resolve();
    }),

    // Test-only: direct access for assertions
    _store: store,
  };

  return mock;
}

// ─── chrome.runtime mock ───

export function createRuntimeMock() {
  return {
    id: "test-extension-id",
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  };
}

// ─── chrome.alarms mock ───

export function createAlarmsMock() {
  return {
    create: vi.fn(),
    clear: vi.fn(),
    get: vi.fn((_name: string, cb?: (alarm: unknown) => void) => {
      if (cb) cb(null);
      return Promise.resolve(null);
    }),
    getAll: vi.fn((cb?: (alarms: unknown[]) => void) => {
      if (cb) cb([]);
      return Promise.resolve([]);
    }),
    onAlarm: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  };
}

// ─── chrome.tabs mock ───

export function createTabsMock() {
  return {
    query: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onActivated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  };
}

// ─── chrome.cookies mock ───

export function createCookiesMock() {
  return {
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(null),
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  };
}

// ─── chrome.scripting mock ───

export function createScriptingMock() {
  return {
    executeScript: vi.fn().mockResolvedValue([]),
    insertCSS: vi.fn().mockResolvedValue(undefined),
    removeCSS: vi.fn().mockResolvedValue(undefined),
    registerContentScripts: vi.fn().mockResolvedValue(undefined),
    unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
    getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
  };
}

// ─── Wire message passing (for integration tests) ───

export function wireMessagePassing() {
  type MessageListener = (
    msg: unknown,
    sender: unknown,
    sendResponse: (response: unknown) => void,
  ) => boolean | void;

  const listeners: MessageListener[] = [];

  (globalThis as any).chrome.runtime.onMessage.addListener.mockImplementation(
    (listener: MessageListener) => {
      listeners.push(listener);
    },
  );

  (globalThis as any).chrome.runtime.sendMessage.mockImplementation(
    (message: unknown, callback?: (response: unknown) => void) => {
      for (const listener of listeners) {
        const sendResponse = (response: unknown) => callback?.(response);
        const willRespond = listener(
          message,
          { id: (globalThis as any).chrome.runtime.id },
          sendResponse,
        );
        if (willRespond) return;
      }
    },
  );

  return { listeners };
}
