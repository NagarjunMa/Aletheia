import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateRequestSchema } from "./schema";
import {
  countWords,
  truncateToWordLimit,
  extractSubjectFromText,
  extractBodyFromText,
  stripMarkdownCodeFences,
} from "./utils";
import { POST } from "./route";
import { makeRequest } from "@/__tests__/helpers/request";
import { getCorsHeaders } from "@/lib/cors";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockAuthGetUser = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() =>
  vi.fn(() => ({
    select: mockSelect,
  })),
);
const mockAnthropicCreate = vi.hoisted(() => vi.fn());

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@anthropic-ai/sdk", () => {
  const AnthropicMock = vi.fn();
  AnthropicMock.prototype.messages = {
    create: mockAnthropicCreate,
  };
  // @ts-ignore
  AnthropicMock.APIError = class APIError extends Error {
    status: number;
    constructor(status: number, error: any, message: string, _headers: any) {
      super(message);
      this.status = status;
    }
  };
  return { default: AnthropicMock };
});

vi.mock("@/lib/cors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cors")>();
  return {
    ...actual,
    getCorsHeaders: vi.fn(actual.getCorsHeaders),
  };
});

vi.mock("@/lib/ai/sanitizer", () => ({
  sanitizeForLinkedIn: vi.fn().mockImplementation(async (content) => ({
    success: true,
    sanitizedContent: content,
    isAIGenerated: false,
  })),
  stripSurrogates: vi.fn((str) => str),
}));

// Setup mock chain
mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });

beforeEach(() => {
  mockAuthGetUser.mockReset();
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockEq.mockClear();
  mockMaybeSingle.mockReset();
  mockRpc.mockReset();
  mockAnthropicCreate.mockReset();
  vi.mocked(getCorsHeaders).mockClear();

  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: "test-user-id" } },
    error: null,
  });
  // Happy path rate limit
  mockRpc.mockResolvedValue({
    data: [{ allowed: true, remaining: 29, reset_time: Date.now() + 86400000 }],
    error: null,
  });
  // Default no preferences
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  // Happy path claude response
  mockAnthropicCreate.mockResolvedValue({
    content: [
      {
        type: "text",
        text: '{"subject_line":"Hey","body":"Testing 123","word_count":2}',
      },
    ],
    usage: { input_tokens: 10, output_tokens: 20 },
  });
});

const validPayload = {
  profileMarkdown:
    "# Jane Doe\nSoftware Engineer at Acme Corp\nSan Francisco, CA",
  profileUrl: "https://linkedin.com/in/janedoe",
  category: "linkedin_connection",
};

describe("generateRequestSchema", () => {
  it("parses a minimal valid payload", () => {
    const result = generateRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("parses a full valid payload", () => {
    const result = generateRequestSchema.safeParse({
      profileMarkdown:
        "# Jane Doe\nSenior Engineer at Acme\nSan Francisco, CA\n\nPassionate about building things.",
      profileUrl: "https://linkedin.com/in/janedoe",
      resume: "My resume content here.",
      jd: "Job description here.",
      category: "cold_email",
      intent: "referral",
      acceptedExamples: ["Example message 1"],
    });
    expect(result.success).toBe(true);
  });

  it("fails when profileMarkdown is too short (min 10 chars)", () => {
    const result = generateRequestSchema.safeParse({
      profileMarkdown: "short",
      profileUrl: "https://linkedin.com/in/janedoe",
      category: "linkedin_connection",
    });
    expect(result.success).toBe(false);
  });

  it("fails when profileUrl is not a valid URL", () => {
    const result = generateRequestSchema.safeParse({
      profileMarkdown: "# Jane Doe\nSoftware Engineer",
      profileUrl: "not-a-url",
      category: "linkedin_connection",
    });
    expect(result.success).toBe(false);
  });

  it("fails when category is invalid", () => {
    const result = generateRequestSchema.safeParse({
      ...validPayload,
      category: "instagram_post",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid category values", () => {
    for (const category of [
      "linkedin_connection",
      "cold_email",
      "linkedin_inmail",
    ]) {
      expect(
        generateRequestSchema.safeParse({ ...validPayload, category }).success,
      ).toBe(true);
    }
  });

  it("accepts all valid intent values", () => {
    for (const intent of [
      "networking",
      "referral",
      "mentorship",
      "job_inquiry",
    ]) {
      expect(
        generateRequestSchema.safeParse({ ...validPayload, intent }).success,
      ).toBe(true);
    }
  });

  it("fails when intent is invalid", () => {
    const result = generateRequestSchema.safeParse({
      ...validPayload,
      intent: "cold_call",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null resume (optional)", () => {
    const result = generateRequestSchema.safeParse({
      ...validPayload,
      resume: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts null jd (optional)", () => {
    const result = generateRequestSchema.safeParse({
      ...validPayload,
      jd: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty acceptedExamples array", () => {
    const result = generateRequestSchema.safeParse({
      ...validPayload,
      acceptedExamples: [],
    });
    expect(result.success).toBe(true);
  });

  it("fails when profileMarkdown is missing entirely", () => {
    const result = generateRequestSchema.safeParse({
      profileUrl: "https://linkedin.com/in/janedoe",
      category: "linkedin_connection",
    });
    expect(result.success).toBe(false);
  });
});

describe("Utility Functions", () => {
  describe("countWords", () => {
    it("returns 0 for empty string", () => {
      expect(countWords("")).toBe(0);
      expect(countWords("   ")).toBe(0);
    });
    it("correctly counts words separated by spaces, tabs, and newlines", () => {
      expect(countWords("hello world")).toBe(2);
      expect(countWords("hello \t world \n testing")).toBe(3);
    });
  });

  describe("truncateToWordLimit", () => {
    it("returns the same string if limit is not exceeded", () => {
      expect(truncateToWordLimit("hello world", 5)).toBe("hello world");
      expect(truncateToWordLimit("hello world", 2)).toBe("hello world");
    });
    it("truncates to exact word count", () => {
      expect(truncateToWordLimit("one two three four five", 3)).toBe(
        "one two three",
      );
    });
  });

  describe("extractSubjectFromText", () => {
    it("extracts subject when prefix exists", () => {
      expect(extractSubjectFromText("Subject: Hey there\nBody goes here")).toBe(
        "Hey there",
      );
      expect(extractSubjectFromText("SUBJECT: Hey there")).toBe("Hey there");
    });
    it("falls back to the first line if no Subject prefix is found", () => {
      expect(
        extractSubjectFromText("First line is subject\nSecond is body"),
      ).toBe("First line is subject");
    });
    it("returns a default string if content is completely empty", () => {
      expect(extractSubjectFromText("")).toBe("Quick connect");
    });
  });

  describe("extractBodyFromText", () => {
    it("removes the subject line and its trailing newline", () => {
      expect(
        extractBodyFromText("Subject: Hey there\nBody goes here\nAnd here"),
      ).toBe("Body goes here\nAnd here");
    });
    it("returns the whole text if no subject line exists", () => {
      expect(extractBodyFromText("Body goes here\nAnd here")).toBe(
        "Body goes here\nAnd here",
      );
    });
  });

  describe("stripMarkdownCodeFences", () => {
    it("removes triple backtick fences at start and end", () => {
      expect(stripMarkdownCodeFences("```\nHello\n```")).toBe("Hello");
    });
    it("removes fences with a language identifier", () => {
      expect(stripMarkdownCodeFences('```json\n{"hello":"world"}\n```')).toBe(
        '{"hello":"world"}',
      );
    });
    it("leaves content unaffected if not properly fenced", () => {
      expect(stripMarkdownCodeFences("Hello\n```")).toBe("Hello\n```");
      expect(stripMarkdownCodeFences("```hello")).toBe("```hello");
    });
  });
});

describe("POST /api/extension/generate", () => {
  it("returns 401 when no auth token is provided", async () => {
    const res = await POST(makeRequest({ method: "POST", headers: {} }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { allowed: false, remaining: 0, reset_time: Date.now() + 86400000 },
      ],
      error: null,
    });

    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Daily limit reached");
  });

  it("returns 500 when Anthropic fails or returns no content", async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [],
      usage: { input_tokens: 0, output_tokens: 0 },
    });

    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to generate content");
  });

  it("correctly parses markdown json wrapped in fences", async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: '```json\n{"subject_line":"Mock Subject","body":"Mock Body"}\n```',
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const testPayload = { ...validPayload, category: "cold_email" };
    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: testPayload,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subject_line).toBe("Mock Subject");
    expect(body.body).toBe("Mock Body");
  });

  it("handles linkedin_connection and truncates long text", async () => {
    const longContent = "First sentence here. " + "x".repeat(280) + ".";
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: longContent }],
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const testPayload = { ...validPayload, category: "linkedin_connection" };
    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: testPayload,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.body.length).toBeLessThanOrEqual(300);
    expect(body.body.endsWith(".")).toBe(true);
    expect(body.validation.truncated).toBe(true);
  });

  it("returns 400 on Zod validation failure (bad payload)", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: { bad: "data" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 500 when Anthropic throws APIError status 401", async () => {
    mockAnthropicCreate.mockRejectedValueOnce(
      new (await import("@anthropic-ai/sdk")).default.APIError(
        401,
        {},
        "auth failed",
        {},
      ),
    );

    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Anthropic API authentication failed");
  });

  it("returns 429 when Anthropic throws APIError status 429", async () => {
    mockAnthropicCreate.mockRejectedValueOnce(
      new (await import("@anthropic-ai/sdk")).default.APIError(
        429,
        {},
        "rate limit",
        {},
      ),
    );

    const res = await POST(
      makeRequest({
        method: "POST",
        headers: { authorization: "Bearer test" },
        body: validPayload,
      }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Rate limit exceeded, please try again later");
  });
});

describe("GET /api/extension/generate", () => {
  it("returns 401 when no auth token is provided", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest({ method: "GET", headers: {} }));
    expect(res.status).toBe(401);
  });

  it("returns 200 health status when valid auth provided", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest({ method: "GET", headers: { authorization: "Bearer test" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });

  it("returns 500 when error happens", async () => {
    mockAuthGetUser.mockRejectedValueOnce(new Error("Internal DB Error"));
    const { GET } = await import("./route");
    const res = await GET(
      makeRequest({ method: "GET", headers: { authorization: "Bearer test" } }),
    );
    expect(res.status).toBe(500);
  });
});

describe("OPTIONS /api/extension/generate", () => {
  it("returns 200 with CORS headers", async () => {
    const { OPTIONS } = await import("./route");
    const res = await OPTIONS(makeRequest({ method: "OPTIONS" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });
});
