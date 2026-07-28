import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureRouterTransitionStart: vi.fn(),
  init: vi.fn(),
  replayIntegration: vi.fn(() => ({ name: "Replay" })),
}));

vi.mock("@sentry/nextjs", () => sentryMocks);

describe("browser Sentry instrumentation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not initialize browser reporting unless it is explicitly enabled", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SENTRY_DSN",
      "https://public@example.ingest.sentry.io/1",
    );
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ERROR_REPORTING", "");

    await import("./instrumentation-client");

    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it("uses the public DSN, replay privacy controls, and shared scrubbers", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ERROR_REPORTING", "true");
    vi.stubEnv(
      "NEXT_PUBLIC_SENTRY_DSN",
      "https://public@example.ingest.sentry.io/1",
    );
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "test");
    vi.stubEnv("NODE_ENV", "production");

    await import("./instrumentation-client");

    expect(sentryMocks.replayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    });
    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@example.ingest.sentry.io/1",
        environment: "test",
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1,
        sendDefaultPii: false,
        beforeSend: expect.any(Function),
        beforeBreadcrumb: expect.any(Function),
      }),
    );
  });
});
