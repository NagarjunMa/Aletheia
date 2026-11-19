import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const authenticate = vi.hoisted(() => vi.fn());
const application = vi.hoisted(() => vi.fn());
const persist = vi.hoisted(() => vi.fn());
vi.mock(
  "@/modules/outreach/infrastructure/extension-generate.repository",
  async (original) => ({
    ...(await original<
      typeof import("@/modules/outreach/infrastructure/extension-generate.repository")
    >()),
    authenticateExtensionRequest: authenticate,
  }),
);
vi.mock(
  "@/modules/application-answer/application/generate-yc-application.service",
  () => ({
    generateYcApplication: application,
  }),
);
vi.mock(
  "@/modules/dashboard/infrastructure/record-generation-activity",
  () => ({
    recordGenerationActivity: persist,
  }),
);
import { POST } from "@/modules/outreach/application/extension-generate.service";
const owner = "11111111-1111-4111-8111-111111111111";
const jd =
  "Build platform tools and support production TypeScript services. ".repeat(2);
beforeEach(() => {
  vi.clearAllMocks();
  authenticate.mockResolvedValue({
    userId: owner,
    email: "synthetic@example.test",
    accessToken: "synthetic",
  });
  persist.mockResolvedValue(undefined);
  application.mockImplementation(async ({ timing, logger }) => {
    timing.enter("model");
    logger.info({ event: "provider.attempt", attempt: 1, outcome: "failure" });
    logger.info({ event: "provider.attempt", attempt: 2, outcome: "success" });
    return NextResponse.json({ success: true });
  });
});
function request(body: object) {
  return new NextRequest("https://example.test/api/extension/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-operation-id": owner },
    body: JSON.stringify(body),
  });
}
it.each([1, 5])(
  "records one HTTP request for %i application questions and counts SDK attempts",
  async (length) => {
    const body = {
      category: "yc_application",
      jd,
      questions: Array(length).fill(
        "Describe your platform engineering experience.",
      ),
    };
    expect((await POST(request(body))).status).toBe(200);
    expect(persist).toHaveBeenCalledExactlyOnceWith(
      {
        userId: owner,
        category: "yc_application",
        answerCount: length,
        providerAttempts: 2,
      },
      expect.any(String),
      200,
      expect.any(Object),
    );
    const first = persist.mock.calls[0]![1];
    await POST(request(body));
    expect(persist.mock.calls[1]![1]).not.toBe(first);
  },
);
it("records an early grounding rejection with no provider attempts", async () => {
  application.mockImplementation(async () =>
    NextResponse.json({ success: false }, { status: 422 }),
  );
  expect(
    (
      await POST(
        request({
          category: "yc_application",
          jd,
          question: "Describe your technical experience.",
        }),
      )
    ).status,
  ).toBe(422);
  expect(persist).toHaveBeenCalledWith(
    {
      userId: owner,
      category: "yc_application",
      answerCount: 1,
      providerAttempts: 0,
    },
    expect.any(String),
    422,
    expect.any(Object),
  );
});
