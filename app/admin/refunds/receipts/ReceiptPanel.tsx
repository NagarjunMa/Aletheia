"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { receiptSchema } from "@/modules/refund-review/domain/refund-receipt";
const rowSchema = receiptSchema.extend({
  delivery_status: z.enum([
    "prepared",
    "sending",
    "sent",
    "uncertain",
    "failed",
  ]),
  created_at: z.string(),
});
const inputClass = "rounded border border-border bg-background p-2";
export default function ReceiptPanel() {
  const [rows, setRows] = useState<z.infer<typeof rowSchema>[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/refunds/receipts?offset=${offset}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = z
          .object({ items: z.array(rowSchema), hasMore: z.boolean() })
          .parse(await r.json());
        setRows(data.items);
        setMore(data.hasMore);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("Could not load receipts. Check access and refresh.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [offset, refresh]);
  return (
    <section className="space-y-4">
      <p role="status">{busy ? "Loading receipts…" : message}</p>
      <button
        disabled={busy}
        className={inputClass}
        onClick={() => {
          setBusy(true);
          setRefresh((v) => v + 1);
        }}
      >
        Refresh receipts
      </button>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const date = String(new FormData(event.currentTarget).get("start"));
          const start = new Date(date + "T00:00:00Z");
          const end = new Date(start.getTime() + 7 * 86400000);
          setBusy(true);
          try {
            const response = await fetch("/api/admin/refunds/receipts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                start: start.toISOString(),
                end: end.toISOString(),
              }),
            });
            if (!response.ok) throw new Error();
            const data = z
              .object({
                prepared: z.number(),
                possiblyMore: z.boolean(),
                lateRefunds: z.number(),
              })
              .parse(await response.json());
            setMessage(
              `${data.prepared} receipts prepared. ${data.possiblyMore ? "Repeat this period to prepare the remaining receipts. " : ""}${data.lateRefunds ? `${data.lateRefunds} late refunds need reconciliation. ` : ""}No email was sent by this action.`,
            );
            setOffset(0);
            setRefresh((v) => v + 1);
          } catch {
            setMessage(
              "Preparation unconfirmed. Refresh before retrying the same period.",
            );
            setBusy(false);
          }
        }}
      >
        <label className="grid gap-1">
          Closed week start (UTC)
          <input name="start" type="date" required className={inputClass} />
        </label>
        <button disabled={busy} className={inputClass}>
          Prepare receipts
        </button>
      </form>
      {!busy && !rows.length && <p>No receipts prepared.</p>}
      {rows.map((row) => (
        <article
          key={row.id}
          className="rounded border border-border bg-card p-4"
        >
          <p className="break-all">User: {row.user_id}</p>
          <p>
            {row.period_start.slice(0, 10)} through{" "}
            {row.period_end.slice(0, 10)} (end exclusive)
          </p>
          <p>
            {row.credits} credits · {row.generation_count} failed generations ·{" "}
            <strong>{row.delivery_status}</strong>
          </p>
          {(row.delivery_status === "uncertain" ||
            row.delivery_status === "failed") && (
            <p>
              Check the receipt delivery record and provider logs before
              recovery. Do not create a replacement receipt to bypass
              deduplication.
            </p>
          )}
        </article>
      ))}
      <div className="flex gap-3">
        <button
          className={inputClass}
          disabled={busy || offset === 0}
          onClick={() => {
            setBusy(true);
            setOffset((v) => Math.max(0, v - 50));
          }}
        >
          Previous
        </button>
        <button
          className={inputClass}
          disabled={busy || !more || offset >= 10000}
          onClick={() => {
            setBusy(true);
            setOffset((v) => v + 50);
          }}
        >
          Next
        </button>
      </div>
    </section>
  );
}
