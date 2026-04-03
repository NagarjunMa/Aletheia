import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockInsert = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// ─── Route handler ────────────────────────────────────────────────────────────
import { POST } from "./route";

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  mockInsert.mockReset();
  // Establish chain: from('feedback').insert(data) → resolves
  mockFrom.mockReturnValue({ insert: mockInsert });
});

// ─── Valid payloads ───────────────────────────────────────────────────────────
const VALID_BODY = {
  name: "Jane Doe",
  email: "jane@example.com",
  message: "This is a feedback message that is at least 10 chars.",
  rating: 4,
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("POST /api/feedback", () => {
  describe("honeypot bot detection", () => {
    it("returns silent 200 and does NOT insert when honeypot field is present", async () => {
      // This is a security feature: bots filling hidden form fields get a fake success.
      // Cannot be tested via E2E — Playwright does not simulate bot form submission.
      const req = makeRequest({
        method: "POST",
        body: { ...VALID_BODY, honeypot: "bot-value" },
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // Critical: Supabase insert must NOT have been called
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("still processes normally when honeypot field is absent", async () => {
      mockInsert.mockResolvedValue({ error: null });

      const req = makeRequest({ method: "POST", body: VALID_BODY });
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledOnce();
    });
  });

  describe("schema validation", () => {
    it("returns 200 for a fully valid payload", async () => {
      mockInsert.mockResolvedValue({ error: null });

      const res = await POST(makeRequest({ method: "POST", body: VALID_BODY }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("returns 400 when name is too short (< 2 chars)", async () => {
      const req = makeRequest({
        method: "POST",
        body: { ...VALID_BODY, name: "J" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when email is invalid", async () => {
      const req = makeRequest({
        method: "POST",
        body: { ...VALID_BODY, email: "not-an-email" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when message is too short (< 10 chars)", async () => {
      const req = makeRequest({
        method: "POST",
        body: { ...VALID_BODY, message: "Short" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when message exceeds 5000 chars", async () => {
      const req = makeRequest({
        method: "POST",
        body: { ...VALID_BODY, message: "a".repeat(5001) },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when rating is out of range (> 5)", async () => {
      const req = makeRequest({
        method: "POST",
        body: { ...VALID_BODY, rating: 6 },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when rating is below range (< 1)", async () => {
      const req = makeRequest({
        method: "POST",
        body: { ...VALID_BODY, rating: 0 },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 200 when optional rating is omitted", async () => {
      mockInsert.mockResolvedValue({ error: null });
      const { rating: _, ...bodyWithoutRating } = VALID_BODY;

      const res = await POST(
        makeRequest({ method: "POST", body: bodyWithoutRating }),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Supabase insert", () => {
    it("passes correct fields to Supabase insert", async () => {
      mockInsert.mockResolvedValue({ error: null });

      await POST(makeRequest({ method: "POST", body: VALID_BODY }));

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: VALID_BODY.name,
          email: VALID_BODY.email,
          message: VALID_BODY.message,
          rating: VALID_BODY.rating,
        }),
      );
    });

    it("returns 500 when Supabase insert fails", async () => {
      mockInsert.mockResolvedValue({
        error: { message: "DB constraint violation" },
      });

      const res = await POST(makeRequest({ method: "POST", body: VALID_BODY }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    });
  });

  describe("malformed requests", () => {
    it("returns 400 when body is not valid JSON", async () => {
      const req = new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "this is not json {{{",
      }) as any;

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});
