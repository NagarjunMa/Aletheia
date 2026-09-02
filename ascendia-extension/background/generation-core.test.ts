import { describe, expect, it } from "vitest";
import {
  buildGenerationRequestData,
  serializeGenerationError,
} from "./generation-core.js";

describe("generation background bridge", () => {
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
});
