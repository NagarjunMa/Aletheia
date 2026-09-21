// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import ReceiptPanel from "./ReceiptPanel";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows uncertain delivery separately and prepares a closed UTC week without sending", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(
      async (_url: string, options?: RequestInit) =>
        new Response(
          JSON.stringify(
            options?.method === "POST"
              ? { prepared: 1, possiblyMore: false, lateRefunds: 0 }
              : {
                  items: [
                    {
                      id: "22222222-2222-4222-8222-222222222222",
                      user_id: "33333333-3333-4333-8333-333333333333",
                      period_start: "2026-09-07T00:00:00Z",
                      period_end: "2026-09-14T00:00:00Z",
                      credits: 4,
                      generation_count: 1,
                      delivery_status: "uncertain",
                      created_at: "2026-09-14T00:00:00Z",
                    },
                  ],
                  hasMore: false,
                },
          ),
        ),
    );
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<ReceiptPanel />);
  await screen.findByText("uncertain");
  await user.type(
    screen.getByLabelText("Closed week start (UTC)"),
    "2026-09-07",
  );
  await user.click(screen.getByRole("button", { name: "Prepare receipts" }));
  await screen.findByText(/No email was sent by this action/);
  const mutation = fetcher.mock.calls.find(
    (call) => call[1]?.method === "POST",
  );
  expect(JSON.parse(String(mutation?.[1]?.body))).toEqual({
    start: "2026-09-07T00:00:00.000Z",
    end: "2026-09-14T00:00:00.000Z",
  });
  expect(
    fetcher.mock.calls.every(
      (call) => !String(call[0]).includes("weekly-digest"),
    ),
  ).toBe(true);
});
