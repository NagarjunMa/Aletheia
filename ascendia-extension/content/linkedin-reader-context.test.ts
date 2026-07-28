import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readerSource = readFileSync(
  new URL("./linkedin-reader.js", import.meta.url),
  "utf8",
);

const serviceWorkerSource = readFileSync(
  new URL("../background/service-worker.js", import.meta.url),
  "utf8",
);

describe("linkedin-reader extension context guard", () => {
  it("guards runtime messaging against invalidated extension contexts", () => {
    expect(readerSource).toContain("function isExtensionContextValid()");
    expect(readerSource).toContain("function sendRuntimeMessage(message)");
    expect(readerSource).toContain("try {");
    expect(readerSource).toContain("chrome.runtime.sendMessage(message)");
    expect(readerSource).toContain("context invalidated");
  });

  it("cleans up the SPA watcher interval when the context is invalid", () => {
    expect(readerSource).toContain("let navigationInterval = null");
    expect(readerSource).toContain("clearInterval(navigationInterval)");
    expect(readerSource).toContain(
      "cleanup('navigation watcher: context invalid')",
    );
  });

  it("does not start the SPA watcher on non-profile manual injections", () => {
    expect(readerSource).toContain("startNavigationWatcher()");
    expect(readerSource).toContain(
      "manual injection on /feed/ should stay inert",
    );
  });

  it("only injects the profile reader into already-open LinkedIn profile tabs", () => {
    expect(serviceWorkerSource).toMatch(
      /chrome\.tabs\.query\(\{\s*url: ["']https:\/\/www\.linkedin\.com\/in\/\*["'],?\s*\}\)/,
    );
  });
});
