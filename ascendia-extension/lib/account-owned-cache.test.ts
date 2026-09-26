import { describe, expect, it } from "vitest";
import {
  filterOwnedAccepted,
  getOwnedUsage,
  isMatchingAccountToken,
  isOwnedRecord,
} from "./account-owned-cache.js";

describe("account-owned extension cache", () => {
  const accepted = [
    { category: "cold_email", body: "legacy private draft" },
    {
      ownerId: "user-a",
      category: "cold_email",
      body: "account A private draft",
    },
    {
      ownerId: "user-b",
      category: "cold_email",
      body: "account B private draft",
    },
    {
      ownerId: "user-b",
      category: "linkedin_connection",
      body: "other category",
    },
  ];

  it("never supplies legacy or other-account examples to a generation", () => {
    expect(filterOwnedAccepted(accepted, "cold_email", "user-b")).toEqual([
      "account B private draft",
    ]);
    expect(filterOwnedAccepted(accepted, "cold_email", null)).toEqual([]);
  });

  it("rejects unowned or differently owned saved drafts", () => {
    expect(isOwnedRecord({ body: "legacy" }, "user-a")).toBe(false);
    expect(isOwnedRecord({ ownerId: "user-a" }, "user-b")).toBe(false);
    expect(isOwnedRecord({ ownerId: "user-a" }, "user-a")).toBe(true);
  });

  it("binds a request to both the account and the token used for transmission", () => {
    const auth = { user: { id: "user-b" }, access_token: "token-b" };
    expect(isMatchingAccountToken("user-b", "token-b", auth)).toBe(true);
    expect(isMatchingAccountToken("user-a", "token-b", auth)).toBe(false);
    expect(isMatchingAccountToken("user-b", "old-token", auth)).toBe(false);
    expect(isMatchingAccountToken(null, "token-b", auth)).toBe(false);
  });

  it("does not apply another account's or legacy usage to the active account", () => {
    const usage = { "2026-09-26": 50 };
    expect(getOwnedUsage(usage, "user-a", "user-b")).toEqual({});
    expect(getOwnedUsage(usage, undefined, "user-a")).toEqual({});
    expect(getOwnedUsage(usage, "user-a", "user-a")).toEqual(usage);
  });
});
