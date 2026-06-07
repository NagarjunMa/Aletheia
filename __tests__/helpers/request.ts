import type { NextRequest } from "next/server";

export interface MakeRequestOptions {
  method?: string;
  body?: object | null;
  headers?: Record<string, string>;
  origin?: string | null;
  /** Automatically sets `Authorization: Bearer <token>` */
  bearerToken?: string;
  /** Simulates `request.cookies.get()` used by session route */
  cookies?: Record<string, string>;
}

/**
 * Creates a mock NextRequest for unit testing route handlers.
 *
 * The cast to NextRequest is safe: Next.js route handlers use only the
 * fetch-standard Request interface for headers, method, and body.
 * Cookie access is shimmed for routes that call request.cookies.get().
 */
export function makeRequest(opts: MakeRequestOptions = {}): NextRequest {
  const {
    method = "GET",
    body,
    headers: extraHeaders = {},
    origin = "http://localhost:3000",
    bearerToken,
    cookies = {},
  } = opts;

  const headers = new Headers({
    "Content-Type": "application/json",
    ...extraHeaders,
  });
  if (origin !== null) {
    headers.set("origin", origin);
  }

  if (bearerToken) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }

  const req = new Request("http://localhost:3000/api/test", {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : null,
  }) as unknown as NextRequest;

  // Shim NextRequest cookie API (used by session and server-auth routes)
  const cookieMap = new Map(Object.entries(cookies));
  (req as any).cookies = {
    get: (name: string) =>
      cookieMap.has(name) ? { name, value: cookieMap.get(name)! } : undefined,
    getAll: () =>
      Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value })),
  };

  return req;
}
