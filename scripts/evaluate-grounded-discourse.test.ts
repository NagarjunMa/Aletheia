import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("offline discourse CLI boundary", () => {
  it("emits metadata only with HTTP/fetch disabled and no credentials", () => {
    const directory = mkdtempSync(join(tmpdir(), "ale48-cli-"));
    try {
      const guard = join(directory, "deny-network.cjs");
      writeFileSync(
        guard,
        `const deny=()=>{throw new Error('NETWORK_FORBIDDEN')};require('node:http').request=deny;require('node:https').request=deny;globalThis.fetch=deny;`,
      );
      const stdout = execFileSync(
        process.execPath,
        [
          "--require",
          guard,
          "node_modules/tsx/dist/cli.mjs",
          "scripts/evaluate-grounded-discourse.ts",
        ],
        {
          encoding: "utf8",
          timeout: 10000,
          env: {
            ...process.env,
            LOG_LEVEL: "silent",
            ANTHROPIC_API_KEY: "",
            SUPABASE_SERVICE_ROLE_KEY: "",
          },
        },
      );
      const result = JSON.parse(stdout);
      expect(result.configuration.providerCalls).toBe(0);
      expect(result.mode).toBe("offline");
      expect(result.localEvaluationMs).toBeGreaterThan(0);
      expect(stdout).not.toContain("supporting_excerpt");
      expect(stdout).not.toContain("fictional orchard");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it.each(["malformed", "private", "mismatch"])(
    "fails %s variants with a fixed error and no partial report",
    (kind) => {
      const directory = mkdtempSync(join(tmpdir(), "ale48-cli-"));
      try {
        const path = join(directory, "PRIVATE_FILENAME_CANARY.json");
        writeFileSync(
          path,
          kind === "malformed"
            ? "PRIVATE_CONTENT_CANARY"
            : kind === "private"
              ? JSON.stringify([
                  { id: "synthetic-private", body: "hello@real-user.invalid" },
                ])
              : "[]",
        );
        const child = spawnSync(
          process.execPath,
          [
            "node_modules/tsx/dist/cli.mjs",
            "scripts/evaluate-grounded-discourse.ts",
            "--variant",
            path,
          ],
          {
            encoding: "utf8",
            timeout: 10000,
            env: {
              ...process.env,
              LOG_LEVEL: "silent",
              ANTHROPIC_API_KEY: "",
              SUPABASE_SERVICE_ROLE_KEY: "",
            },
          },
        );
        expect(child.status).toBe(1);
        expect(child.stdout).toBe("");
        expect(child.stderr).toBe(
          "Offline discourse evaluation failed. Check arguments and the locked synthetic fixture contract.\n",
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
