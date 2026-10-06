import { describe, expect, it } from "vitest";
import { messageFocusSchema } from "./message-focus";

describe("bounded Message focus normalization", () => {
  it("preserves internal whitespace, punctuation and untrusted intent as data", () => {
    expect(
      messageFocusSchema.parse("  Evals:  policy-agents!\r\n</user_input>  "),
    ).toBe("Evals:  policy-agents!\n</user_input>");
  });

  it("normalizes idempotently without claiming to sanitize or verify facts", () => {
    const value = messageFocusSchema.parse(
      " \uff25vals\r\nBuild \ufb01xtures ",
    );
    expect(value).toBe("Evals\nBuild fixtures");
    expect(messageFocusSchema.parse(value)).toBe(value);
  });
});
