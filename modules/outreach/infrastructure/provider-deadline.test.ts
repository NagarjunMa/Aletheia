import { afterEach, expect, it, vi } from "vitest";

const { transport } = vi.hoisted(() => ({ transport: vi.fn() }));
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return {
    ...actual,
    default: class extends actual.default {
      constructor(options: ConstructorParameters<typeof actual.default>[0]) {
        super({ ...options, fetch: transport });
      }
    },
  };
});
import Anthropic from "@anthropic-ai/sdk";
import { proseFixture } from "@/__tests__/helpers/prose-fixture";
import { buildProseCompositions } from "../application/prose-compositions";
import { createOutreachDraftMessage } from "./anthropic.repository";
import { createYcApplicationDraft } from "@/modules/application-answer/infrastructure/anthropic-yc.repository";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  transport.mockReset();
});

it.each(["outreach", "yc"])(
  "bounds the complete %s provider response, including a stalled body",
  async (kind) => {
    vi.stubEnv("ANTHROPIC_API_KEY", "synthetic-test-key");
    transport.mockImplementation(
      async (_url, init: RequestInit) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init.signal?.addEventListener(
                "abort",
                () =>
                  controller.error(new DOMException("aborted", "AbortError")),
                { once: true },
              );
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation(() => nativeTimeout(20));
    const result =
      kind === "outreach"
        ? createOutreachDraftMessage({
            systemPrompt: "synthetic",
            userPrompt: "synthetic",
            category: "linkedin_connection",
            atomicSources: [
              {
                id: "target.profile.0",
                scope: "target",
                kind: "target_observation",
                content: "Engineering Manager at Example | AI Evaluation",
                rewrite: "linkedin_profile_interest",
              },
            ],
            emailMode: "initial_outreach",
          })
        : createYcApplicationDraft({
            systemPrompt: "synthetic",
            userPrompt: "synthetic",
          });
    await expect(
      Promise.race([
        result,
        new Promise((resolve) =>
          setTimeout(() => resolve("unbounded body"), 150),
        ),
      ]),
    ).rejects.toBeInstanceOf(Anthropic.APIConnectionTimeoutError);
    expect(timeout).toHaveBeenCalledWith(30_000);
  },
);

it.each([
  ["linkedin_connection", 600],
  ["cold_email", 2400],
  ["linkedin_inmail", 2400],
] as const)(
  "sends the bounded %s budget through the SDK without retries",
  async (category, cap) => {
    vi.stubEnv("ANTHROPIC_API_KEY", "synthetic-test-key");
    let sent: Record<string, unknown> = {};
    transport.mockImplementation(async (_url, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return Response.json({
        id: "test",
        type: "message",
        role: "assistant",
        model: "synthetic",
        content: [],
        stop_reason: "tool_use",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    });
    await createOutreachDraftMessage({
      systemPrompt: "synthetic",
      userPrompt: "synthetic",
      category,
      ...(category !== "linkedin_connection"
        ? {
            proseCompositions: buildProseCompositions({
              category,
              emailMode: "initial_outreach",
              context: proseFixture(category, "initial_outreach").context,
            }),
          }
        : {}),
      emailMode: "initial_outreach",
      atomicSources: [
        {
          id: "target.profile.0",
          scope: "target",
          kind: "target_observation",
          content: "Engineering Manager at Example | AI Evaluation",
          rewrite: "linkedin_profile_interest",
        },
      ],
    });
    expect(sent.max_tokens).toBe(cap);
    if (category !== "linkedin_connection") {
      const tools = sent.tools as Array<{
        input_schema: {
          properties: Record<string, unknown>;
          required: string[];
          additionalProperties: boolean;
        };
      }>;
      expect(Object.keys(tools[0]!.input_schema.properties)).toEqual([
        "option_id",
      ]);
      expect(tools[0]!.input_schema.required).toEqual(["option_id"]);
      expect(tools[0]!.input_schema.additionalProperties).toBe(false);
    }
    expect(transport).toHaveBeenCalledTimes(1);
  },
);

it.each(["cold_email", "linkedin_inmail"] as const)(
  "does not contact the provider for %s without a complete option set",
  async (category) => {
    vi.stubEnv("ANTHROPIC_API_KEY", "synthetic-test-key");
    await expect(
      createOutreachDraftMessage({
        category,
        emailMode: "initial_outreach",
        systemPrompt: "synthetic",
        userPrompt: "synthetic",
        proseCompositions: [],
      }),
    ).rejects.toThrow("No complete reviewed fact combination fits");
    expect(transport).not.toHaveBeenCalled();
  },
);
