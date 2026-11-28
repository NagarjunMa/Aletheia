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

it("keeps one copy of an exactly repeated LinkedIn post with a fenced example and hashtags", () => {
  const description = [
    "# Requirements\nBuild prototype tools. Production access is optional.",
    "```text\nrepeat\n\nrepeat\n```",
  ].join("\n\n");
  const post = [
    "Cal Carlisle\n• 2nd\nAI Search Partner\n4d •\nFollow",
    description,
    "#AI",
  ].join("\n\n");

  expect(separateJobContext(post + "\n\n" + post)).toEqual({
    body: "Cal Carlisle\nAI Search Partner\n\n" + description,
    hashtags: ["#AI"],
  });
});

it("preserves repeated wording within and across sections", () => {
  const requirement = "Only deploy after a human review.";
  const description = [
    "## Production",
    requirement,
    requirement,
    "## Training",
    requirement,
    "Only deploy after a human review unless the exercise is offline.",
  ];

  expect(separateJobContext(description.join("\n\n")).body).toBe(
    description.join("\n\n"),
  );
});

it.each([
  "Release protocol:\n\n1. Obtain an independent approval.\n\n1. Obtain an independent approval.\n\n1. Ship after both approvals.",
  "Production requires both authorizers:\n\n    approve();\n\n    approve();\n\nBoth approvals are required.",
])("keeps the repeated steps in %s", (description) => {
  expect(separateJobContext(description).body).toBe(description);
});
