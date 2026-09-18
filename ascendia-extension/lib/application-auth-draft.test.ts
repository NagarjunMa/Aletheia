import { describe, expect, it, vi } from "vitest";
import {
  buildApplicationAuthDraft,
  saveApplicationAuthDraft,
} from "./application-auth-draft.js";
describe("authentication handoff storage", () => {
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
