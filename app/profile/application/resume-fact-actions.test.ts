import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { loadResumeFactReview, saveResumeFactReview } from "./actions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const resumeId = "77777777-7777-4777-8777-777777777777";
const revision = "2026-11-15T20:00:00.000Z";
const excerpt = "I tested an intake prototype using simulated cases.";
const resume = {
  id: resumeId,
  user_id: "owner",
  is_primary: true,
  review_source_verified: true,
  updated_at: revision,
  parsed_text: "Experience\n\n" + excerpt,
  fact_review: [],
};
const input = {
  resumeId,
  expectedRevision: revision,
  facts: [{ kind: "action", excerpt }],
};

function mockClient(
  options: {
    user?: string | null;
    row?: Partial<typeof resume> | null;
    lostRace?: boolean;
  } = {},
) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.row === null ? null : { ...resume, ...options.row },
      error: null,
    }),
  };
  const write = {
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.lostRace ? null : { id: resumeId },
      error: null,
    }),
  };
  const from = vi.fn().mockReturnValue({
    select: vi.fn(() => query),
    update: vi.fn(() => write),
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: {
          user: options.user === null ? null : { id: options.user ?? "owner" },
        },
        error: null,
      }),
    },
    from,
  } as never);
  return { from, update: from().update, query, write };
}

describe("owner-scoped résumé review actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only bounded suggestions and approval state, making no writes", async () => {
    const db = mockClient();
    expect(await loadResumeFactReview()).toEqual({
      ok: true,
      resumeId,
      revision,
      suggestions: [excerpt],
      facts: [],
    });
    expect(db.query.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(db.query.eq).toHaveBeenCalledWith("is_primary", true);
    expect(db.query.eq).toHaveBeenCalledWith("review_source_verified", true);
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each([
    { user: null },
    { user: "other" },
    { row: null },
    { row: { is_primary: false } },
    { row: { review_source_verified: false } },
  ])("blocks private or ineligible source access (%j)", async (options) => {
    const db = mockClient(options);
    expect(await loadResumeFactReview()).toMatchObject({ ok: false });
    expect(await saveResumeFactReview(input)).toMatchObject({ ok: false });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("confirms and revokes using both owner and active revision filters", async () => {
    const db = mockClient();
    expect(await saveResumeFactReview(input)).toEqual({ ok: true });
    expect(db.query.eq).toHaveBeenCalledWith("id", resumeId);
    expect(db.write.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(db.write.eq).toHaveBeenCalledWith("is_primary", true);
    expect(db.write.eq).toHaveBeenCalledWith("updated_at", revision);
    expect(db.update).toHaveBeenCalledWith({
      fact_review: [expect.objectContaining({ excerpt, confirmed: true })],
    });
    expect(await saveResumeFactReview({ ...input, facts: [] })).toEqual({
      ok: true,
    });
    expect(db.update).toHaveBeenLastCalledWith({ fact_review: [] });
  });

  it("rejects changed source snapshots both before and during the write", async () => {
    const stale = mockClient({
      row: { updated_at: "2026-11-15T20:01:00.000Z" },
    });
    expect(await saveResumeFactReview(input)).toMatchObject({
      ok: false,
      stale: true,
    });
    expect(stale.update).not.toHaveBeenCalled();
    mockClient({ lostRace: true });
    expect(await saveResumeFactReview(input)).toMatchObject({
      ok: false,
      stale: true,
    });
  });
});
