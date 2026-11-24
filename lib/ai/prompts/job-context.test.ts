import { expect, it } from "vitest";
import { separateJobContext } from "./job-context";

it("keeps text resembling page controls when it occurs within a description", () => {
  const description = [
    "# Requirements",
    "Follow",
    "Follow customer change controls and submit an exception for urgent cases.",
    "",
    "Selected example",
    "• 2nd",
    "Visit my website",
    "4d •",
    "Follow",
    "",
    "## Exceptions",
    "Use 4d • exactly as shown in the example.",
  ].join("\n");
  expect(separateJobContext(description)).toEqual({
    body: description,
    hashtags: [],
  });
});

it("keeps inline tags and Markdown headings in the body", () => {
  const description = "# Requirements\nTrack #onsite coverage when needed.";
  expect(separateJobContext(description + "\n\n#ai #engineering #ai")).toEqual({
    body: description,
    hashtags: ["#ai", "#engineering"],
  });
});

it("keeps a standalone heading after the copied header paragraph", () => {
  const description =
    "Follow\nCustomer handoffs must include the original requirements.";
  expect(
    separateJobContext(
      "Cal Carlisle\n• 2nd\nAI Search Partner\n4d •\n\n" + description,
    ),
  ).toEqual({
    body: "Cal Carlisle\nAI Search Partner\n\n" + description,
    hashtags: [],
  });
});

it("separates trailing hashtags across blank lines without reordering them", () => {
  expect(separateJobContext("Build systems.\n\n#AI\n\n#security")).toEqual({
    body: "Build systems.",
    hashtags: ["#AI", "#security"],
  });
});
