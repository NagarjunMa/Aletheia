import { describe, expect, it } from "vitest";
import { EMAIL_MODES } from "./email-formatter";
import {
  compareDeclaredOutputCount,
  countOutputUnits,
  resolveOutputConstraint,
} from "./output-constraints";

describe("output constraints", () => {
  it("keeps LinkedIn connection notes on the 300-character contract", () => {
    expect(
      resolveOutputConstraint({ category: "linkedin_connection" }),
    ).toEqual({
      category: "linkedin_connection",
      unit: "characters",
      minimum: 1,
      maximum: 300,
    });
    expect(countOutputUnits("Hello 👋", "characters")).toBe(8);
  });

  it.each(EMAIL_MODES)(
    "resolves the existing cold-email limit for %s",
    (emailMode) => {
      const constraint = resolveOutputConstraint({
        category: "cold_email",
        emailMode,
      });
      expect(constraint.unit).toBe("words");
      expect(constraint.minimum).toBeGreaterThan(0);
      expect(constraint.maximum).toBeGreaterThanOrEqual(constraint.minimum);
    },
  );

  it.each(EMAIL_MODES)(
    "resolves the existing InMail limit for %s without inheriting characters",
    (emailMode) => {
      const constraint = resolveOutputConstraint({
        category: "linkedin_inmail",
        emailMode,
      });
      expect(constraint.unit).toBe("words");
      expect(constraint.maximum).toBeLessThanOrEqual(120);
    },
  );

  it("keeps application answers on their independent word contract", () => {
    expect(resolveOutputConstraint({ category: "yc_application" })).toEqual({
      category: "yc_application",
      unit: "words",
      minimum: 50,
      maximum: 150,
    });
    expect(countOutputUnits("one\n two   three", "words")).toBe(3);
  });

  it("requires a mode only for email categories", () => {
    expect(() => resolveOutputConstraint({ category: "cold_email" })).toThrow(
      "emailMode",
    );
    expect(() =>
      resolveOutputConstraint({ category: "linkedin_inmail" }),
    ).toThrow("emailMode");
  });

  it("reports the server count without treating declared metadata as authority", () => {
    expect(
      compareDeclaredOutputCount({
        content: "one two three",
        unit: "words",
        declaredCount: 2,
      }),
    ).toEqual({ actualCount: 3, matches: false });
  });
});
