import { afterAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Linter } from "eslint";
import { cn } from "../lib/utils";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const scratch = mkdtempSync(path.join(tmpdir(), "aletheia-lint-contract-"));
for (const app of ["one", "two"]) {
  mkdirSync(path.join(scratch, app, "pages"), { recursive: true });
  writeFileSync(
    path.join(scratch, app, "pages", "profile.tsx"),
    "export default function Page() { return null; }",
  );
}
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("dependency toolchain contracts", () => {
  it("merges the supported Tailwind 4 utility vocabulary without losing variants", () => {
    expect(cn("bg-linear-to-r hover:bg-primary", "bg-linear-to-b")).toBe(
      "hover:bg-primary bg-linear-to-b",
    );
    expect(cn("px-3 text-foreground rounded-lg", "px-5 md:px-6")).toBe(
      "text-foreground rounded-lg px-5 md:px-6",
    );
  });
  it("does not install the vulnerable braces dependency", () => {
    const lock = JSON.parse(
      readFileSync(path.join(root, "package-lock.json"), "utf8"),
    );
    expect(
      Object.keys(lock.packages).filter((entry) =>
        /(?:^|\/)node_modules\/braces$/u.test(entry),
      ),
    ).toEqual([]);
  });

  it.each(["string", "array", "backslashes", "default"])(
    "preserves Next route lint enforcement with %s root directories",
    (kind) => {
      const plugin = require("@next/eslint-plugin-next");
      const rootGlob = path.join(scratch, "{one,two}");
      const rootDir =
        kind === "array"
          ? [rootGlob, 42]
          : kind === "backslashes"
            ? rootGlob.replaceAll("/", "\\")
            : rootGlob;
      const linter = new Linter({ cwd: path.join(scratch, "one") });
      const config = {
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { "@next/next": plugin },
        settings: kind === "default" ? {} : { next: { rootDir } },
        rules: { "@next/next/no-html-link-for-pages": "error" as const },
      };
      expect(
        linter
          .verify('const el = <a href="/profile">Profile</a>;', config)
          .map((message) => message.ruleId),
      ).toContain("@next/next/no-html-link-for-pages");
      expect(
        linter.verify(
          'const el = <a href="https://example.test/profile">External</a>;',
          config,
        ),
      ).toEqual([]);
    },
  );
});
