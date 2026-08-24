import { readFileSync } from "node:fs";
import path from "node:path";

import { build } from "esbuild";
import { describe, expect, it } from "vitest";

const EXTENSION_ROOT = path.resolve(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(path.join(EXTENSION_ROOT, relativePath), "utf8");
}

describe("background service worker startup contract", () => {
  it("loads auth through a static module import", () => {
    const manifest = JSON.parse(read("manifest.json")) as {
      background?: { service_worker?: string; type?: string };
    };
    const serviceWorker = read("background/service-worker.js");
    const authModule = read("background/auth.js");

    expect(manifest.background).toEqual({
      service_worker: "background/service-worker.js",
      type: "module",
    });
    expect(serviceWorker).toMatch(/from ["']\.\/auth\.js["']/);
    expect(serviceWorker).not.toContain("importScripts(");

    for (const exportedFunction of [
      "clearAuth",
      "fetchSessionFromWebApp",
      "getAuthStatus",
      "getValidAccessToken",
      "storeAuth",
      "waitForLogin",
    ]) {
      expect(authModule).toMatch(
        new RegExp(`export (?:async )?function ${exportedFunction}\\b`),
      );
    }
  });

  it("does not request or use the nonfunctional context-menu surface", () => {
    const manifest = JSON.parse(read("manifest.json")) as {
      permissions?: string[];
    };
    const serviceWorker = read("background/service-worker.js");

    expect(manifest.permissions).not.toContain("contextMenus");
    expect(serviceWorker).not.toContain("chrome.contextMenus");
    expect(serviceWorker).not.toContain("chrome.action.openPopup");
  });

  it("bundles into a self-contained worker without runtime imports", async () => {
    const result = await build({
      entryPoints: [path.join(EXTENSION_ROOT, "background/service-worker.js")],
      bundle: true,
      write: false,
      format: "iife",
      target: "chrome120",
      logLevel: "silent",
    });

    const bundledWorker = result.outputFiles[0].text;
    expect(bundledWorker).toContain("onMessage.addListener");
    expect(bundledWorker).toContain("getAuthStatus");
    expect(bundledWorker).not.toContain("importScripts(");
    expect(bundledWorker).not.toContain('from "./auth.js"');
  });

  it("preserves structured generation errors for actionable popup recovery", () => {
    const serviceWorker = read("background/service-worker.js");
    const generationCore = read("background/generation-core.js");

    expect(serviceWorker).toContain("serializeGenerationError(error)");
    expect(serviceWorker).toMatch(/from ["']\.\/generation-core\.js["']/);
    expect(generationCore).toContain("applicationProfileUrl");
    expect(generationCore).toContain("missingFields");
    expect(generationCore).toContain("recommendedFields");
  });
});
