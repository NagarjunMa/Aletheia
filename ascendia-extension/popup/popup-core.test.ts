import { describe, it, expect } from "vitest";
import {
  isPersonalUsageReminderReached,
  DEFAULT_YC_APPLICATION_QUESTION,
  buildApplicationAuthDraft,
  readApplicationAuthDraft,
  parseGenerationResponse,
  getGroundingStatusPresentation,
  selectApplicationQuestions,
  projectApplicationSlots,
  skippableApplicationQuestions,
  calculateCharCount,
  buildGeneratePayload,
  getCategoryUiState,
  getGenerationErrorPresentation,
  getApplicationEvidenceGuidance,
  isAuthError,
  validateGenerationInput,
} from "./popup-core.js";

describe("application skip mappings", () => {
  const first = "Describe your production project.";
  const second = "Describe your unrelated trial.";
  const third = "Describe how you evaluated the result.";
  const draft = selectApplicationQuestions(
    [first, second, third].join("\n"),
    new Set([2]),
  );
  const response = {
    status: 422,
    code: "INSUFFICIENT_GROUNDING",
    evidenceGap: { reason: "incomplete_answer", questionNumbers: [2] },
  };

  it("uses only reliable, in-range ordinals from the submitted subset", () => {
    expect(draft.questions).toEqual([first, third]);
    expect(skippableApplicationQuestions(response, draft.ordinals)).toEqual([
      3,
    ]);
    for (const evidenceGap of [
      null,
      { reason: "shared_coverage" },
      { reason: "incomplete_answer", questionNumbers: [3] },
      { reason: "incomplete_answer", questionNumbers: [1, 1] },
    ]) {
      expect(
        skippableApplicationQuestions(
          { ...response, evidenceGap },
          draft.ordinals,
        ),
      ).toEqual([]);
    }
  });

  it("rejects missing, misnumbered and mismatched answer mappings", () => {
    const one = { questionId: "q1", question: first };
    const two = { questionId: "q2", question: third };
    expect(projectApplicationSlots(draft, [one, two])).toEqual([
      { ordinal: 1, question: first, answer: one },
      { ordinal: 2, question: second, answer: undefined },
      { ordinal: 3, question: third, answer: two },
    ]);
    for (const answers of [
      undefined,
      [one],
      [one, { ...two, question: second }],
      [one, { ...two, questionId: "q3" }],
    ]) {
      expect(() => projectApplicationSlots(draft, answers)).toThrow(
        /submitted questions/u,
      );
    }
  });
});

describe("personal usage reminder", () => {
  it("reflects a configured threshold without blocking the server request", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(
      isPersonalUsageReminderReached({ [today]: 30 }, { maxDailyUsage: 50 }),
    ).toBe(false);
    expect(
      isPersonalUsageReminderReached({ [today]: 50 }, { maxDailyUsage: 50 }),
    ).toBe(true);
  });

  it("defaults to a reminder at 30 UTC-day drafts", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(isPersonalUsageReminderReached({ [today]: 29 }, {})).toBe(false);
    expect(isPersonalUsageReminderReached({ [today]: 30 }, {})).toBe(true);
  });
});

describe("grounding status presentation", () => {
  it.each([
    [
      "verified_evidence",
      "none",
      ["evidence"],
      1,
      "Based on reviewed evidence",
    ],
    [
      "profile_grounded",
      "no_confirmed_evidence",
      ["profile"],
      0,
      "Based on your profile",
    ],
    [
      "resume_fallback",
      "no_profile_context",
      ["resume"],
      0,
      "Based on your résumé",
    ],
    [
      "target_only",
      "candidate_context_not_used",
      [],
      0,
      "No candidate evidence used",
    ],
  ])(
    "maps the validated %s level to fixed copy",
    (level, fallback, kinds, evidence, label) => {
      expect(
        getGroundingStatusPresentation({
          success: true,
          category: "cold_email",
          body: "Hi Alex, open to connecting?",
          evalMetadata: {
            grounding: {
              groundingLevel: level,
              fallbackReason: fallback,
              selectedSourceCount: kinds.length,
              selectedEvidenceCount: evidence,
              selectedSourceKinds: kinds,
              injectionSafeMode: false,
              provenanceValidated: true,
            },
          },
        }),
      ).toEqual({ label, showProfileLink: level !== "verified_evidence" });
    },
  );
});

// ─── parseGenerationResponse ───

describe("parseGenerationResponse", () => {
  it("discards invalid grounding metadata while keeping the draft and feedback ID", () => {
    const generationId = "33333333-3333-4333-8333-333333333333";
    const draft = {
      category: "linkedin_connection",
      body: "Hi Alex, open to connecting?",
      evalMetadata: {
        generationId,
        grounding: {
          groundingLevel: "verified_evidence",
          selectedSourceIds: ["PRIVATE_REVIEW_CANARY"],
          provenanceValidated: true,
        },
      },
    };
    expect(parseGenerationResponse(draft)).toEqual({
      category: draft.category,
      body: draft.body,
      evalMetadata: { generationId },
    });
  });

  it("rejects body-only fallback for a live multi-question request", () => {
    expect(() =>
      parseGenerationResponse(
        { category: "yc_application", body: "unmapped text" },
        ["Describe your experience?", "Why are you interested?"],
      ),
    ).toThrow();
  });
  it("requires live structured answers to cover the submitted questions", () => {
    const body = Array(50).fill("experience").join(" ");
    const output = {
      category: "yc_application",
      answers: [
        {
          questionId: "q1",
          question: "Describe your experience?",
          body,
          word_count: 50,
          character_count: body.length,
        },
      ],
    };
    expect(() =>
      parseGenerationResponse(output, [
        "Describe your experience?",
        "Why are you interested?",
      ]),
    ).toThrow();
    expect(() =>
      parseGenerationResponse(output, ["A different question entirely?"]),
    ).toThrow();
    expect(
      parseGenerationResponse(output, ["Describe your experience?"]).body,
    ).toBe(body);
  });
  it("returns output unchanged for linkedin_connection", () => {
    const output = { body: "Hello!", category: "linkedin_connection" };
    const result = parseGenerationResponse(output);
    expect(result.body).toBe("Hello!");
  });

  it("extracts JSON from cold_email body", () => {
    const output = {
      body: '{"subject_line": "Hi", "body": "Hello there"}',
      category: "cold_email",
    };
    const result = parseGenerationResponse(output);
    expect(result.subject_line).toBe("Hi");
    expect(result.body).toBe("Hello there");
  });

  it("strips ```json code fences", () => {
    const output = {
      body: '```json\n{"subject_line": "Test", "body": "Content"}\n```',
      category: "cold_email",
    };
    const result = parseGenerationResponse(output);
    expect(result.subject_line).toBe("Test");
    expect(result.body).toBe("Content");
  });

  it("strips plain ``` code fences", () => {
    const output = {
      body: '```\n{"subject_line": "A", "body": "B"}\n```',
      category: "linkedin_inmail",
    };
    const result = parseGenerationResponse(output);
    expect(result.subject_line).toBe("A");
  });

  it("keeps original body when JSON parse fails", () => {
    const output = { body: "not json at all", category: "cold_email" };
    const result = parseGenerationResponse(output);
    expect(result.body).toBe("not json at all");
  });

  it("preserves existing subject_line when parsed JSON has none", () => {
    const output = {
      body: '{"body": "Hello"}',
      category: "cold_email",
      subject_line: "Original",
    };
    const result = parseGenerationResponse(output);
    expect(result.subject_line).toBe("Original");
    expect(result.body).toBe("Hello");
  });

  it("does not parse JSON for non-email categories", () => {
    const output = {
      body: '{"subject_line": "Nope", "body": "Ignored"}',
      category: "linkedin_connection",
    };
    const result = parseGenerationResponse(output);
    // Body should remain as the raw JSON string
    expect(result.body).toContain("Nope");
  });
});

// ─── calculateCharCount ───

describe("calculateCharCount", () => {
  it("linkedin_connection: at the Basic limit", () => {
    const result = calculateCharCount("x".repeat(200), "linkedin_connection");
    expect(result.count).toBe(200);
    expect(result.isOverLimit).toBe(false);
    expect(result.isNearLimit).toBe(true);
    expect(result.displayText).toBe("200/200");
  });

  it("linkedin_connection: near limit (181-200)", () => {
    const result = calculateCharCount("x".repeat(181), "linkedin_connection");
    expect(result.isNearLimit).toBe(true);
    expect(result.isOverLimit).toBe(false);
  });

  it("linkedin_connection: over limit (>200)", () => {
    const result = calculateCharCount("x".repeat(201), "linkedin_connection");
    expect(result.isOverLimit).toBe(true);
    expect(result.isNearLimit).toBe(false);
  });

  it.each([
    [300, 300, "300/300", false],
    [301, 300, "301/300", true],
    [201, 500, "201/200", true],
  ])(
    "counts %i characters against a requested limit of %i",
    (length, limit, displayText, isOverLimit) => {
      expect(
        calculateCharCount("x".repeat(length), "linkedin_connection", limit),
      ).toMatchObject({ displayText, isOverLimit });
    },
  );

  it("cold_email: over limit (>1500)", () => {
    const result = calculateCharCount("x".repeat(1600), "cold_email");
    expect(result.isOverLimit).toBe(true);
    expect(result.displayText).toBe("1600 chars");
  });

  it("linkedin_inmail: under limit", () => {
    const result = calculateCharCount("short", "linkedin_inmail");
    expect(result.isOverLimit).toBe(false);
    expect(result.displayText).toBe("5 chars");
  });

  it("unknown category: never over limit", () => {
    const result = calculateCharCount("x".repeat(5000), "unknown");
    expect(result.isOverLimit).toBe(false);
  });

  it("yc_application: reports the 50-150 word target", () => {
    const result = calculateCharCount(
      Array.from({ length: 72 }, (_, index) => `word${index}`).join(" "),
      "yc_application",
    );

    expect(result.count).toBe(72);
    expect(result.displayText).toBe("72 words · 50–150");
    expect(result.isOverLimit).toBe(false);
    expect(result.isNearLimit).toBe(false);
  });

  it("yc_application: flags answers above 150 words", () => {
    const result = calculateCharCount(
      Array.from({ length: 151 }, (_, index) => `word${index}`).join(" "),
      "yc_application",
    );

    expect(result.isOverLimit).toBe(true);
  });
});

// ─── buildGeneratePayload ───

describe("buildGeneratePayload", () => {
  it("requests the Basic composer limit only for LinkedIn connection notes", () => {
    for (const category of [
      "linkedin_connection",
      "linkedin_inmail",
      "cold_email",
    ]) {
      const payload = buildGeneratePayload(
        { profileMarkdown: "md" },
        "",
        "",
        category,
      );
      if (category === "linkedin_connection") {
        expect(payload).toHaveProperty("connectionNoteLimit", 200);
      } else {
        expect(payload).not.toHaveProperty("connectionNoteLimit");
      }
    }
  });

  it("assembles correct shape", () => {
    const profile = {
      profileMarkdown: "md",
    };
    const result = buildGeneratePayload(
      profile,
      "resume text",
      "job desc",
      "cold_email",
      "networking",
      ["ex1"],
      "role_fit_summary",
    );
    expect(result).toEqual({
      profileMarkdown: "md",
      jd: "job desc",
      conversationContext: "",
      category: "cold_email",
      intent: "networking",
      emailMode: "role_fit_summary",
      acceptedExamples: ["ex1"],
    });
  });

  it("uses the shared context textarea as conversationContext for follow-ups", () => {
    const profile = {
      profileMarkdown: "md",
    };
    const result = buildGeneratePayload(
      profile,
      "resume text",
      "Previous thread",
      "cold_email",
      "networking",
      [],
      "follow_up",
    );

    expect(result.jd).toBe("");
    expect(result.conversationContext).toBe("Previous thread");
    expect(result).not.toHaveProperty("resume");
  });

  it("defaults empty strings for missing optional fields", () => {
    const profile = { profileMarkdown: "md" };
    const result = buildGeneratePayload(
      profile,
      null,
      undefined,
      "linkedin_connection",
      "referral",
      null,
    );
    expect(result.jd).toBe("");
    expect(result.conversationContext).toBe("");
    expect(result.emailMode).toBe("initial_outreach");
    expect(result.acceptedExamples).toEqual([]);
  });

  it("builds a strict YC payload without LinkedIn or style-learning data", () => {
    const result = buildGeneratePayload(
      null,
      null,
      "  Build an AI operations product with a small team and own customer discovery through production delivery.  ",
      "yc_application",
      "networking",
      ["do not send this"],
      "initial_outreach",
      "  Why are you a great fit for this role?  ",
    );

    expect(result).toEqual({
      category: "yc_application",
      jd: "Build an AI operations product with a small team and own customer discovery through production delivery.",
      questions: ["Why are you a great fit for this role?"],
    });
    expect(result).not.toHaveProperty("profileMarkdown");
    expect(result).not.toHaveProperty("acceptedExamples");
  });

  it("ALE-37 never substitutes a default when the new question area is empty", () => {
    const result = buildGeneratePayload(
      null,
      null,
      "A sufficiently detailed job description for an early-stage product engineering role with customer ownership.",
      "yc_application",
      "networking",
      [],
      "initial_outreach",
      "",
    );

    expect(result).not.toHaveProperty("question");
    expect(result.questions).toEqual([]);
  });
});

describe("ALE-37 canonical question entry", () => {
  const jd =
    "A sufficiently detailed job description for an early-stage product engineering role with customer ownership.";
  const payload = (questionValue: string) =>
    buildGeneratePayload(
      null,
      null,
      jd,
      "yc_application",
      "networking",
      [],
      "initial_outreach",
      questionValue,
    );
  const validate = (questionValue: string) =>
    validateGenerationInput({
      category: "yc_application",
      hasProfile: false,
      contextValue: jd,
      questionValue,
    });

  it("uses non-empty lines, not periods, to identify questions", () => {
    expect(
      payload(
        "  Describe your U.S. experience. Include the result.\r\n\r\n  Explain a 2.5% improvement.  ",
      ),
    ).toEqual({
      category: "yc_application",
      jd,
      questions: [
        "Describe your U.S. experience. Include the result.",
        "Explain a 2.5% improvement.",
      ],
    });
  });

  it("keeps a multi-sentence single line as one question", () => {
    expect(
      payload("Describe a project. Explain your contribution."),
    ).toMatchObject({
      questions: ["Describe a project. Explain your contribution."],
    });
  });

  it("normalizes Unicode and preserves repeated questions as distinct entries", () => {
    expect(payload("  Why ＡＩ products?\rWhy AI products?  ")).toMatchObject({
      questions: ["Why AI products?", "Why AI products?"],
    });
  });

  it.each([
    [
      "YC",
      "\r\n",
      "What have you built?",
      "How did you find your first users?",
    ],
    [
      "Greenhouse",
      "\n\n",
      "Why are you interested in this role?",
      "Describe a project you led.",
    ],
    [
      "Ashby",
      "\n",
      "What makes this role a good fit?",
      "What did you ship in your last role?",
    ],
  ])(
    "preserves the order of questions pasted from %s",
    (_source, separator, first, second) => {
      expect(payload(`  ${first}${separator}  ${second}  `)).toMatchObject({
        questions: [first, second],
      });
    },
  );

  it.each(["", " \r\n \n "])(
    "requires application question data (%s)",
    (input) => {
      expect(validate(input)).toMatchObject({ valid: false });
    },
  );

  it("accepts five 500-character lines without applying the legacy total limit", () => {
    expect(
      validate(Array.from({ length: 5 }, () => "x".repeat(500)).join("\n")),
    ).toEqual({ valid: true });
  });

  it.each([
    ["oversized item", "x".repeat(501)],
    ["short second item", "Why this role?\nToo short"],
    [
      "six questions",
      Array.from({ length: 6 }, () => "Why this role?").join("\n"),
    ],
    ["normalized short item", "ＡＢＣＤＥＦＧＨＩ"],
  ])("rejects %s before sending", (_label, input) => {
    expect(validate(input)).toMatchObject({ valid: false });
  });

  it.each(["linkedin_connection", "cold_email", "linkedin_inmail"])(
    "ignores the question area for %s without dropping profile validation",
    (category) => {
      expect(
        validateGenerationInput({
          category,
          hasProfile: true,
          contextValue: "",
          questionValue: "",
        }),
      ).toEqual({ valid: true });
      expect(
        validateGenerationInput({
          category,
          hasProfile: false,
          contextValue: "",
          questionValue: "",
        }),
      ).toMatchObject({ valid: false });
      const result = buildGeneratePayload(
        { profileMarkdown: "Existing profile" },
        null,
        "",
        category,
        "networking",
        [],
        "initial_outreach",
        "ignored question",
      );
      expect(result).not.toHaveProperty("question");
      expect(result).not.toHaveProperty("questions");
    },
  );
});

describe("ALE-37 answer ordering and compatibility body", () => {
  const body = Array.from({ length: 50 }, () => "experience").join(" ");
  const first = {
    questionId: "q1",
    question: "Why this role?",
    body,
    word_count: 50,
    character_count: body.length,
  };
  const secondBody = Array.from({ length: 50 }, () => "delivery").join(" ");
  const second = {
    questionId: "q2",
    question: "Describe your experience?",
    body: secondBody,
    word_count: 50,
    character_count: secondBody.length,
  };

  it("orders a complete ID set and derives the body from the ordered answers", () => {
    const input = {
      category: "yc_application",
      answers: [second, first],
      body: "Stale fallback",
    };
    const result = parseGenerationResponse(input);
    expect(result.answers).toEqual([first, second]);
    expect(result.body).toBe(
      `**${first.question}**\n${first.body}\n\n**${second.question}**\n${second.body}`,
    );
    expect(input.answers).toEqual([second, first]);
  });

  it("uses the entire body for a single answer without a question heading", () => {
    expect(
      parseGenerationResponse({
        category: "yc_application",
        answers: [first],
        body: "Stale fallback",
      }).body,
    ).toBe(first.body);
  });

  it("escapes heading punctuation instead of interpreting user formatting", () => {
    const special = { ...first, question: "Why **this** role?" };
    const result = parseGenerationResponse({
      category: "yc_application",
      answers: [special, second],
      body: "Stale fallback",
    });
    expect(result.body).toBe(
      `**Why \\*\\*this\\*\\* role?**\n${first.body}\n\n**${second.question}**\n${second.body}`,
    );
  });

  it.each([
    ["empty", []],
    ["duplicate", [first, first]],
    ["missing first ID", [second]],
    ["unknown ID", [first, { ...second, questionId: "other" }]],
  ])(
    "does not use a combined body to conceal an invalid %s collection",
    (_label, answers) => {
      expect(() =>
        parseGenerationResponse({
          category: "yc_application",
          answers,
          body: first.body,
        }),
      ).toThrow();
    },
  );

  it("preserves a legacy body-only response for the existing single-answer path", () => {
    const legacy = { category: "yc_application", body: first.body };
    expect(parseGenerationResponse(legacy)).toEqual(legacy);
  });
});

describe("YC category UI and validation", () => {
  it("does not require a LinkedIn profile and exposes only YC inputs", () => {
    expect(getCategoryUiState("yc_application", "initial_outreach")).toEqual(
      expect.objectContaining({
        requiresLinkedInProfile: false,
        showIntent: false,
        showEmailMode: false,
        showQuestion: true,
        contextRequired: true,
        contextMaxLength: 20000,
        generateLabel: "Generate Answers · 4 credits",
        outputLabel: "Application Answers",
        showAutoFill: false,
      }),
    );
  });

  it.each([
    { jd: 79, question: 10, code: "YC_JOB_DESCRIPTION_TOO_SHORT" },
    { jd: 80, question: 9, code: "YC_QUESTION_TOO_SHORT" },
    { jd: 80, question: 10, code: null },
    { jd: 81, question: 11, code: null },
  ])(
    "validates normalized emoji input at JD $jd and question $question units",
    ({ jd, question, code }) => {
      const context = "😀".repeat(37) + "ﬀ" + "x".repeat(jd - 76);
      const questionText = "😀😀😀ﬀ" + "x".repeat(question - 8);
      const result = validateGenerationInput({
        category: "yc_application",
        hasProfile: false,
        contextValue: `  ${context}  `,
        questionValue: `Why this role?\r\n  ${questionText}  `,
      });
      expect(result).toMatchObject(
        code ? { valid: false, code } : { valid: true },
      );
    },
  );

  it("requires an 80-character YC job description", () => {
    expect(
      validateGenerationInput({
        category: "yc_application",
        hasProfile: false,
        contextValue: "Too short",
        questionValue: DEFAULT_YC_APPLICATION_QUESTION,
      }),
    ).toMatchObject({ valid: false, code: "YC_JOB_DESCRIPTION_TOO_SHORT" });
  });

  it("allows YC generation on a non-LinkedIn page when inputs are ready", () => {
    expect(
      validateGenerationInput({
        category: "yc_application",
        hasProfile: false,
        contextValue:
          "Build and operate an AI product with a small YC startup team while working closely with customers from idea through production.",
        questionValue: DEFAULT_YC_APPLICATION_QUESTION,
      }),
    ).toEqual({ valid: true });
  });

  it("keeps the existing LinkedIn profile requirement for legacy categories", () => {
    expect(
      validateGenerationInput({
        category: "cold_email",
        hasProfile: false,
        contextValue: "",
        questionValue: "",
      }),
    ).toMatchObject({ valid: false, code: "LINKEDIN_PROFILE_REQUIRED" });
  });
});

describe("application evidence guidance", () => {
  const response = { status: 422, code: "INSUFFICIENT_GROUNDING" };
  const submittedQuestions = (count: number | undefined) =>
    count === undefined
      ? undefined
      : Array.from(
          { length: count },
          (_, index) => `What did you verify in project ${index + 1}?`,
        );

  it.each([
    [
      { reason: "missing_reviewed_facts", questionNumbers: [1] },
      1,
      /^This question needs/u,
    ],
    [
      { reason: "missing_reviewed_facts", questionNumbers: [2, 4] },
      5,
      /^Questions 2 and 4 need/u,
    ],
    [
      { reason: "incomplete_answer", questionNumbers: [2] },
      2,
      /Question 2 needs more reviewed detail/u,
    ],
    [
      { reason: "missing_rationale", questionNumbers: [2] },
      2,
      /Question 2 needs the reason behind the decision.*problem or trade-off/u,
    ],
    [
      { reason: "shared_coverage" },
      5,
      /^The questions need distinct reviewed facts/u,
    ],
  ] as const)(
    "describes supported diagnostics %#",
    (evidenceGap, count, expected) => {
      expect(
        getApplicationEvidenceGuidance(
          { ...response, evidenceGap },
          submittedQuestions(count),
        ),
      ).toMatch(expected);
    },
  );

  it.each([
    [undefined, 5],
    [{ reason: "missing_reviewed_facts", questionNumbers: [4] }, 2],
    [{ reason: "missing_reviewed_facts", questionNumbers: [1] }, undefined],
    [{ reason: "shared_coverage" }, 1],
    [{ reason: "unrecognized" }, 5],
  ] as const)(
    "falls back for incompatible guidance %#",
    (evidenceGap, count) => {
      expect(
        getApplicationEvidenceGuidance(
          { ...response, evidenceGap },
          submittedQuestions(count),
        ),
      ).toBeUndefined();
    },
  );
});

describe("getGenerationErrorPresentation", () => {
  it("explains pending daily-slot restoration without hiding the limit", () => {
    expect(
      getGenerationErrorPresentation({
        success: false,
        code: "GENERATION_IN_PROGRESS",
        message: "Another draft is in progress.",
        quotaRestoration: "pending_review",
      }).message,
    ).toContain("Daily quota restoration is pending review");
  });
  it("turns incomplete grounding into a dashboard action", () => {
    expect(
      getGenerationErrorPresentation({
        success: false,
        error: "Candidate profile incomplete",
        code: "GROUNDING_PROFILE_INCOMPLETE",
        message: "Add more evidence before generating this answer.",
        missingFields: ["Current role", "Strongest achievements"],
        recommendedFields: ["Most difficult project"],
        applicationProfileUrl: "https://www.aletheia.live/profile/application",
      }),
    ).toEqual({
      message: "Add more evidence before generating this answer.",
      actionLabel: "Complete application profile",
      actionUrl: "https://www.aletheia.live/profile/application",
      missingFields: ["Current role", "Strongest achievements"],
      recommendedFields: ["Most difficult project"],
    });
  });

  it("turns unsupported extension versions into a store update action", () => {
    expect(
      getGenerationErrorPresentation({
        success: false,
        code: "EXTENSION_UPDATE_REQUIRED",
        message: "Update Aletheia to continue.",
        updateUrl:
          "https://chrome.google.com/webstore/detail/aletheia/pneenlhefkghefjpaafgllkjkpfjnkgg",
      }),
    ).toEqual({
      message: "Update Aletheia to continue.",
      actionLabel: "Update extension",
      actionUrl:
        "https://chrome.google.com/webstore/detail/aletheia/pneenlhefkghefjpaafgllkjkpfjnkgg",
      missingFields: [],
      recommendedFields: [],
    });
  });
});

// ─── isAuthError ───

describe("isAuthError", () => {
  it("detects auth_failed", () => {
    expect(isAuthError("AUTH_FAILED: Please log in")).toBe(true);
  });

  it("detects session expired", () => {
    expect(isAuthError("Session expired")).toBe(true);
  });

  it("detects unauthorized", () => {
    expect(isAuthError("Unauthorized")).toBe(true);
  });

  it("detects stable auth recovery codes", () => {
    expect(isAuthError("AUTH_REQUIRED: Please reconnect")).toBe(true);
    expect(isAuthError("AUTH_TIMEOUT: Sign-in timed out")).toBe(true);
    expect(isAuthError("SESSION_UNAVAILABLE")).toBe(true);
  });

  it("returns false for null/undefined", () => {
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });

  it("returns false for generic errors", () => {
    expect(isAuthError("Network error")).toBe(false);
    expect(isAuthError("Rate limit exceeded")).toBe(false);
  });
});

describe("ALE-37 authentication draft lifetime", () => {
  const draft = buildApplicationAuthDraft(
    {
      category: "yc_application",
      jd: "Unfinished job",
      questions: "Unfinished question",
      ownerId: "user-1",
    },
    1000,
  );
  it("keeps incomplete inputs through sign-in without requiring generation validity", () => {
    expect(readApplicationAuthDraft(draft, "user-1", 2000)).toMatchObject({
      jd: "Unfinished job",
      questions: "Unfinished question",
    });
  });
  it("rejects expired, future, cross-account and malformed drafts", () => {
    expect(readApplicationAuthDraft(draft, "user-2", 2000)).toBeNull();
    expect(readApplicationAuthDraft(draft, "user-1", 901000)).toBeNull();
    expect(
      readApplicationAuthDraft(
        { ...draft, expiresAt: 99999999 },
        "user-1",
        2000,
      ),
    ).toBeNull();
    expect(
      readApplicationAuthDraft({ ...draft, jd: {} }, "user-1", 2000),
    ).toBeNull();
  });
});

it("keeps safe YC quality metadata through cache/feedback while discarding private extras", async () => {
  const { projectStoredApplication, buildApplicationFeedback } =
    await import("./popup-core.js");
  const quality = {
    version: 1,
    archetype: "mixed",
    selectedSourceCount: 4,
    selectedSourceKinds: ["action"],
    groundingPassed: true,
    finalizationPatternCount: 2,
  };
  const output = {
    category: "yc_application",
    body: Array(50).fill("experience").join(" "),
    evalMetadata: {
      generationId: "33333333-3333-4333-8333-333333333333",
      quality: {
        ...quality,
        sourceId: "PRIVATE_SOURCE_CANARY",
        body: "PRIVATE_BODY_CANARY",
      },
    },
  };
  const stored = projectStoredApplication(output);
  const feedback = buildApplicationFeedback(stored, true);
  expect(feedback.evalMetadata.quality).toEqual(quality);
  expect(JSON.stringify(feedback)).not.toContain("PRIVATE");
});

it.each([
  "linkedin_connection",
  "linkedin_inmail",
  "cold_email",
  "yc_application",
])(
  "submits only selected story IDs in %s and omits an empty choice",
  (category) => {
    const storyId = "11111111-1111-4111-8111-111111111111";
    const build = (ids: string[]) =>
      buildGeneratePayload(
        { profileMarkdown: "Synthetic profile" },
        null,
        "Context",
        category,
        "networking",
        [],
        "initial_outreach",
        "What did you build?",
        ids,
      );
    expect(build([storyId]).selectedEvidenceIds).toEqual([storyId]);
    expect(build([])).not.toHaveProperty("selectedEvidenceIds");
  },
);

describe("ALE-79 LinkedIn warning presentation", () => {
  const response = {
    status: 422,
    code: "INSUFFICIENT_GROUNDING",
    message: "HTTP 422: unavailable",
    linkedinGuidance: { reason: "note_limit", connectionNoteLimit: 200 },
  };
  it("explains the selected limit without raw HTTP diagnostics", () => {
    const result = getGenerationErrorPresentation(
      response,
      undefined,
      undefined,
      "linkedin_connection",
    );
    expect(result.warningTitle).toBe("Complete fact exceeds note limit");
    expect(result.message).toContain("200-character");
    expect(result.message).toContain("300");
    expect(result.message).not.toContain("HTTP");
  });
  it.each([{ status: 503 }, { code: "UNKNOWN_ERROR" }, { status: "422" }])(
    "does not conceal unexpected failures %j",
    (override) => {
      const result = getGenerationErrorPresentation(
        { ...response, ...override },
        undefined,
        undefined,
        "linkedin_connection",
      );
      expect(result.warningTitle).toBeUndefined();
      expect(result.message).toBe(response.message);
    },
  );
  it("uses generic recovery for a legacy LinkedIn grounding denial", () => {
    const result = getGenerationErrorPresentation(
      { ...response, linkedinGuidance: undefined },
      undefined,
      undefined,
      "linkedin_connection",
    );
    expect(result.warningTitle).toBe(
      "More context or reviewed evidence needed",
    );
    expect(result.message).not.toContain("HTTP");
  });
  it("preserves credit and quota restoration guidance", () => {
    const result = getGenerationErrorPresentation(
      {
        ...response,
        billing: "refund_pending",
        quotaRestoration: "pending_review",
      },
      undefined,
      undefined,
      "linkedin_connection",
    );
    expect(result.message).toContain("Credit restoration pending");
    expect(result.message).toContain("quota restoration");
  });
  it("does not apply LinkedIn guidance to another channel", () => {
    expect(
      getGenerationErrorPresentation(
        response,
        undefined,
        undefined,
        "cold_email",
      ).warningTitle,
    ).toBeUndefined();
  });
});
