import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const extensionRoot = path.resolve(import.meta.dirname, "..");

describe("extension lint dependency compatibility", () => {
  it("does not lock a matcher affected by GHSA-g3hv-75wg-m249", () => {
    const lock = JSON.parse(
      readFileSync(path.join(extensionRoot, "package-lock.json"), "utf8"),
    ) as { packages: Record<string, { version?: string }> };
    const matchers = Object.entries(lock.packages).filter(([name]) =>
      name.endsWith("node_modules/minimatch"),
    );
    expect(matchers.length).toBeGreaterThan(0);
    for (const [name, entry] of matchers) {
      const [major = 0, minor = 0, patch = 0] = String(entry.version)
        .split(".")
        .map(Number);
      expect(
        major > 11 || (major === 11 && (minor > 0 || patch >= 1)),
        name,
      ).toBe(true);
    }
  });

  it("discovers nested TS/TSX and dotfiles while preserving ignores and diagnostics", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "aletheia-lint-"));
    try {
      mkdirSync(path.join(directory, "src/nested"), { recursive: true });
      mkdirSync(path.join(directory, "dist"));
      mkdirSync(path.join(directory, "lib"));
      const files = {
        "src/nested/main.ts": "const unused: number = 1;\n",
        "src/view.tsx": "export const view = <div />;\n",
        ".hidden.ts": "export const hidden: number = 1;\n",
        "src/broken.ts": "export const broken: = 1;\n",
        "dist/ignored.ts": "invalid syntax !!!\n",
        "lib/ignored.ts": "invalid syntax !!!\n",
      };
      for (const [file, body] of Object.entries(files)) {
        writeFileSync(path.join(directory, file), body);
      }
      const eslint = new ESLint({
        cwd: directory,
        overrideConfigFile: path.join(extensionRoot, "eslint.config.mjs"),
      });
      const results = await eslint.lintFiles(["**/*.{ts,tsx}"]);
      expect(
        results
          .map((result) => path.relative(directory, result.filePath))
          .sort(),
      ).toEqual([
        ".hidden.ts",
        "src/broken.ts",
        "src/nested/main.ts",
        "src/view.tsx",
      ]);
      expect(
        results.find((result) => result.filePath.endsWith("main.ts"))?.messages,
      ).toEqual([
        expect.objectContaining({
          ruleId: "@typescript-eslint/no-unused-vars",
          severity: 1,
        }),
      ]);
      expect(
        results.find((result) => result.filePath.endsWith("broken.ts"))
          ?.fatalErrorCount,
      ).toBe(1);
      expect(
        results.find((result) => result.filePath.endsWith("view.tsx"))
          ?.errorCount,
      ).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
