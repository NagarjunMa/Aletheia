import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("extension validation parity", () => {
  it("declares every formatter invoked by lint-staged", () => {
    const rootPackage = JSON.parse(read("package.json")) as {
      devDependencies?: Record<string, string>;
    };

    expect(rootPackage.devDependencies?.prettier).toBeDefined();
  });

  it("uses one complete extension validation target locally and in CI", () => {
    const makefile = read("Makefile");
    const workflow = read(".github/workflows/ci.yml");

    expect(makefile).toMatch(/extension-ci:[^\n]*\n/);
    expect(makefile).toContain(
      "npm --prefix ascendia-extension run security:audit",
    );
    expect(makefile).toContain(
      "npm --prefix ascendia-extension run type-check",
    );
    expect(makefile).toContain("npm --prefix ascendia-extension run lint");
    expect(makefile).toContain("npm --prefix ascendia-extension test");
    expect(makefile).toContain("npm --prefix ascendia-extension run build:ext");
    expect(workflow).toContain("run: make extension-ci");
  });

  it("runs extension validation for every staged extension change", () => {
    const hook = read(".husky/pre-commit");

    expect(hook).toContain("git diff --cached --name-only");
    expect(hook).toContain("^ascendia-extension/");
    expect(hook).toContain("make extension-ci");
    expect(hook).toContain("scripts/check-extension-version.mjs");
    expect(hook).toContain("npm run build:extension");
  });
});
