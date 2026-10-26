import { describe, expect, it } from "vitest";
import {
  outputWorkUnits,
  retryAfterSeconds,
  resolveWorkUnitLimit,
} from "./generation-admission";

describe("server-owned generation work policy", () => {
  it.each([
    [600, 1],
    [1_000, 1],
    [2_000, 2],
    [3_500, 4],
    [8_000, 8],
  ])("maps %i output tokens to %i weighted units", (tokens, expected) =>
    expect(outputWorkUnits(tokens)).toBe(expected),
  );
  it.each([0, -1, 1.5, NaN, Infinity])(
    "rejects invalid budget %s",
    (tokens) => {
      expect(() => outputWorkUnits(tokens)).toThrow();
    },
  );
  it("rounds retry guidance up and never reports zero", () => {
    expect(retryAfterSeconds(10_001, 10_000)).toBe(1);
    expect(retryAfterSeconds(11_001, 10_000)).toBe(2);
  });
  it("never configures a work limit below the five-answer YC batch cost", () => {
    expect(resolveWorkUnitLimit("8")).toBe(8);
    expect(resolveWorkUnitLimit("7")).toBe(60);
    expect(resolveWorkUnitLimit("1")).toBe(60);
    expect(resolveWorkUnitLimit("1001")).toBe(60);
  });
});
