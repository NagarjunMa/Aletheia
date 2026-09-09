import { describe, expect, it } from "vitest";
import { normalizePostAuthRedirect } from "./redirect";

describe("normalizePostAuthRedirect", () => {
  it.each([
    [null, "/dashboard"],
    ["", "/dashboard"],
    ["/profile", "/profile"],
    ["/profile?section=resumes#upload", "/profile?section=resumes#upload"],
  ])("maps %j to %s", (input, expected) => {
    expect(normalizePostAuthRedirect(input)).toBe(expected);
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "/\\attacker.example/path",
    "javascript:alert(1)",
  ])("rejects unsafe destination %s", (input) => {
    expect(normalizePostAuthRedirect(input)).toBe("/dashboard");
  });
});
