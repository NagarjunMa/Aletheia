import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authSource = readFileSync(new URL("./auth.js", import.meta.url), "utf8");

describe("auth logging", () => {
  it("does not log cookie values or partial cookie values", () => {
    expect(authSource).not.toContain("c.value.substring");
    expect(authSource).not.toContain("console.");
    expect(authSource).toContain('log.info("auth.cookie_lookup.complete"');
    expect(authSource).toContain("cookieCount: authCookies.length");
  });
});
