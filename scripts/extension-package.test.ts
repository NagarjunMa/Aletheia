import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import ts from "typescript";
import { expect, it } from "vitest";

it("packages the auth-draft helper and every relative runtime module dependency", async () => {
  execFileSync(process.execPath, ["scripts/build-extension-zip.mjs"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const zip = await JSZip.loadAsync(
    await readFile("ascendia-extension/dist/aletheia-extension.zip"),
  );
  expect(zip.file("lib/application-auth-draft.js")).not.toBeNull();
  expect(zip.file("assets/thinking-orbs-engine.js")).not.toBeNull();
  expect(zip.file("assets/LICENSE.thinking-orbs")).not.toBeNull();
  for (const size of [16, 32, 48, 128]) {
    const iconPath = `icons/icon-${size}.png`;
    expect(await zip.file(iconPath)?.async("nodebuffer")).toEqual(
      await readFile(`ascendia-extension/${iconPath}`),
    );
  }
  expect(await zip.file("popup/generation-orb.js")!.async("string")).toContain(
    "../assets/thinking-orbs-engine.js",
  );
  const missing: string[] = [];
  for (const file of Object.values(zip.files)) {
    if (file.dir || !file.name.endsWith(".js")) continue;
    const source = ts.createSourceFile(
      file.name,
      await file.async("string"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) &&
        !ts.isExportDeclaration(statement)
      )
        continue;
      const specifier = statement.moduleSpecifier;
      if (
        !specifier ||
        !ts.isStringLiteral(specifier) ||
        !specifier.text.startsWith(".")
      )
        continue;
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(file.name), specifier.text),
      );
      if (!zip.file(target)) missing.push(`${file.name} -> ${target}`);
    }
  }
  expect(missing).toEqual([]);
  expect(
    Object.keys(zip.files).some((name) => /\.(test|spec)\.[jt]s$/.test(name)),
  ).toBe(false);
}, 20_000);
