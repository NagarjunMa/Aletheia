import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { saveCandidateFactReview } from "./actions";

const id = "11111111-1111-4111-8111-111111111111";
const revision = "2026-10-07T22:00:00.000Z";
const row = {
  id,
  user_id: "owner",
  kind: "technical_project",
  title: "Policy agent",
  context: "Prototype only.",
  actions: "I built a policy-grounded prototype.",
  outcome: "",
  metrics: [],
  skills: [],
  links: [],
  confirmed_at: revision,
  updated_at: revision,
  sort_order: 0,
};
const facts = [{ id, kind: "action", excerpt: row.actions, confirmed: true }];
function client(
  options: {
    row?: unknown;
    authenticated?: boolean;
    writeRow?: unknown;
    error?: unknown;
  } = {},
) {
  const filters: unknown[][] = [];
  const query = {
    eq: vi.fn((...args: unknown[]) => {
      filters.push(args);
      return query;
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.row === undefined ? row : options.row,
      error: null,
    }),
  };
  const write = {
    eq: vi.fn((...args: unknown[]) => {
      filters.push(args);
      return write;
    }),
    select: vi.fn(() => write),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.writeRow === undefined ? row : options.writeRow,
      error: options.error ?? null,
    }),
  };
  const update = vi.fn(() => write);
  const from = vi.fn(() => ({ select: vi.fn(() => query), update }));
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.authenticated === false ? null : { id: "owner" },
        },
        error: null,
      }),
    },
    from,
  } as never);
  return { filters, from, update };
}
describe("owned individual fact review actions", () => {
  beforeEach(() => vi.clearAllMocks());
  it("validates before opening a database session", async () => {
    expect(
      (
        await saveCandidateFactReview({
          evidenceId: id,
          expectedRevision: revision,
          facts: [{ ...facts[0], excerpt: "x".repeat(601) }],
        })
      ).ok,
    ).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated review without queries", async () => {
    const c = client({ authenticated: false });
    expect(
      (
        await saveCandidateFactReview({
          evidenceId: id,
          expectedRevision: revision,
          facts,
        })
      ).ok,
    ).toBe(false);
    expect(c.from).not.toHaveBeenCalled();
  });
  it("saves only the owned, displayed revision", async () => {
    const c = client();
    expect(
      (
        await saveCandidateFactReview({
          evidenceId: id,
          expectedRevision: revision,
          facts,
        })
      ).ok,
    ).toBe(true);
    expect(c.filters).toContainEqual(["user_id", "owner"]);
    expect(c.filters).toContainEqual(["id", id]);
    expect(c.filters).toContainEqual(["updated_at", revision]);
    expect(c.update).toHaveBeenCalledWith({
      fact_review: expect.objectContaining({
        facts,
        source: expect.any(String),
      }),
    });
  });
  it.each([
    { row: null },
    { row: { ...row, user_id: "another-owner" } },
    { row: { ...row, updated_at: "2026-10-07T22:01:00Z" } },
  ])("rejects missing, cross-owner or stale evidence", async (options) => {
    const c = client(options);
    expect(
      (
        await saveCandidateFactReview({
          evidenceId: id,
          expectedRevision: revision,
          facts,
        })
      ).ok,
    ).toBe(false);
    expect(c.update).not.toHaveBeenCalled();
  });
  it("rejects invented facts without a write", async () => {
    const c = client();
    expect(
      (
        await saveCandidateFactReview({
          evidenceId: id,
          expectedRevision: revision,
          facts: [{ ...facts[0], excerpt: "I shipped a production product." }],
        })
      ).ok,
    ).toBe(false);
    expect(c.update).not.toHaveBeenCalled();
  });
  it("does not report success when a concurrent edit wins", async () => {
    client({ writeRow: null });
    expect(
      (
        await saveCandidateFactReview({
          evidenceId: id,
          expectedRevision: revision,
          facts,
        })
      ).ok,
    ).toBe(false);
  });
  it("never exposes raw database errors", async () => {
    client({ error: { message: "PRIVATE_DB_CANARY" } });
    expect(
      JSON.stringify(
        await saveCandidateFactReview({
          evidenceId: id,
          expectedRevision: revision,
          facts,
        }),
      ),
    ).not.toContain("PRIVATE_DB_CANARY");
  });
});
