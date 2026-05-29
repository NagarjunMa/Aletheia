import { describe, it, expect } from "vitest";
import {
  sentryBeforeSend,
  sentryBeforeBreadcrumb,
  type ScrubberEvent,
  type ScrubberBreadcrumb,
} from "./sentry-scrubbers";

const REDACTED = "[REDACTED]";

function makeEvent(overrides: Partial<ScrubberEvent> = {}): ScrubberEvent {
  return { ...overrides };
}

describe("sentryBeforeSend", () => {
  it("redacts Authorization header", () => {
    const event = makeEvent({
      request: {
        url: "/api/extension/generate",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer eyJsupersecret",
        },
      },
    });
    const out = sentryBeforeSend(event, {});
    expect(out!.request!.headers!.authorization).toBe(REDACTED);
    expect(out!.request!.headers!["content-type"]).toBe("application/json");
  });

  it("redacts Cookie header case-insensitively", () => {
    const event = makeEvent({
      request: {
        headers: { Cookie: "sb-foo-auth-token=eyJ..." },
      },
    });
    const out = sentryBeforeSend(event, {});
    expect(out!.request!.headers!.Cookie).toBe(REDACTED);
  });

  it("redacts cookies array entirely", () => {
    const event = makeEvent({
      request: {
        cookies: { "sb-foo-auth-token": "eyJ..." },
      },
    });
    const out = sentryBeforeSend(event, {});
    expect(out!.request!.cookies).toBe(REDACTED);
  });

  it("redacts request body fields: resume, profileMarkdown, jd", () => {
    const event = makeEvent({
      request: {
        data: {
          resume: "John Doe — Senior Engineer at Acme",
          profileMarkdown: "# Target Person",
          jd: "Job description text",
          category: "linkedin_connection",
        },
      },
    });
    const out = sentryBeforeSend(event, {});
    const body = out!.request!.data as Record<string, unknown>;
    expect(body.resume).toBe(REDACTED);
    expect(body.profileMarkdown).toBe(REDACTED);
    expect(body.jd).toBe(REDACTED);
    expect(body.category).toBe("linkedin_connection");
  });

  it("redacts acceptedExamples array contents", () => {
    const event = makeEvent({
      request: {
        data: {
          acceptedExamples: ["prior message 1", "prior message 2"],
        },
      },
    });
    const out = sentryBeforeSend(event, {});
    const body = out!.request!.data as Record<string, unknown>;
    expect(body.acceptedExamples).toBe(REDACTED);
  });

  it("redacts access_token and refresh_token in extras", () => {
    const event = makeEvent({
      extra: {
        access_token: "eyJaccess",
        refresh_token: "eyJrefresh",
        userId: "u-123",
      },
    });
    const out = sentryBeforeSend(event, {});
    expect(out!.extra!.access_token).toBe(REDACTED);
    expect(out!.extra!.refresh_token).toBe(REDACTED);
    expect(out!.extra!.userId).toBe("u-123");
  });

  it("redacts service-role key value if it leaks into a string field", () => {
    const event = makeEvent({
      extra: { note: "sb_secret_abcdef12345" },
    });
    const out = sentryBeforeSend(event, {});
    expect(out!.extra!.note).toBe(REDACTED);
  });

  it("redacts anthropic key prefix in string values", () => {
    const event = makeEvent({
      extra: { note: "sk-ant-api-key-here" },
    });
    const out = sentryBeforeSend(event, {});
    expect(out!.extra!.note).toBe(REDACTED);
  });

  it("redacts nested objects recursively", () => {
    const event = makeEvent({
      extra: {
        payload: {
          user: { id: "u-1", access_token: "eyJ123" },
          meta: { resume: "redact me" },
        },
      },
    });
    const out = sentryBeforeSend(event, {});
    const p = out!.extra!.payload as Record<string, unknown>;
    expect((p.user as Record<string, unknown>).access_token).toBe(REDACTED);
    expect((p.meta as Record<string, unknown>).resume).toBe(REDACTED);
    expect((p.user as Record<string, unknown>).id).toBe("u-1");
  });

  it("returns event unchanged if no sensitive fields present", () => {
    const event = makeEvent({
      extra: { route: "/api/health", duration_ms: 12 },
    });
    const out = sentryBeforeSend(event, {});
    expect(out!.extra).toEqual({ route: "/api/health", duration_ms: 12 });
  });
});

describe("sentryBeforeBreadcrumb", () => {
  it("strips request_headers from fetch breadcrumbs", () => {
    const bc: ScrubberBreadcrumb = {
      category: "fetch",
      data: {
        url: "/api/extension/generate",
        method: "POST",
        request_headers: { authorization: "Bearer eyJ..." },
      },
    };
    const out = sentryBeforeBreadcrumb(bc);
    expect(out!.data!.request_headers).toBe(REDACTED);
    expect(out!.data!.url).toBe("/api/extension/generate");
  });

  it("strips response_headers from xhr breadcrumbs", () => {
    const bc: ScrubberBreadcrumb = {
      category: "xhr",
      data: {
        url: "/api/auth/me",
        response_headers: { "set-cookie": "sb-foo=..." },
      },
    };
    const out = sentryBeforeBreadcrumb(bc);
    expect(out!.data!.response_headers).toBe(REDACTED);
  });

  it("redacts token fields in non-fetch breadcrumb data", () => {
    const bc: ScrubberBreadcrumb = {
      category: "navigation",
      data: { access_token: "eyJ", from: "/", to: "/dashboard" },
    };
    const out = sentryBeforeBreadcrumb(bc);
    expect(out!.data!.access_token).toBe(REDACTED);
    expect(out!.data!.from).toBe("/");
  });
});
