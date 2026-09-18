import { describe, expect, it, vi } from "vitest";

import {
  AUTH_REQUIRED_CODE,
  AUTH_TIMEOUT_CODE,
  generateWithAuthRecovery,
} from "./generate-auth-recovery.js";

function authenticationError(code = "SESSION_UNAVAILABLE") {
  const error = new Error("Not authenticated");
  error.status = 401;
  error.code = code;
  return error;
}

function dependencies(overrides = {}) {
  return {
    getAccessToken: vi.fn().mockResolvedValue("access-token"),
    generate: vi.fn().mockResolvedValue({ success: true }),
    recoverSilently: vi.fn().mockResolvedValue(undefined),
    clearAuth: vi.fn().mockResolvedValue(undefined),
    authenticateInteractively: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("generateWithAuthRecovery", () => {
  it("uses the stored token without recovery when generation succeeds", async () => {
    const deps = dependencies();

    await expect(generateWithAuthRecovery(deps)).resolves.toEqual({
      success: true,
    });
    expect(deps.generate).toHaveBeenCalledTimes(1);
    expect(deps.recoverSilently).not.toHaveBeenCalled();
    expect(deps.authenticateInteractively).not.toHaveBeenCalled();
  });

  it("retries once with a silently refreshed web-app session", async () => {
    const deps = dependencies({
      generate: vi
        .fn()
        .mockRejectedValueOnce(authenticationError())
        .mockResolvedValueOnce({ success: true }),
    });

    await expect(generateWithAuthRecovery(deps)).resolves.toEqual({
      success: true,
    });
    expect(deps.recoverSilently).toHaveBeenCalledTimes(1);
    expect(deps.authenticateInteractively).not.toHaveBeenCalled();
    expect(deps.generate).toHaveBeenCalledTimes(2);
  });

  it("continues to interactive authentication when the silent exchange fails", async () => {
    const deps = dependencies({
      generate: vi
        .fn()
        .mockRejectedValueOnce(authenticationError())
        .mockRejectedValueOnce(authenticationError())
        .mockResolvedValueOnce({ success: true }),
      recoverSilently: vi.fn().mockRejectedValue(authenticationError()),
    });

    await expect(generateWithAuthRecovery(deps)).resolves.toEqual({
      success: true,
    });
    expect(deps.recoverSilently).toHaveBeenCalledTimes(1);
    expect(deps.clearAuth).toHaveBeenCalledTimes(1);
    expect(deps.authenticateInteractively).toHaveBeenCalledTimes(1);
    expect(deps.generate).toHaveBeenCalledTimes(3);
  });

  it("returns a stable auth-required error after the final generation retry", async () => {
    const deps = dependencies({
      generate: vi.fn().mockRejectedValue(authenticationError()),
    });

    await expect(generateWithAuthRecovery(deps)).rejects.toMatchObject({
      code: AUTH_REQUIRED_CODE,
      status: 401,
      authCause: "SESSION_UNAVAILABLE",
    });
    expect(deps.generate).toHaveBeenCalledTimes(3);
  });

  it("returns a stable timeout code when interactive authentication times out", async () => {
    const timeout = new Error("Login timed out. Please try again.");
    const deps = dependencies({
      generate: vi.fn().mockRejectedValue(authenticationError()),
      authenticateInteractively: vi.fn().mockRejectedValue(timeout),
    });

    await expect(generateWithAuthRecovery(deps)).rejects.toMatchObject({
      code: AUTH_TIMEOUT_CODE,
      status: 401,
      authCause: "INTERACTIVE_AUTH_REJECTED",
    });
  });

  it("does not retry an ordinary generation failure", async () => {
    const failure = Object.assign(new Error("Rate limit exceeded"), {
      status: 429,
    });
    const deps = dependencies({ generate: vi.fn().mockRejectedValue(failure) });

    await expect(generateWithAuthRecovery(deps)).rejects.toBe(failure);
    expect(deps.generate).toHaveBeenCalledTimes(1);
    expect(deps.recoverSilently).not.toHaveBeenCalled();
  });
});

it("restores an application draft after interactive sign-in without charging an abandoned popup", async () => {
  const deps = dependencies({
    generate: vi.fn().mockRejectedValue(authenticationError()),
    resumeAfterInteractive: false,
  });
  await expect(generateWithAuthRecovery(deps)).resolves.toMatchObject({
    success: false,
    code: "AUTH_RECONNECTED",
  });
  expect(deps.generate).toHaveBeenCalledTimes(2);
  expect(deps.authenticateInteractively).toHaveBeenCalledTimes(1);
});
