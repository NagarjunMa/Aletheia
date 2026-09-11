import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import {
  observeAnthropicAttempts,
  observeProviderFetch,
  observeQuery,
  recordMeasurement,
} from "./provider-attempt-timing";
import { sanitizeLogFields } from "./logging-core";

describe("request-local measurement", () => {
  it("observes SDK retries without changing request options or consuming responses", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          '{"error":{"type":"overloaded_error","message":"PRIVATE"}}',
          {
            status: 529,
            headers: {
              "content-type": "application/json",
              "retry-after": "0.001",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-sonnet-4-6",
            content: [],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    const client = new Anthropic({ apiKey: "test-only", fetch });
    const info = vi.fn();
    observeAnthropicAttempts(client, { info });
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 10,
        messages: [{ role: "user", content: "PRIVATE" }],
      },
      { timeout: 30000 },
    );
    expect(response.usage).toEqual({ input_tokens: 10, output_tokens: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(info.mock.calls.map((c) => c[0])).toEqual([
      expect.objectContaining({ attempt: 1, status: 529, outcome: "failure" }),
      expect.objectContaining({ attempt: 2, status: 200, outcome: "success" }),
    ]);
    expect(JSON.stringify(info.mock.calls)).not.toContain("PRIVATE");
    expect(client.maxRetries).toBe(2);
  });
  it("preserves transport arguments, response identity, errors and retry gap", async () => {
    let time = 0;
    const response = new Response("PRIVATE", { status: 429 });
    const error = new Error("PRIVATE");
    const fetch = vi
      .fn()
      .mockImplementationOnce(async () => {
        time = 10;
        return response;
      })
      .mockImplementationOnce(async () => {
        time = 45;
        throw error;
      });
    const info = vi.fn();
    const client = { fetch };
    observeProviderFetch(client, { info }, () => time);
    const options = { headers: { authorization: "PRIVATE" } };
    expect(await client.fetch("https://private", options)).toBe(response);
    expect(fetch).toHaveBeenCalledWith("https://private", options);
    time = 40;
    await expect(client.fetch("https://private", options)).rejects.toBe(error);
    expect(info.mock.calls.map((c) => c[0])).toEqual([
      {
        event: "provider.attempt",
        attempt: 1,
        durationMs: 10,
        status: 429,
        outcome: "failure",
      },
      {
        event: "provider.attempt",
        attempt: 2,
        durationMs: 5,
        outcome: "failure",
        errorCode: "PROVIDER_FETCH_FAILED",
        gapMs: 30,
      },
    ]);
    expect(JSON.stringify(info.mock.calls)).not.toContain("PRIVATE");
    expect(sanitizeLogFields(info.mock.calls[0]?.[0])).toEqual(
      info.mock.calls[0]?.[0],
    );
  });
  it("labels fetch aborts without guessing their cause or exposing raw errors", async () => {
    const error = new DOMException("PRIVATE", "AbortError");
    const info = vi.fn();
    const client = { fetch: vi.fn().mockRejectedValue(error) };
    observeProviderFetch(client, { info });
    await expect(client.fetch()).rejects.toBe(error);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "FETCH_ABORTED" }),
    );
    expect(info.mock.calls[0]?.[0].gapMs).toBeUndefined();
    expect(JSON.stringify(info.mock.calls)).not.toContain("PRIVATE");
  });
  it("isolates clients and cannot replace success/error when telemetry throws", async () => {
    const logger = {
      info: vi.fn(() => {
        throw new Error("logger");
      }),
    };
    const response = new Response();
    const client = { fetch: vi.fn(async () => response) };
    observeProviderFetch(client, logger);
    expect(await client.fetch()).toBe(response);
    const upstream = new Error("PRIVATE");
    const failingClient = { fetch: vi.fn().mockRejectedValue(upstream) };
    observeProviderFetch(failingClient, logger);
    await expect(failingClient.fetch()).rejects.toBe(upstream);
    expect(() => recordMeasurement(logger, { event: "test" })).not.toThrow();
    const error = new Error("query");
    await expect(
      observeQuery("context", Promise.reject(error), logger),
    ).rejects.toBe(error);
    expect(
      await observeQuery(
        "primary",
        Promise.resolve({ error: null, data: "PRIVATE" }),
        logger,
      ),
    ).toEqual({ error: null, data: "PRIVATE" });
  });
});
