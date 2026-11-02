import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import { prepareFactReview } from "@/lib/candidate-profile/fact-review";
import { buildOutreachGroundingContext } from "@/modules/outreach/application/build-outreach-grounding-context";
import { allowedClaimTexts } from "@/modules/grounding/domain/atomic-claim";
import type { EmailMode } from "@/lib/ai/email-formatter";

// Synthetic complete facts retain the negative qualifications from the provider evaluation.
const action =
  "I built a policy evaluation prototype that compared proposed agent actions with written requirements in a training environment, using a fixed collection of synthetic requests and expected decisions to make disagreements visible to reviewers before they changed the rules, without deploying the prototype to production or claiming that its results measured real customer behavior.";
const outcome =
  "I documented the policy evaluation prototype by recording the synthetic examples, the expected decisions, the observed disagreements, and the known limits in a review guide so another engineer could reproduce the same checks locally and discuss changes with reviewers, without treating the guide as a production certification or claiming that the prototype replaced human judgment.";

export function proseFixture(
  category: "cold_email" | "linkedin_inmail",
  emailMode: EmailMode,
) {
  const record = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "technical_project" as const,
    title: "Policy evaluation prototype",
    context: "Training prototype only; no production deployment.",
    actions: action,
    outcome,
    metrics: [],
    skills: ["Policy", "Evaluation"],
    links: [],
    confirmed: true,
    sortOrder: 0,
  };
  const context = buildOutreachGroundingContext({
    candidate: {
      identity: { fullName: "Synthetic", linkedinUrl: "" },
      profile: candidateProfileInputSchema.parse({
        currentRole: "Software Engineer",
      }),
      resume: { text: "", source: "none" },
      confirmedEvidence: [
        {
          ...record,
          factReview: prepareFactReview(record, [
            {
              id: "22222222-2222-4222-8222-222222222222",
              kind: "action",
              excerpt: action,
              confirmed: true,
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              kind: "outcome",
              excerpt: outcome,
              confirmed: true,
            },
          ]),
        },
      ],
    },
    target: {
      category,
      profileMarkdown: "Engineering Manager at Example | AI Evaluation",
      jobDescription:
        "The Policy Evaluation team at Example is hiring Software Engineers!",
      conversationContext:
        emailMode === "follow_up"
          ? "We discussed the policy evaluation prototype."
          : "",
    },
  });
  const sources = context.atomicSources!;
  const first = sources.find(
    (s) => s.scope === "candidate" && s.kind === "action",
  )!;
  const second = sources.find(
    (s) => s.scope === "candidate" && s.kind === "outcome",
  )!;
  const target = sources.find((s) => s.scope === "target")!;
  const targetText = allowedClaimTexts(target)[0]!;
  const claim = (source: typeof first, text = source.content) => ({
    text,
    kind: source.kind,
    source_id: source.id,
    supporting_excerpt: source.content,
  });
  const coldDraft = {
    subject_line: "A brief introduction",
    greeting: "there",
    target_opening: targetText,
    candidate_positioning: action,
    proof_points:
      emailMode === "follow_up"
        ? []
        : [{ text: outcome, source_ids: [second.id] }],
    value_statement: "Thank you.",
    cta: "Would you be open to a brief conversation?",
    claims: [
      claim(first),
      claim(target, targetText),
      ...(emailMode === "follow_up" ? [] : [claim(second)]),
    ],
  };
  const body = `Hi there,\n\n${action}\n\n${outcome}\n\nOpen to a brief chat?`;
  const inmailDraft = {
    subject_line: "A brief introduction",
    body,
    word_count: body.split(/\s+/u).length,
    claims: [claim(first), claim(second)],
  };
  return { context, coldDraft, inmailDraft, action, outcome };
}
