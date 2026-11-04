import { it, expect, vi } from "vitest";
import { cleanupQualityFeedback } from "./quality-retention";
function database(size: number, fail?: "read" | "delete") {
  const chain: any = {};
  for (const method of ["select", "eq", "lt", "order", "limit", "in"])
    chain[method] = vi.fn(() => chain);
  let deleting = false;
  chain.delete = vi.fn(() => {
    deleting = true;
    return chain;
  });
  chain.select.mockImplementation(() => {
    deleting = false;
    return chain;
  });
  chain.abortSignal = vi.fn(async () => {
    if (fail === (deleting ? "delete" : "read"))
      return { error: { message: "PRIVATE_PROVIDER" } };
    if (deleting) {
      const count = Math.min(size, 100);
      size -= count;
      return { count, error: null };
    }
    return {
      data: Array.from({ length: Math.min(size, 100) }, (_, i) => ({
        id: `row-${i}`,
      })),
      error: null,
    };
  });
  return { db: { from: vi.fn(() => chain) }, chain };
}
it.each([0, 1, 230, 500, 700])(
  "bounds retention for %i rows and never broadens deletion",
  async (size) => {
    const { db, chain } = database(size);
    const result = await cleanupQualityFeedback(
      db as never,
      Date.UTC(2026, 10, 3),
    );
    expect(result).toEqual({
      removed: Math.min(size, 500),
      saturated: size >= 500,
    });
    expect(chain.select).toHaveBeenCalledWith("id");
    expect(chain.eq).toHaveBeenCalledWith("metadata->>quality_version", "1");
    expect(chain.lt).toHaveBeenCalledWith(
      "created_at",
      "2026-08-05T00:00:00.000Z",
    );
    expect(chain.delete.mock.calls.length).toBeLessThanOrEqual(5);
    if (size) expect(chain.in).toHaveBeenCalledWith("id", expect.any(Array));
    expect(chain.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  },
);
it.each(["read", "delete"] as const)(
  "fails closed on %s failure",
  async (fail) => {
    const { db } = database(10, fail);
    await expect(cleanupQualityFeedback(db as never)).rejects.toThrow(
      /Quality cleanup/,
    );
  },
);
