import { describe, expect, it } from "vitest";
import {
  EVIDENCE_KIND_OPTIONS,
  PROFILE_CATEGORY_OPTIONS,
  formatListInput,
  parseListInput,
} from "./form-helpers";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";

describe("candidate application form helpers", () => {
  it("normalizes comma and line separated values without duplicates", () => {
    expect(
      parseListInput("Founding Engineer, Platform Engineer\nfounding engineer"),
    ).toEqual(["Founding Engineer", "Platform Engineer"]);
  });

  it("drops empty values and respects the field limit", () => {
    expect(parseListInput(" Alpha, , Beta, Gamma ", 2)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("formats stored lists as editable line-separated text", () => {
    expect(formatListInput(["Developer tools", "AI infrastructure"])).toBe(
      "Developer tools\nAI infrastructure",
    );
  });

  it("offers a distinct label and prompt for every evidence kind", () => {
    expect(EVIDENCE_KIND_OPTIONS).toHaveLength(8);
    expect(
      new Set(EVIDENCE_KIND_OPTIONS.map((option) => option.value)).size,
    ).toBe(8);
    expect(
      EVIDENCE_KIND_OPTIONS.find(
        (option) => option.value === "technical_project",
      ),
    ).toEqual(
      expect.objectContaining({
        label: "Technical project",
        prompt: expect.stringContaining("difficult"),
      }),
    );
    expect(
      EVIDENCE_KIND_OPTIONS.find((option) => option.value === "ai_usage"),
    ).toEqual(
      expect.objectContaining({
        label: "AI in daily work",
        prompt: expect.stringContaining("AI"),
      }),
    );
  });

  it("divides every editable profile field into one dashboard category", () => {
    const categories = PROFILE_CATEGORY_OPTIONS;
    const fields = categories.flatMap((category) => category.fields);
    const schemaFields = Object.keys(candidateProfileInputSchema.parse({}));

    expect(categories.map((category) => category.id)).toEqual([
      "current_work",
      "direction",
      "proof_links",
      "logistics",
      "boundaries",
    ]);
    expect(new Set(fields).size).toBe(fields.length);
    expect([...fields].sort()).toEqual(schemaFields.sort());
    expect(categories.every((category) => category.saveLabel.length > 0)).toBe(
      true,
    );
  });
});
