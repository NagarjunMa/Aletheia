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
});
