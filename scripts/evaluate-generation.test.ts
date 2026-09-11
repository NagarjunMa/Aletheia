import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runEvaluation } from "./evaluate-generation";
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
describe("offline evaluation command", () => {
  it("never echoes paths or malformed content in exported API errors", () => {
    expect(() =>
      runEvaluation([
        "--manifest",
        "/missing/PRIVATE_CREDENTIAL",
        "--out",
        "/missing",
      ]),
    ).toThrow(
      "Generation evaluation failed. Check the manifest, input limits and a fresh output directory.",
    );
  });
  it("reads relative manifest inputs, writes private offline artifacts and refuses overwrites", () => {
    const dir = mkdtempSync(join(tmpdir(), "ale52-"));
    directories.push(dir);
    const manifest = {
      start: "2026-09-10T00:00:00Z",
      end: "2026-09-10T00:01:00Z",
      environment: "test",
      complete: false,
      server: ["server.jsonl"],
    };
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
    writeFileSync(
      join(dir, "server.jsonl"),
      JSON.stringify({
        event: "generation.timing",
        time: manifest.start,
        requestId: "11111111-1111-4111-8111-111111111111",
        outcome: "success",
        durationMs: 10,
        body: "PRIVATE",
      }),
    );
    const args = [
      "--manifest",
      join(dir, "manifest.json"),
      "--out",
      join(dir, "output"),
    ];
    runEvaluation(args);
    const aggregate = JSON.parse(
      readFileSync(join(dir, "output/aggregate.json"), "utf8"),
    );
    expect(aggregate.latency.server.median).toBe(10);
    expect(aggregate.samples).toBeUndefined();
    const html = readFileSync(join(dir, "output/report.html"), "utf8");
    expect(html).toContain("TEST DATA");
    expect(html).not.toContain("PRIVATE");
    expect(html).not.toContain("11111111-");
    expect(() => runEvaluation(args)).toThrow();
  });
  it("does not overwrite a source through output symlinks", () => {
    const dir = mkdtempSync(join(tmpdir(), "ale52-"));
    directories.push(dir);
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({
        start: "2026-09-10T00:00:00Z",
        end: "2026-09-10T00:01:00Z",
        environment: "test",
        complete: false,
        server: ["source.json"],
      }),
    );
    writeFileSync(join(dir, "source.json"), "[]");
    symlinkSync(join(dir, "source.json"), join(dir, "report.html"));
    expect(() =>
      runEvaluation(["--manifest", join(dir, "manifest.json"), "--out", dir]),
    ).toThrow();
    expect(readFileSync(join(dir, "source.json"), "utf8")).toBe("[]");
  });
});
