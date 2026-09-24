import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL } from "@/lib/public-contact";
import { buildFeedbackMailto } from "./feedback-mailto";

describe("buildFeedbackMailto", () => {
  it("addresses a fixed support inbox and encodes the message as body text", () => {
    const url = new URL(
      buildFeedbackMailto("Alex Example", "Helpful tool!\nPlease add exports."),
    );

    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe(SUPPORT_EMAIL);
    expect(url.searchParams.get("subject")).toBe("Aletheia product feedback");
    expect(url.searchParams.get("body")).toBe(
      "Name: Alex Example\n\nHelpful tool!\nPlease add exports.",
    );
  });

  it("keeps user-supplied header-looking text inside the body", () => {
    const url = new URL(
      buildFeedbackMailto(
        "Alex\nBcc: someone@example.test",
        "Thoughtful feedback & more?",
      ),
    );

    expect(url.searchParams.get("body")).toContain(
      "Name: Alex Bcc: someone@example.test",
    );
    expect(url.searchParams.get("bcc")).toBeNull();
    expect(url.searchParams.get("body")).toContain(
      "Thoughtful feedback & more?",
    );
  });

  it("does not add a name line when the optional name is blank", () => {
    const url = new URL(buildFeedbackMailto("  ", "  This was useful.  "));
    expect(url.searchParams.get("body")).toBe("This was useful.");
  });
});
