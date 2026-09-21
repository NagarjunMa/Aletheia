// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import RefundReviewPanel from "./RefundReviewPanel";
const id = "22222222-2222-4222-8222-222222222222";
const item = {
  id,
  attempt_id: id,
  user_id: id,
  debit_id: id,
  category: "cold_email",
  failure_code: "MODEL_TIMEOUT",
  created_at: "2026-09-20T00:00:00Z",
  decision: "pending",
  credit_status: "pending",
  amount: 4,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("reviews, comments and disables repeated credit actions after confirmation", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(async (_url: string, options?: RequestInit) => {
      if (options?.method === "POST")
        return new Response(
          JSON.stringify({
            case: { ...item, decision: "approved", credit_status: "credited" },
            events: [],
            hasMoreEvents: false,
          }),
        );
      return new Response(
        JSON.stringify(
          String(_url).includes(id)
            ? { case: item, events: [], hasMoreEvents: false }
            : { items: [item], hasMore: false },
        ),
      );
    });
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<RefundReviewPanel />);
  await user.click(await screen.findByRole("button", { name: /Review case/ }));
  const note = await screen.findByRole("textbox", {
    name: "Internal review note",
  });
  await user.type(note, "Confirmed server failure");
  await user.click(
    screen.getByRole("button", { name: "Approve and restore credits" }),
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Approve and restore credits" })
        .hasAttribute("disabled"),
    ).toBe(true),
  );
  const mutation = fetcher.mock.calls.find(
    (call) => call[1]?.method === "POST",
  );
  expect(JSON.parse(String(mutation?.[1]?.body))).toMatchObject({
    action: "approve",
    note: "Confirmed server failure",
  });
  expect(String(mutation?.[1]?.body)).not.toContain('"amount"');
});
it("shows actionable errors for unavailable administrator data", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 403 })),
  );
  render(<RefundReviewPanel />);
  await screen.findByText(/Could not load cases/);
  expect(screen.getByRole("button", { name: "Refresh list" })).toBeTruthy();
});
