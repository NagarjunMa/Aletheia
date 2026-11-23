import { describe, expect, it } from "vitest";
import {
  buildGenerationRequestData,
  serializeGenerationError,
} from "./generation-core.js";

import { sanitizeOutreachGrounding } from "../lib/outreach-grounding.js";
import {
  getGenerationErrorPresentation,
  getGroundingStatusPresentation,
  parseGenerationResponse,
} from "../popup/popup-core.js";

const grounding = {
  groundingLevel: "verified_evidence",
  fallbackReason: "none",
  selectedSourceCount: 1,
  selectedEvidenceCount: 1,
  selectedSourceKinds: ["evidence"],
  injectionSafeMode: false,
  provenanceValidated: true,
};
const draft = {
  success: true,
  category: "linkedin_inmail",
  body: "Draft",
  evalMetadata: { generationId: "receipt", grounding },
};

describe("grounding metadata on the worker bridge", () => {
  it("preserves the safe summary, receipt and an older response's draft", () => {
    expect(sanitizeOutreachGrounding(draft, draft.category)).toEqual(draft);
    const old = { success: true, category: draft.category, body: draft.body };
    expect(sanitizeOutreachGrounding(old, draft.category)).toEqual(old);
  });

  it.each([
    { provenanceValidated: undefined },
    { groundingLevel: "<img src=x>" },
    { fallbackReason: "unexpected_reason" },
    { fallbackReason: "no_profile_context" },
    { selectedSourceCount: 65 },
    { selectedEvidenceCount: 2 },
    { selectedSourceKinds: ["evidence", "PRIVATE_KIND_CANARY"] },
    { sourceIds: ["PRIVATE_SOURCE_CANARY"] },
    { applicationProfileUrl: "https://example.test/unsafe" },
  ])("drops inconsistent, legacy or unknown fields %#", (invalid) => {
    const output = sanitizeOutreachGrounding(
      {
        ...draft,
        evalMetadata: {
          ...draft.evalMetadata,
          grounding: { ...grounding, ...invalid },
        },
      },
      draft.category,
    );
    expect(output.evalMetadata).toEqual({ generationId: "receipt" });
    expect(output.body).toBe(draft.body);
  });

  it("does not surface outreach grounding for errors, YC or category mismatches", () => {
    for (const [output, requested] of [
      [{ ...draft, success: false }, "linkedin_inmail"],
      [{ ...draft, success: "false" }, "linkedin_inmail"],
      [{ ...draft, category: "yc_application" }, "yc_application"],
      [draft, "cold_email"],
      [
        {
          ...draft,
          evalMetadata: { ...draft.evalMetadata, category: "cold_email" },
        },
        "linkedin_inmail",
      ],
    ] as const) {
      expect(
        sanitizeOutreachGrounding(output, requested).evalMetadata,
      ).not.toHaveProperty("grounding");
    }
  });

  it.each([undefined, "   ", 123])(
    "drops grounding when the draft body is missing or invalid (%s)",
    (body) => {
      expect(
        sanitizeOutreachGrounding({ ...draft, body }, draft.category)
          .evalMetadata,
      ).not.toHaveProperty("grounding");
    },
  );

  it("drops the optional metadata envelope when no safe fields remain", () => {
    const malformed = {
      ...draft,
      evalMetadata: { grounding: { sourceIds: ["PRIVATE_SOURCE_CANARY"] } },
    };
    expect(sanitizeOutreachGrounding(malformed, draft.category)).toEqual({
      success: true,
      category: draft.category,
      body: draft.body,
    });
  });

  for (const category of ["cold_email", "linkedin_inmail"]) {
    it.each(["", "   ", "Hi Alex, open to connecting?"])(
      category +
        " preserves legacy rendering without a final grounding badge (%s)",
      (body) => {
        const encoded = JSON.stringify({ subject_line: "Hello", body });
        for (const wrapper of [encoded, `\`\`\`json\n${encoded}\n\`\`\``]) {
          const response = { ...draft, category, body: wrapper };
          const safe = sanitizeOutreachGrounding(response, category);
          expect(safe.evalMetadata).toEqual({ generationId: "receipt" });
          expect(safe.body).toBe(wrapper);
          const parsed = parseGenerationResponse(safe);
          expect(parsed.body).toBe(body || wrapper);
          expect(parsed.subject_line).toBe("Hello");
          expect(getGroundingStatusPresentation(parsed)).toBeNull();
        }
      },
    );
  }
});

describe("generation background bridge", () => {
  it.each([
    "The selected context contains instruction-like or encoded text. Try another profile or remove that text from the job description.",
    "The supplied context contradicts the role or work detail. Use a current job post or another profile.",
    "The available context matches your saved exclusions. Add a role or work detail outside those exclusions.",
  ])(
    "keeps the public safety guidance across the legacy bridge (%s)",
    (publicMessage) => {
      const response = serializeGenerationError({
        status: 422,
        code: "INSUFFICIENT_GROUNDING",
        message: `HTTP 422: ${publicMessage}`,
        apiResponse: { error: publicMessage },
      });
      const presentation = getGenerationErrorPresentation(
        response,
        undefined,
        undefined,
        "linkedin_connection",
      );
      expect(presentation.message).toContain(publicMessage);
      expect(presentation.message).not.toMatch(/HTTP|INSUFFICIENT_GROUNDING/);
    },
  );

  it("projects bounded LinkedIn guidance without private extras", () => {
    const result = serializeGenerationError({
      status: 422,
      code: "INSUFFICIENT_GROUNDING",
      requestId: "safe-request",
      apiResponse: {
        linkedinGuidance: {
          reason: "note_limit",
          connectionNoteLimit: 200,
          excerpt: "PRIVATE_CANARY",
        },
      },
    });
    expect(result.linkedinGuidance).toEqual({
      reason: "note_limit",
      connectionNoteLimit: 200,
    });
    expect(result).toMatchObject({
      status: 422,
      code: "INSUFFICIENT_GROUNDING",
      requestId: "safe-request",
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_CANARY");
  });

  it.each([
    { status: 503 },
    { status: "422" },
    { code: "PROVIDER_ERROR" },
    {
      linkedinGuidance: { reason: "PRIVATE_REASON", connectionNoteLimit: 200 },
    },
    { linkedinGuidance: { reason: "note_limit", connectionNoteLimit: "200" } },
    { linkedinGuidance: { reason: "note_limit", connectionNoteLimit: 201 } },
    { linkedinGuidance: null },
  ])("drops invalid LinkedIn guidance %j", (override) => {
    const { linkedinGuidance, ...transport } = override;
    const result = serializeGenerationError({
      status: 422,
      code: "INSUFFICIENT_GROUNDING",
      ...transport,
      apiResponse: {
        linkedinGuidance:
          "linkedinGuidance" in override
            ? linkedinGuidance
            : { reason: "note_limit", connectionNoteLimit: 200 },
      },
    });
    expect(result).not.toHaveProperty("linkedinGuidance");
  });
  it("derives retry guidance from a bounded server reset when the header is absent", () => {
    const resetTime = Date.now() + 60_000;
    expect(
      serializeGenerationError({ status: 429, apiResponse: { resetTime } }),
    ).toMatchObject({ resetTime, retryAfterSeconds: 60 });
  });
  it.each([NaN, Infinity, -1, "private-value", Date.now() + 7 * 86_400_000])(
    "omits invalid retry metadata %s",
    (resetTime) => {
      const result = serializeGenerationError({
        status: 429,
        retryAfterSeconds: Infinity,
        apiResponse: { resetTime },
      });
      expect(result).not.toHaveProperty("resetTime");
      expect(result).not.toHaveProperty("retryAfterSeconds");
    },
  );
  it("projects only the allowed reason and question ordinals from a grounding rejection", () => {
    const result = serializeGenerationError({
      status: 422,
      code: "GROUNDING_PROFILE_INCOMPLETE",
      apiResponse: {
        evidenceGap: {
          reason: "missing_reviewed_facts",
          questionNumbers: [2, 4],
          excerpt: "private text",
        },
      },
    });
    expect(result.evidenceGap).toEqual({
      reason: "missing_reviewed_facts",
      questionNumbers: [2, 4],
    });
  });

  it.each([
    { reason: "missing_reviewed_facts", questionNumbers: [] },
    { reason: "missing_reviewed_facts", questionNumbers: [0, 6] },
    { reason: "missing_reviewed_facts", questionNumbers: ["4"] },
    { reason: "incomplete_answer", questionNumbers: [1, 1] },
    { reason: "incomplete_answer", questionNumbers: [2, 1] },
    { reason: "incomplete_answer", questionNumbers: [1.5] },
    { reason: "shared_coverage", questionNumbers: [4] },
    { reason: "private text", questionNumbers: [4] },
  ])("drops invalid application diagnostics %#", (evidenceGap) => {
    expect(
      serializeGenerationError({
        status: 422,
        code: "INSUFFICIENT_GROUNDING",
        apiResponse: { evidenceGap },
      }),
    ).not.toHaveProperty("evidenceGap");
  });
  it.each([
    { status: 503, code: "INSUFFICIENT_GROUNDING" },
    { status: 422, code: "EVIDENCE_SELECTION_UNAVAILABLE" },
  ])("drops diagnostics on other failure contracts %#", (error) => {
    expect(
      serializeGenerationError({
        ...error,
        apiResponse: { evidenceGap: { reason: "shared_coverage" } },
      }),
    ).not.toHaveProperty("evidenceGap");
  });

  it("does not add legacy style examples to a strict YC request", () => {
    expect(
      buildGenerationRequestData(
        {
          category: "yc_application",
          jd: "A sufficiently detailed job description for the application workflow.",
          question: "Why are you a strong candidate?",
        },
        ["legacy example"],
      ),
    ).toEqual({
      category: "yc_application",
      jd: "A sufficiently detailed job description for the application workflow.",
      question: "Why are you a strong candidate?",
    });
  });

  it("keeps style examples on legacy requests", () => {
    expect(
      buildGenerationRequestData(
        { category: "cold_email", profileMarkdown: "profile" },
        ["legacy example"],
      ),
    ).toEqual({
      category: "cold_email",
      profileMarkdown: "profile",
      acceptedExamples: ["legacy example"],
    });
  });

  it("preserves profile-readiness details across the runtime boundary", () => {
    const error = Object.assign(new Error("HTTP 422"), {
      status: 422,
      code: "GROUNDING_PROFILE_INCOMPLETE",
      apiResponse: {
        error: "Candidate profile incomplete",
        message: "Add current role and measurable achievements.",
        missingFields: ["Current role"],
        recommendedFields: ["Most difficult project"],
        applicationProfileUrl: "https://www.aletheia.live/profile/application",
      },
    });

    expect(serializeGenerationError(error)).toEqual({
      success: false,
      error: "Candidate profile incomplete",
      message: "Add current role and measurable achievements.",
      status: 422,
      code: "GROUNDING_PROFILE_INCOMPLETE",
      missingFields: ["Current role"],
      recommendedFields: ["Most difficult project"],
      applicationProfileUrl: "https://www.aletheia.live/profile/application",
    });
  });

  it("preserves a stable auth-recovery cause without exposing credentials", () => {
    const error = Object.assign(new Error("AUTH_REQUIRED: reconnect"), {
      status: 401,
      code: "AUTH_REQUIRED",
      authCause: "SESSION_UNAVAILABLE",
    });

    expect(serializeGenerationError(error)).toEqual({
      success: false,
      error: "AUTH_REQUIRED: reconnect",
      message: "AUTH_REQUIRED: reconnect",
      status: 401,
      code: "AUTH_REQUIRED",
      cause: "SESSION_UNAVAILABLE",
    });
  });

  it("preserves the server request ID across failed generation responses", () => {
    const error = Object.assign(new Error("HTTP 500"), {
      status: 500,
      code: "GENERATION_FAILED",
      requestId: "123e4567-e89b-42d3-a456-426614174000",
    });

    expect(serializeGenerationError(error)).toMatchObject({
      success: false,
      status: 500,
      code: "GENERATION_FAILED",
      requestId: "123e4567-e89b-42d3-a456-426614174000",
    });
  });

  it("preserves pending daily-slot restoration on an admission denial", () => {
    const error = Object.assign(new Error("Generation limit reached"), {
      status: 429,
      apiResponse: {
        code: "GENERATION_IN_PROGRESS",
        message: "Another draft is in progress.",
        quotaRestoration: "pending_review",
      },
    });
    expect(serializeGenerationError(error)).toMatchObject({
      status: 429,
      quotaRestoration: "pending_review",
    });
  });
});
