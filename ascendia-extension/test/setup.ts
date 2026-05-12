import { vi } from "vitest";
import {
  createStorageMock,
  createRuntimeMock,
  createAlarmsMock,
  createTabsMock,
  createCookiesMock,
  createScriptingMock,
} from "./chrome-mocks";

// ─── Global chrome.* API mocks (MV3 complete) ───

(globalThis as any).chrome = {
  storage: {
    local: createStorageMock(),
    sync: createStorageMock(),
    session: createStorageMock(),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: createRuntimeMock(),
  alarms: createAlarmsMock(),
  tabs: createTabsMock(),
  cookies: createCookiesMock(),
  scripting: createScriptingMock(),
  action: {
    onClicked: { addListener: vi.fn() },
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    setIcon: vi.fn(),
    openPopup: vi.fn(),
  },
  sidePanel: {
    open: vi.fn(),
    setOptions: vi.fn(),
    setPanelBehavior: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn((cb?: () => void) => cb?.()),
    onClicked: { addListener: vi.fn() },
  },
};

// ─── Global fetch mock ───

(globalThis as any).fetch = vi.fn();
