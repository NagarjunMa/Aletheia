import { describe, expect, it, vi } from "vitest";
import {
  buildApplicationAuthDraft,
  readApplicationAuthDraft,
  saveApplicationAuthDraft,
} from "./application-auth-draft.js";
describe("authentication handoff storage", () => {
  it("retains original questions and bounded skip ordinals only for the same account", () => {
    const input = {
      category: "yc_application",
      jd: "Synthetic JD",
      questions: "First question\nSecond question",
      ownerId: "owner",
      skippedQuestions: [2],
    };
    const draft = buildApplicationAuthDraft(input, 1000);
    expect(readApplicationAuthDraft(draft, "owner", 1001)).toMatchObject({
      questions: input.questions,
      skippedQuestions: [2],
    });
    expect(readApplicationAuthDraft(draft, "other", 1001)).toBeNull();
    expect(readApplicationAuthDraft(draft, "owner", 901000)).toBeNull();
    for (const invalid of [[1, 1], [3], [0]]) {
      expect(
        buildApplicationAuthDraft(
          { ...input, skippedQuestions: invalid },
          1000,
        ),
      ).not.toHaveProperty("skippedQuestions");
    }
  });
  it("removes a saved draft when expiry scheduling fails", async () => {
    const storage = {
      setAccessLevel: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const alarms = {
      create: vi.fn().mockRejectedValue(new Error("Alarm failed")),
    };
    await expect(
      saveApplicationAuthDraft({ expiresAt: 1000 }, storage, alarms),
    ).rejects.toThrow("Alarm failed");
    expect(storage.remove).toHaveBeenCalledWith("applicationAuthDraft");
  });
  it("restricts access before storing and schedules deletion at expiry", async () => {
    const order: string[] = [];
    const storage = {
      setAccessLevel: vi.fn(async () => {
        order.push("restrict");
      }),
      set: vi.fn(async () => {
        order.push("store");
      }),
    };
    const alarms = {
      create: vi.fn(async () => {
        order.push("expire");
      }),
    };
    const draft = buildApplicationAuthDraft(
      {
        category: "yc_application",
        jd: "PRIVATE JD",
        questions: "PRIVATE QUESTION",
      },
      1000,
    );
    await saveApplicationAuthDraft(draft, storage, alarms);
    expect(order).toEqual(["restrict", "store", "expire"]);
    expect(storage.setAccessLevel).toHaveBeenCalledWith({
      accessLevel: "TRUSTED_CONTEXTS",
    });
    expect(alarms.create).toHaveBeenCalledWith(
      "application-auth-draft-expiry",
      { when: 901000 },
    );
  });
  it("does not authenticate past an unsuccessful draft save", async () => {
    const storage = {
      setAccessLevel: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockRejectedValue(new Error("Storage failed")),
    };
    const alarms = { create: vi.fn() };
    await expect(
      saveApplicationAuthDraft({ expiresAt: 1000 }, storage, alarms),
    ).rejects.toThrow("Storage failed");
    expect(alarms.create).not.toHaveBeenCalled();
  });
});
