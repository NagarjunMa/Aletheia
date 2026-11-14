import { normalizeMessageFocus } from "../ascendia-extension/lib/message-focus.js";
import { buildGeneratePayload } from "../ascendia-extension/popup/popup-core.js";
import {
  LINKEDIN_BASIC_CONNECTION_MAX_CHARACTERS,
  LINKEDIN_CONNECTION_MAX_CHARACTERS,
} from "../lib/ai/output-constraints";

export const focusCanary = "ALE59PRIVATEFOCUSCANARY";
export const noMatchCanary = "ALE59PRIVATENOMATCHCANARY";
export const profileMarkdown =
  "Engineering Manager at Example | Policy Evaluation";
export const hiringPost =
  "The Policy Evaluation team at Example is hiring Software Engineers! You will build policy evaluation tooling for agent decisions and review examples to compare expected results and report findings.";
export const conversation =
  "We discussed the policy evaluation prototype and reviewed synthetic examples.";
export const automaticShortFact =
  "I built policy evaluation tooling for agent decisions and reviewed expected results.";
export const focusedShortFact =
  "I built policy evaluation tooling in a simulated environment.";
export const focusedAction =
  "I built a policy evaluation prototype that compared proposed agent actions with written requirements in a training environment, using a fixed collection of synthetic requests and expected decisions to make disagreements visible to reviewers before they changed the rules, without deploying the prototype to production or claiming that its results measured real customer behavior.";
export const focusedOutcome =
  "I documented the policy evaluation prototype by recording the synthetic examples, the expected decisions, the observed disagreements, and the known limits in a review guide so another engineer could reproduce the same checks locally and discuss changes with reviewers, without treating the guide as a production certification or claiming that the prototype replaced human judgment.";

const matchedFocus = {
  linkedin_connection: `simulated environment & ${focusCanary}`,
  cold_email: `written requirements & ${focusCanary}`,
  linkedin_inmail: `written requirements & ${focusCanary}`,
};

type Channel = keyof typeof matchedFocus;
type Mode = "off" | "on";
type Scenario = {
  name: string;
  mode: Mode;
  category: Channel;
  emailMode: "initial_outreach" | "follow_up";
  expectedStatus: 200 | 409 | 422;
  focus?: "match" | "no_match";
  legacy?: true;
};

const paths = [
  {
    name: "linkedin",
    category: "linkedin_connection",
    emailMode: "initial_outreach",
  },
  { name: "cold_email", category: "cold_email", emailMode: "initial_outreach" },
  {
    name: "inmail",
    category: "linkedin_inmail",
    emailMode: "initial_outreach",
  },
  {
    name: "cold_email_follow_up",
    category: "cold_email",
    emailMode: "follow_up",
  },
  {
    name: "inmail_follow_up",
    category: "linkedin_inmail",
    emailMode: "follow_up",
  },
] as const;
const [linkedin, coldEmail, inmail] = paths;

export const messageFocusCases: readonly Scenario[] = [
  {
    ...linkedin,
    name: "focus_unavailable",
    mode: "off",
    focus: "match",
    expectedStatus: 409,
  },
  ...[linkedin, coldEmail, inmail].map((path): Scenario => ({
    ...path,
    name: `${path.name}_no_match`,
    mode: "on",
    focus: "no_match",
    expectedStatus: 422,
  })),
  ...paths.flatMap((path): Scenario[] => [
    { ...path, mode: "off", expectedStatus: 200 },
    { ...path, mode: "on", focus: "match", expectedStatus: 200 },
  ]),
  ...(["off", "on"] as const).map((mode): Scenario => ({
    ...linkedin,
    name: "legacy_no_focus",
    mode,
    legacy: true,
    expectedStatus: 200,
  })),
];

export function matchesReviewedFixture(scenario: Scenario, body: string) {
  if (scenario.legacy)
    return [automaticShortFact, focusedShortFact].some((fact) =>
      body.includes(fact),
    );
  if (scenario.category === "linkedin_connection")
    return body.includes(
      scenario.focus === "match" ? focusedShortFact : automaticShortFact,
    );
  const otherFacts = [automaticShortFact, focusedShortFact, focusedOutcome];
  if (scenario.focus !== "match")
    return [focusedAction, ...otherFacts].some((fact) => body.includes(fact));

  const focusedPosition = body.indexOf(focusedAction);
  return (
    focusedPosition >= 0 &&
    otherFacts.every((fact) => {
      const position = body.indexOf(fact);
      return position < 0 || position > focusedPosition;
    })
  );
}

export function fixtureNoteLimit(scenario: Scenario) {
  return scenario.legacy
    ? LINKEDIN_CONNECTION_MAX_CHARACTERS
    : LINKEDIN_BASIC_CONNECTION_MAX_CHARACTERS;
}

export function messageFocusPayload(scenario: Scenario) {
  const payload = buildGeneratePayload(
    { profileMarkdown },
    "",
    scenario.legacy
      ? ""
      : scenario.emailMode === "follow_up"
        ? conversation
        : hiringPost,
    scenario.category,
    "job_inquiry",
    [],
    scenario.emailMode,
    "",
    [],
    fixtureNoteLimit(scenario),
  );
  if (
    !("profileMarkdown" in payload) ||
    typeof payload.profileMarkdown !== "string"
  )
    throw new Error("Invalid outreach fixture");
  if (scenario.legacy) delete payload.connectionNoteLimit;
  if (!scenario.focus) return { ...payload, messageFocus: undefined };
  const focus = normalizeMessageFocus(
    scenario.focus === "match"
      ? matchedFocus[scenario.category]
      : `quantum lithography & ${noMatchCanary}`,
  );
  if (!focus) throw new Error("Invalid Message Focus fixture");
  return { ...payload, messageFocus: focus };
}
