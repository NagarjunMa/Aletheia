import { describe, expect, it } from "vitest";
import { sanitizeResumeFileName } from "./service";

describe("sanitizeResumeFileName", () => {
  it("removes path segments and unsafe characters", () => {
    expect(sanitizeResumeFileName("../Nagarjun Resume!!.pdf")).toBe(
      "Nagarjun-Resume.pdf",
    );
  });

  it("falls back to a safe name when the filename is empty after cleanup", () => {
    expect(sanitizeResumeFileName("////")).toBe("resume");
  });
});
