import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));
const createRequestLogger = vi.hoisted(() => vi.fn(() => requestLogger));

vi.mock("@/lib/logger", () => ({ createRequestLogger }));

import { withRequestLifecycle } from "./request-lifecycle";

function makeRequest() {
  return new NextRequest("http://localhost/api/example", {
    headers: { "x-request-id": "123e4567-e89b-42d3-a456-426614174000" },
  });
}

describe("withRequestLifecycle", () => {
  beforeEach(() => {
    requestLogger.info.mockReset();
    requestLogger.error.mockReset();
    createRequestLogger.mockClear();
  });

  it("preserves the response while recording one successful terminal outcome", async () => {
    const response = await withRequestLifecycle(
      "example-route",
      makeRequest(),
      async (log) => {
        log.info({ stage: "handler" }, "Handler started");
        return NextResponse.json({ ok: true }, { status: 201 });
      },
    );

    expect(response.status).toBe(201);
    expect(createRequestLogger).toHaveBeenCalledWith(
      "example-route",
      expect.any(NextRequest),
    );
    expect(requestLogger.info).toHaveBeenCalledTimes(3);
    expect(requestLogger.info).toHaveBeenCalledWith(
      { stage: "handler" },
      "Handler started",
    );
    expect(requestLogger.info).toHaveBeenLastCalledWith(
      expect.objectContaining({
        event: "request.complete",
        outcome: "success",
        status: 201,
      }),
      "Request completed",
    );
  });

  it("records a safe failure outcome before rethrowing unexpected errors", async () => {
    await expect(
      withRequestLifecycle("example-route", makeRequest(), async () => {
        throw new Error("private failure details");
      }),
    ).rejects.toThrow("private failure details");

    expect(requestLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "request.complete",
        outcome: "failure",
        status: 500,
        errorCode: "UNHANDLED_REQUEST_ERROR",
      }),
      "Request failed unexpectedly",
    );
  });
});
