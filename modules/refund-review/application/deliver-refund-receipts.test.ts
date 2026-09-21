import { beforeEach, expect, it, vi } from "vitest";
vi.mock(
  "@/modules/refund-review/infrastructure/refund-receipt.repository",
  () => ({ createReceiptRepository: vi.fn() }),
);
import { deliverRefundReceipts } from "./deliver-refund-receipts";
const id = "22222222-2222-4222-8222-222222222222";
const receipt = {
  id,
  user_id: id,
  period_start: "2026-09-07T00:00:00Z",
  period_end: "2026-09-14T00:00:00Z",
  credits: 4,
  generation_count: 1,
};
const claim = { receipt, leaseId: id, payload: null };
const repository = {
  prepare: vi.fn(),
  expire: vi.fn(),
  claim: vi.fn(),
  recipient: vi.fn(),
  freeze: vi.fn(),
  finish: vi.fn(),
};
const config = {
  from: "receipts@example.com",
  anchor: "2026-09-07T00:00:00Z",
  apiKey: "test-key",
};
beforeEach(() => {
  vi.clearAllMocks();
  repository.prepare.mockResolvedValue({
    caughtUp: true,
    lateRefunds: 0,
    lateRefundsMore: false,
  });
  repository.expire.mockResolvedValue(undefined);
  repository.claim
    .mockReset()
    .mockResolvedValue(null)
    .mockResolvedValueOnce(claim);
  repository.recipient.mockResolvedValue("verified@example.com");
  repository.freeze.mockImplementation(async (_id, _lease, payload) => payload);
  repository.finish.mockResolvedValue(undefined);
});
it("freezes verified recipient and receipt content before sending", async () => {
  const send = vi.fn().mockResolvedValue(id);
  expect(await deliverRefundReceipts(config, repository, send)).toMatchObject({
    sent: 1,
    uncertain: 0,
  });
  expect(send).toHaveBeenCalledWith(
    id,
    expect.objectContaining({ to: ["verified@example.com"] }),
    "test-key",
  );
  expect(repository.freeze.mock.invocationCallOrder[0]).toBeLessThan(
    send.mock.invocationCallOrder[0] ?? 0,
  );
  expect(repository.finish).toHaveBeenCalledWith(id, id, id, null);
});
it("keeps timeout outcomes uncertain and never retries inside one send", async () => {
  const send = vi.fn().mockRejectedValue(new Error("SECRET"));
  expect(await deliverRefundReceipts(config, repository, send)).toMatchObject({
    sent: 0,
    uncertain: 1,
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(repository.finish).toHaveBeenCalledWith(
    id,
    id,
    null,
    "EMAIL_UNCONFIRMED",
  );
});
it("reuses frozen payload across account and sender changes", async () => {
  const payload = {
    from: "old@example.com",
    to: ["original@example.com"],
    subject: "Frozen subject",
    text: "Frozen text",
  };
  repository.claim
    .mockReset()
    .mockResolvedValue(null)
    .mockResolvedValueOnce({ ...claim, payload });
  const send = vi.fn().mockResolvedValue(id);
  await deliverRefundReceipts(config, repository, send);
  expect(repository.recipient).not.toHaveBeenCalled();
  expect(repository.freeze).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledWith(id, payload, "test-key");
});
it("does not send to an unverified or unavailable recipient", async () => {
  repository.recipient.mockResolvedValue(null);
  const send = vi.fn();
  expect(await deliverRefundReceipts(config, repository, send)).toMatchObject({
    failed: 1,
  });
  expect(send).not.toHaveBeenCalled();
});
it("does not send before the payload is durable", async () => {
  repository.freeze.mockRejectedValue(new Error("Database unavailable"));
  const send = vi.fn();
  expect(await deliverRefundReceipts(config, repository, send)).toMatchObject({
    uncertain: 1,
  });
  expect(send).not.toHaveBeenCalled();
});

it("keeps preparation backlog visible after two empty weeks", async () => {
  repository.prepare.mockResolvedValue({
    caughtUp: false,
    lateRefunds: 0,
    lateRefundsMore: false,
  });
  repository.claim.mockReset().mockResolvedValue(null);
  const result = await deliverRefundReceipts(config, repository, vi.fn());
  expect(repository.prepare).toHaveBeenCalledTimes(2);
  expect(result.possiblyMore).toBe(true);
});
it("stops reporting backlog when preparation and delivery are caught up", async () => {
  repository.prepare.mockResolvedValue({
    caughtUp: true,
    lateRefunds: 0,
    lateRefundsMore: false,
  });
  repository.claim.mockReset().mockResolvedValue(null);
  expect(
    (await deliverRefundReceipts(config, repository, vi.fn())).possiblyMore,
  ).toBe(false);
});
it("does not double-count reconciliation snapshots across preparation passes", async () => {
  repository.prepare.mockResolvedValue({
    caughtUp: false,
    lateRefunds: 2,
    lateRefundsMore: false,
  });
  repository.claim.mockReset().mockResolvedValue(null);
  expect(
    (await deliverRefundReceipts(config, repository, vi.fn())).lateRefunds,
  ).toBe(2);
});

it("exposes capped late-refund warnings without an endless backlog loop", async () => {
  repository.prepare.mockResolvedValue({
    caughtUp: true,
    lateRefunds: 100,
    lateRefundsMore: true,
  });
  repository.claim.mockReset().mockResolvedValue(null);
  expect(
    await deliverRefundReceipts(config, repository, vi.fn()),
  ).toMatchObject({
    lateRefunds: 100,
    lateRefundsMore: true,
    possiblyMore: false,
  });
});
