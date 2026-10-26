import { afterEach, expect, it, vi } from "vitest";
import { startGenerationAttempt } from "./extension-generate.repository";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("rejects a stale real-SDK admission response after a newer lease can be admitted", async () => {
  let time = 0;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  let resolveFirst!: (_response: Response) => void;
  let firstStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    firstStarted = resolve;
  });
  let calls = 0;
  const signals: unknown[] = [];
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    signals.push(init.signal);
    if (++calls === 1) {
      firstStarted();
      return new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      });
    }
    return Response.json([
      { allowed: true, attempt_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    ]);
  });
  const first = startGenerationAttempt(
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    1,
  );
  await started;
  time = 181_000;
  expect(
    await startGenerationAttempt(
      "11111111-1111-4111-8111-111111111111",
      "33333333-3333-4333-8333-333333333333",
      1,
    ),
  ).toMatchObject({ allowed: true });
  resolveFirst(
    Response.json([
      { allowed: true, attempt_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    ]),
  );
  expect(await first).toEqual({ allowed: false, unavailable: true });
  expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
});

it("propagates an admission abort through the actual Supabase transport and fails closed", async () => {
  const realTimeout = AbortSignal.timeout.bind(AbortSignal);
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockImplementation(() => realTimeout(10));
  vi.stubGlobal(
    "fetch",
    async (_url: unknown, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  const response = startGenerationAttempt(
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    1,
  );
  await expect(
    Promise.race([
      response,
      new Promise((resolve) => setTimeout(() => resolve("unbounded"), 100)),
    ]),
  ).resolves.toEqual({ allowed: false, unavailable: true });
  expect(timeout).toHaveBeenCalledWith(10_000);
});
