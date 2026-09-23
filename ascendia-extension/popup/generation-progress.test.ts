import { describe, expect, it } from "vitest";

import {
  formatGenerationElapsed,
  getGenerationProgress,
} from "./generation-progress.js";

describe("generation progress copy", () => {
  it.each([
    [0, "0:00"],
    [9_999, "0:09"],
    [61_000, "1:01"],
    [120_000, "2:00"],
    [-1_000, "0:00"],
  ])("formats %i elapsed milliseconds as %s", (elapsedMs, expected) => {
    expect(formatGenerationElapsed(elapsedMs)).toBe(expected);
  });

  it("describes only locally observable preparation and generation phases", () => {
    expect(getGenerationProgress("preparing", 0)).toMatchObject({
      label: "Preparing your selected context",
      orbState: "weaving",
    });
    expect(getGenerationProgress("generating", 15_000)).toMatchObject({
      label: "Generating your draft",
      orbState: "composing",
    });
  });

  it("avoids a false completion estimate when a request runs long", () => {
    const longWait = getGenerationProgress("generating", 121_000);
    expect(longWait.hint).toContain("Taking longer than expected");
    expect(longWait.hint).not.toMatch(/\d+%/u);
  });
});
