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
                content: "Synthetic complete fact.",
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
