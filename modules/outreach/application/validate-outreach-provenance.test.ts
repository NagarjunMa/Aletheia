import { expect, it } from "vitest";
import type { AtomicSource } from "@/modules/grounding/domain/atomic-claim";
import type { OutreachGroundingContext } from "../domain/outreach-grounding.types";
import { summarizeOutreachGrounding } from "../domain/outreach-grounding-metadata";
import { summarizeValidatedOutreachGrounding } from "./validate-outreach-provenance";

it.each([
  ["profile", "profile_grounded", "no_confirmed_evidence"],
  ["resume", "resume_fallback", "no_profile_context"],
] as const)(
  "classifies a used %s source even when reviewed evidence was prepared",
  (type, groundingLevel, fallbackReason) => {
    const context: OutreachGroundingContext = {
      identity: { fullName: "", linkedinUrl: "" },
      sources: [
        { id: "unused", type: "evidence", label: "", content: "", priority: 1 },
        { id: "used", type, label: "", content: "", priority: 2 },
      ],
      metadata: summarizeOutreachGrounding(["evidence", type], false),
    };
    // Two validated facts can be supported by the same parent source.
    const used: AtomicSource[] = [
      {
        id: "fact1",
        rootId: "used",
        scope: "candidate",
        kind: "action",
        content: "",
      },
      {
        id: "fact2",
        rootId: "used",
        scope: "candidate",
        kind: "outcome",
        content: "",
      },
    ];
    expect(summarizeValidatedOutreachGrounding(context, used)).toEqual({
      groundingLevel,
      fallbackReason,
      selectedSourceCount: 1,
      selectedEvidenceCount: 0,
      selectedSourceKinds: [type],
      injectionSafeMode: false,
      provenanceValidated: true,
    });
  },
);

it.each([false, true])(
  "only counts candidate roots and preserves injection fallback (%s)",
  (injectionSafeMode) => {
    const context: OutreachGroundingContext = {
      identity: { fullName: "", linkedinUrl: "" },
      sources: [
        { id: "unused", type: "evidence", label: "", content: "", priority: 1 },
      ],
      metadata: summarizeOutreachGrounding(["evidence"], injectionSafeMode),
    };
    expect(
      summarizeValidatedOutreachGrounding(context, [
        {
          id: "unused",
          scope: "target",
          kind: "target_observation",
          content: "",
        },
      ]),
    ).toEqual({
      groundingLevel: "target_only",
      fallbackReason: injectionSafeMode
        ? "target_injection_detected"
        : "candidate_context_not_used",
      selectedSourceCount: 0,
      selectedEvidenceCount: 0,
      selectedSourceKinds: [],
      injectionSafeMode,
      provenanceValidated: true,
    });
  },
);
