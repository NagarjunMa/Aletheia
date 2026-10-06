import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { MessageFocusUnavailableResponse } from "../domain/extension-generate.types";
import { getCorsHeaders } from "@/lib/cors";
import {
  getExtensionContractResponseHeaders,
  type ExtensionContractResult,
} from "@/lib/extension-contract";

export function createGenerateCorsHeaders(request: NextRequest) {
  return {
    ...getCorsHeaders(request, {
      allowCredentials: true,
      methods: "GET, POST, OPTIONS",
    }),
    ...getExtensionContractResponseHeaders(),
  };
}

export function createRateLimitHeaders(rateLimit: {
  remainingRequests: number;
  resetTime: number;
  dailyLimit: number;
}) {
  return {
    "X-RateLimit-Limit": String(rateLimit.dailyLimit),
    "X-RateLimit-Remaining": String(rateLimit.remainingRequests),
    "X-RateLimit-Reset": String(rateLimit.resetTime),
  };
}

export function toZodErrorDetails(error: z.ZodError) {
  return error.errors.map((entry) => ({
    field: entry.path.join("."),
    message: entry.message,
  }));
}

export function contractFailureResponse(
  contract: Extract<ExtensionContractResult, { compatible: false }>,
  headers: Record<string, string>,
) {
  return NextResponse.json(contract.body, {
    status: contract.status,
    headers,
  });
}

export function candidateContextUnavailableResponse(
  headers: Record<string, string>,
) {
  return NextResponse.json(
    {
      success: false,
      error: "Candidate context is temporarily unavailable",
      code: "CANDIDATE_CONTEXT_UNAVAILABLE",
    },
    { status: 503, headers },
  );
}

export function messageFocusUnavailableResponse(
  headers: Record<string, string>,
) {
  return NextResponse.json<MessageFocusUnavailableResponse>(
    {
      success: false,
      error: "Message focus is not available yet",
      code: "MESSAGE_FOCUS_UNAVAILABLE",
      message: "Clear Message focus to use automatic generation.",
    },
    { status: 409, headers },
  );
}
