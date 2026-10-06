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
import sharp from "sharp";
import postcss from "postcss";

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
  it.each([
    ["sharp", [0, 35, 5]],
    ["source-map-js", [1, 2, 2]],
  ] as const)(
    "locks patched %s versions at every dependency path",
    (name, minimum) => {
      const lock = JSON.parse(
        readFileSync(path.join(root, "package-lock.json"), "utf8"),
      );
      const versions = Object.entries(lock.packages)
        .filter(
          ([entry]) =>
            entry.endsWith(`/node_modules/${name}`) ||
            entry === `node_modules/${name}`,
        )
        .map(([, pkg]) => (pkg as { version: string }).version);
      expect(versions.length).toBeGreaterThan(0);
      for (const version of versions) {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/u);
        const parts = version.split(".").map(Number);
        const difference = parts.findIndex(
          (part, index) => part !== minimum[index],
        );
        expect(
          difference < 0 || parts[difference]! > minimum[difference]!,
        ).toBe(true);
      }
    },
  );

  it("decodes a synthetic SVG and converts a raster image using native Sharp", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#285d49"/></svg>',
    );
    const png = await sharp(svg).png().toBuffer();
    const result = await sharp(png)
      .resize(2, 2)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(result.info).toMatchObject({ width: 2, height: 2, channels: 3 });
    expect([...result.data]).toEqual([
      40, 93, 73, 40, 93, 73, 40, 93, 73, 40, 93, 73,
    ]);
    await expect(
      sharp(Buffer.from("not an image")).png().toBuffer(),
    ).rejects.toThrow();
  });

  it("round-trips a real PostCSS source map to its original source", async () => {
    const input = ".example { color: green; }";
    const result = await postcss([
      {
        postcssPlugin: "fixture",
        Declaration(decl) {
          if (decl.prop === "color") decl.value = "#285d49";
        },
      },
    ]).process(input, {
      from: "/fixture/input.css",
      to: "/fixture/output.css",
      map: { inline: false, annotation: false },
    });
    expect(result.css).toContain("#285d49");
    const { SourceMapConsumer } = require("source-map-js");
    const consumer = new SourceMapConsumer(result.map!.toJSON());
    expect(consumer.originalPositionFor({ line: 1, column: 0 })).toMatchObject({
      source: "input.css",
      line: 1,
      column: 0,
    });
    expect(consumer.sourceContentFor("input.css")).toBe(input);
  });

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
