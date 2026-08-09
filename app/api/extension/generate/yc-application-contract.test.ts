import { describe, expect, it } from "vitest";
import goldenCases from "@/lib/ai/evals/yc-application-golden-cases.json";
import { CURRENT_EXTENSION_API_VERSION } from "@/lib/extension-contract";
import {
  DEFAULT_YC_APPLICATION_QUESTION,
  generateRequestContractSchema,
  generateRequestSchema,
  YC_APPLICATION_ERROR_CONTRACTS,
  YC_APPLICATION_JOB_DESCRIPTION_MAX_CHARS,
  YC_APPLICATION_JOB_DESCRIPTION_MIN_CHARS,
  YC_APPLICATION_MAX_WORDS,
  YC_APPLICATION_MIN_WORDS,
  YC_APPLICATION_QUESTION_MAX_CHARS,
  YC_APPLICATION_QUESTION_MIN_CHARS,
  ycApplicationGenerationResultSchema,
  ycApplicationPublicSuccessSchema,
  ycApplicationReadinessFailureSchema,
} from "./schema";

const validJobDescription = `Founding software engineer at an early-stage AI company. Build and operate TypeScript services, ship product experiments with customers, improve observability, and own features from ambiguous requirements through reliable production delivery.`;

const legacyPayload = {
  profileMarkdown: "# Jane Doe\nSenior Software Engineer at Acme\nNew York, NY",
  profileUrl: "https://linkedin.com/in/janedoe",
  resume: "Server and product engineering experience.",
  jd: "Existing optional target context.",
  conversationContext: "Existing conversation context.",
  intent: "referral" as const,
  emailMode: "founder_ceo_outreach" as const,
  acceptedExamples: ["A concise accepted example."],
};

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `proof${index + 1}`).join(
    " ",
  );
}

function validPublicSuccess(body = words(YC_APPLICATION_MIN_WORDS)) {
  return {
    success: true,
    category: "yc_application",
    body,
    word_count: body.split(/\s+/u).length,
    character_count: body.length,
    usage: { input_tokens: 1200, output_tokens: 140 },
    processingTime: 1250,
    evalMetadata: {
      generationId: "3f9c84b8-8db6-43b4-aedd-445f3d509bab",
      promptVersion: "yc-1.0.0",
      model: "claude-sonnet-4-6",
      category: "yc_application",
      generationTimeMs: 1250,
      inputTokens: 1200,
      outputTokens: 140,
      profileFieldCount: 4,
      confirmedEvidenceCount: 2,
      resumeSource: "user_resumes",
      injectionTriggered: false,
      groundingValidationPassed: true,
    },
    billingMode: "credits",
    creditCost: 4,
    creditsRemaining: 36,
  };
}

describe("YC application request contract", () => {
  it("keeps the additive category on extension API v1", () => {
    expect(CURRENT_EXTENSION_API_VERSION).toBe("1");
  });

  it("does not activate YC in the production parser before API dispatch exists", () => {
    expect(
      generateRequestSchema.safeParse({
        category: "yc_application",
        jd: validJobDescription,
      }).success,
    ).toBe(false);
  });

  it("accepts a page-independent YC request and resolves the default question", () => {
    const parsed = generateRequestContractSchema.parse({
      category: "yc_application",
      jd: validJobDescription,
    });

    expect(parsed).toEqual({
      category: "yc_application",
      jd: validJobDescription,
      question: DEFAULT_YC_APPLICATION_QUESTION,
    });
    expect(parsed).not.toHaveProperty("profileMarkdown");
    expect(parsed).not.toHaveProperty("profileUrl");
  });

  it("normalizes Unicode, line endings, and surrounding whitespace", () => {
    const parsed = generateRequestContractSchema.parse({
      category: "yc_application",
      jd: `  ${validJobDescription.replaceAll("AI", "ＡＩ")}\r\n  `,
      question: "  Why does this candidate fit the role?\r\n",
    });

    expect(parsed.category).toBe("yc_application");
    if (parsed.category !== "yc_application") {
      throw new Error("Expected the YC application request branch");
    }
    expect(parsed.jd).toBe(validJobDescription);
    expect(parsed.question).toBe("Why does this candidate fit the role?");
  });

  it("requires a bounded job description", () => {
    expect(
      generateRequestContractSchema.safeParse({
        category: "yc_application",
      }).success,
    ).toBe(false);
    expect(
      generateRequestContractSchema.safeParse({
        category: "yc_application",
        jd: "x".repeat(YC_APPLICATION_JOB_DESCRIPTION_MIN_CHARS - 1),
      }).success,
    ).toBe(false);
    expect(
      generateRequestContractSchema.safeParse({
        category: "yc_application",
        jd: "x".repeat(YC_APPLICATION_JOB_DESCRIPTION_MAX_CHARS + 1),
      }).success,
    ).toBe(false);
  });

  it("requires a bounded resolved question when one is supplied", () => {
    expect(
      generateRequestContractSchema.safeParse({
        category: "yc_application",
        jd: validJobDescription,
        question: "x".repeat(YC_APPLICATION_QUESTION_MIN_CHARS - 1),
      }).success,
    ).toBe(false);
    expect(
      generateRequestContractSchema.safeParse({
        category: "yc_application",
        jd: validJobDescription,
        question: "x".repeat(YC_APPLICATION_QUESTION_MAX_CHARS + 1),
      }).success,
    ).toBe(false);
  });

  it.each([
    ["profileMarkdown", "# LinkedIn profile content"],
    ["profileUrl", "https://linkedin.com/in/example"],
    ["resume", "Request-owned resume"],
    ["conversationContext", "Previous messages"],
    ["emailMode", "initial_outreach"],
    ["jobDescription", validJobDescription],
  ])("rejects YC-only unknown or legacy field %s", (field, value) => {
    expect(
      generateRequestContractSchema.safeParse({
        category: "yc_application",
        jd: validJobDescription,
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it.each(["linkedin_connection", "cold_email", "linkedin_inmail"] as const)(
    "preserves the parsed %s request byte-for-byte",
    (category) => {
      const payload = { ...legacyPayload, category };
      expect(generateRequestContractSchema.parse(payload)).toEqual(
        generateRequestSchema.parse(payload),
      );
    },
  );
});

describe("YC application success and provenance contracts", () => {
  it.each([YC_APPLICATION_MIN_WORDS, YC_APPLICATION_MAX_WORDS])(
    "accepts a public response at the %s-word boundary",
    (wordCount) => {
      expect(
        ycApplicationPublicSuccessSchema.safeParse(
          validPublicSuccess(words(wordCount)),
        ).success,
      ).toBe(true);
    },
  );

  it.each([YC_APPLICATION_MIN_WORDS - 1, YC_APPLICATION_MAX_WORDS + 1])(
    "rejects a public response with %s words",
    (wordCount) => {
      expect(
        ycApplicationPublicSuccessSchema.safeParse(
          validPublicSuccess(words(wordCount)),
        ).success,
      ).toBe(false);
    },
  );

  it("rejects mismatched word and character counts", () => {
    const response = validPublicSuccess();
    expect(
      ycApplicationPublicSuccessSchema.safeParse({
        ...response,
        word_count: response.word_count + 1,
      }).success,
    ).toBe(false);
    expect(
      ycApplicationPublicSuccessSchema.safeParse({
        ...response,
        character_count: response.character_count + 1,
      }).success,
    ).toBe(false);
  });

  it("keeps the claim ledger out of the public response", () => {
    expect(
      ycApplicationPublicSuccessSchema.safeParse({
        ...validPublicSuccess(),
        provenance: { selectedSourceIds: ["profile.current_role"] },
      }).success,
    ).toBe(false);
  });

  it("validates server-only claim provenance against selected source IDs", () => {
    const response = validPublicSuccess();
    expect(
      ycApplicationGenerationResultSchema.safeParse({
        response,
        provenance: {
          generationId: response.evalMetadata.generationId,
          selectedSourceIds: [
            "profile.current_role",
            "evidence:7cd202f6-7669-4bd3-9658-9794b8675978",
          ],
          claims: [
            {
              text: "Owned production delivery for an AI product.",
              sourceIds: ["evidence:7cd202f6-7669-4bd3-9658-9794b8675978"],
            },
          ],
          excludedClaimCount: 1,
        },
      }).success,
    ).toBe(true);

    expect(
      ycApplicationGenerationResultSchema.safeParse({
        response,
        provenance: {
          generationId: response.evalMetadata.generationId,
          selectedSourceIds: ["profile.current_role"],
          claims: [
            {
              text: "Unsupported production claim.",
              sourceIds: ["evidence:7cd202f6-7669-4bd3-9658-9794b8675978"],
            },
          ],
          excludedClaimCount: 0,
        },
      }).success,
    ).toBe(false);
  });
});

describe("YC application stable error contract", () => {
  it("freezes status and billing behavior for every error code", () => {
    expect(YC_APPLICATION_ERROR_CONTRACTS).toEqual({
      INVALID_REQUEST: { status: 400, billing: "none" },
      INVALID_EXTENSION_VERSION: { status: 400, billing: "none" },
      UNAUTHORIZED: { status: 401, billing: "none" },
      INSUFFICIENT_CREDITS: { status: 402, billing: "none" },
      GROUNDING_PROFILE_INCOMPLETE: { status: 422, billing: "none" },
      API_VERSION_UNSUPPORTED: { status: 426, billing: "none" },
      EXTENSION_UPDATE_REQUIRED: { status: 426, billing: "none" },
      DAILY_LIMIT_REACHED: { status: 429, billing: "none" },
      YC_OUTPUT_INVALID: { status: 502, billing: "refunded" },
      MODEL_UPSTREAM_ERROR: { status: 502, billing: "refunded" },
      MODEL_TIMEOUT: { status: 504, billing: "refunded" },
    });
  });

  it("freezes a privacy-safe, non-billable profile-readiness response", () => {
    expect(
      ycApplicationReadinessFailureSchema.safeParse({
        success: false,
        error: "Candidate profile incomplete",
        code: "GROUNDING_PROFILE_INCOMPLETE",
        message:
          "Add a current role and one confirmed evidence story before generating.",
        missingFields: ["current_role", "confirmed_evidence"],
        recommendedFields: ["startup_motivation"],
        applicationProfileUrl: "https://www.aletheia.live/profile/application",
        billing: "none",
      }).success,
    ).toBe(true);

    expect(
      ycApplicationReadinessFailureSchema.safeParse({
        success: false,
        error: "Candidate profile incomplete",
        code: "GROUNDING_PROFILE_INCOMPLETE",
        message: "The candidate worked at Secret Company.",
        missingFields: [],
        recommendedFields: [],
        applicationProfileUrl: "https://www.aletheia.live/profile/application",
        billing: "none",
        candidateContext: "raw private profile",
      }).success,
    ).toBe(false);
  });
});

describe("YC application representative golden fixtures", () => {
  it("defines contract-valid, server-grounded scenarios before prompting", () => {
    const supportedEvidenceKinds = new Set([
      "achievement",
      "technical_project",
      "ambiguity",
      "speed_to_production",
      "leadership",
      "cross_functional",
      "ai_usage",
      "production_scale",
    ]);

    expect(goldenCases).toHaveLength(4);
    expect(new Set(goldenCases.map((fixture) => fixture.id)).size).toBe(4);

    for (const fixture of goldenCases) {
      expect(
        generateRequestContractSchema.safeParse(fixture.request).success,
      ).toBe(true);
      expect(fixture.candidateContext.confirmedEvidence.length).toBeGreaterThan(
        0,
      );
      for (const evidence of fixture.candidateContext.confirmedEvidence) {
        expect(supportedEvidenceKinds.has(evidence.kind)).toBe(true);
      }
      expect(fixture.expectations.minWords).toBe(YC_APPLICATION_MIN_WORDS);
      expect(fixture.expectations.maxWords).toBe(YC_APPLICATION_MAX_WORDS);
      expect(fixture.expectations.requiredSourceIds.length).toBeGreaterThan(0);
    }
  });
});
