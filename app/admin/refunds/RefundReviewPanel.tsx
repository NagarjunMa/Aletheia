"use client";
import { useEffect, useRef, useState } from "react";
import {
  refundDetailSchema,
  refundListSchema,
  type RefundCase,
} from "@/modules/refund-review/domain/refund-review";
import type { z } from "zod";
const inputClass =
  "rounded border border-border bg-background p-2 text-foreground";
export default function RefundReviewPanel() {
  const [items, setItems] = useState<RefundCase[]>([]);
  const [detail, setDetail] = useState<z.infer<
    typeof refundDetailSchema
  > | null>(null);
  const [query, setQuery] = useState("status=pending");
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [refresh, setRefresh] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  // Preserve an action key after uncertain transport so retry cannot duplicate review events.
  const pending = useRef<{ key: string; body: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/refunds?${query}&offset=${offset}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = refundListSchema.parse(await response.json());
        setItems(result.items);
        setMore(result.hasMore);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Could not load cases. Check administrator access and try Refresh.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [query, offset, refresh]);
  useEffect(() => {
    title.current?.focus();
  }, [detail?.case.id]);
  async function openCase(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/refunds/${id}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setDetail(refundDetailSchema.parse(await response.json()));
      setNote("");
      pending.current = null;
    } catch {
      setMessage("Could not load this case. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function act(action: "approve" | "reject" | "comment" | "retry") {
    if (!detail) return;
    setBusy(true);
    setMessage("");
    const key = `${detail.case.id}:${action}:${note.trim()}`;
    if (pending.current?.key !== key)
      pending.current = {
        key,
        body: JSON.stringify(
          action === "retry"
            ? { action }
            : { action, note: note.trim(), actionId: crypto.randomUUID() },
        ),
      };
    try {
      const response = await fetch(`/api/admin/refunds/${detail.case.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: pending.current.body,
      });
      if (!response.ok) {
        setMessage(
          "Action unconfirmed. Refresh the case before retrying; a delayed credit may already have completed.",
        );
        return;
      }
      setDetail(refundDetailSchema.parse(await response.json()));
      setNote("");
      pending.current = null;
      setMessage(
        action === "comment"
          ? "Comment recorded."
          : "Case updated. Check credit status below.",
      );
      setRefresh((v) => v + 1);
    } catch {
      setMessage("Connection interrupted. Refresh the case before retrying.");
    } finally {
      setBusy(false);
    }
  }
  const eligible =
    detail?.case.credit_status === "pending" &&
    detail.case.decision === "pending";
  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const params = new URLSearchParams();
          for (const [key, value] of data) {
            if (typeof value === "string" && value.trim())
              params.set(
                key,
                key === "since" || key === "until"
                  ? new Date(value).toISOString()
                  : value.trim(),
              );
          }
          setBusy(true);
          setMessage("");
          setOffset(0);
          setQuery(params.toString());
          setRefresh((v) => v + 1);
        }}
      >
        <label className="grid gap-1">
          User ID
          <input
            name="userId"
            className={inputClass}
            placeholder="Account UUID"
          />
        </label>
        <label className="grid gap-1">
          Status
          <select name="status" defaultValue="pending" className={inputClass}>
            <option value="">All</option>
            <option value="pending">Needs review</option>
            <option value="approved">Approved, restoration pending</option>
            <option value="credited">Credited</option>
            <option value="rejected">Rejected</option>
            <option value="uncharged">Not charged</option>
            <option value="unknown">Charge unconfirmed</option>
          </select>
        </label>
        <label className="grid gap-1">
          Category
          <select name="category" className={inputClass}>
            <option value="">All</option>
            {[
              "yc_application",
              "linkedin_connection",
              "cold_email",
              "linkedin_inmail",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          From (local time)
          <input name="since" type="datetime-local" className={inputClass} />
        </label>
        <label className="grid gap-1">
          Before (local time)
          <input name="until" type="datetime-local" className={inputClass} />
        </label>
        <button className={inputClass} disabled={busy}>
          Apply filters
        </button>
        <button
          type="button"
          className={inputClass}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setMessage("");
            setRefresh((v) => v + 1);
          }}
        >
          Refresh list
        </button>
      </form>
      <p role="status" aria-live="polite">
        {busy ? "Loading…" : message}
      </p>
      <section
        aria-label="Failed generation cases"
        aria-busy={busy}
        className="space-y-2"
      >
        {!busy && !items.length && <p>No matching cases.</p>}
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <p className="break-all">User: {item.user_id}</p>
            <p>
              {item.category} · {item.failure_code} ·{" "}
              {new Date(item.created_at).toLocaleString()}
            </p>
            <p>
              {item.amount} credits · {item.credit_status} · Review:{" "}
              {item.decision}
            </p>
            <button
              className={inputClass}
              disabled={busy}
              onClick={() => openCase(item.id)}
            >
              Review case {item.id.slice(0, 8)}
            </button>
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
      {detail && (
        <section
          aria-labelledby="case-heading"
          className="rounded-lg border border-border bg-card p-5 space-y-3"
        >
          <h2 id="case-heading" ref={title} tabIndex={-1} className="text-xl">
            Case {detail.case.id.slice(0, 8)}
          </h2>
          <p>
            Credit status: <strong>{detail.case.credit_status}</strong> ·
            Review: {detail.case.decision}
          </p>
          <p className="break-all">
            Original debit: {detail.case.debit_id ?? "No debit"}
          </p>
          <button
            className={inputClass}
            disabled={busy}
            onClick={() => openCase(detail.case.id)}
          >
            Refresh case
          </button>
          <label className="grid gap-1">
            Internal review note
            <textarea
              className={inputClass}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby="note-help"
            />
          </label>
          <p id="note-help">
            Required for approval, rejection or comments. Do not paste resumes,
            questions or generated answers. Notes are never included in
            receipts.
          </p>
          <div className="flex flex-wrap gap-3">
            {(["approve", "reject", "comment"] as const).map((action) => (
              <button
                key={action}
                className={inputClass}
                disabled={
                  busy || !note.trim() || (action !== "comment" && !eligible)
                }
                onClick={() => act(action)}
              >
                {action === "approve"
                  ? "Approve and restore credits"
                  : action === "reject"
                    ? "Reject restoration"
                    : "Add comment"}
              </button>
            ))}
            {detail.case.decision === "approved" &&
              detail.case.credit_status === "pending" && (
                <button
                  className={inputClass}
                  disabled={busy}
                  onClick={() => act("retry")}
                >
                  Retry approved restoration
                </button>
              )}
          </div>
          <h3>Review history</h3>
          {detail.hasMoreEvents && (
            <p>Showing the latest 100 events; older events remain retained.</p>
          )}
          <ol>
            {detail.events.map((event) => (
              <li
                key={event.id}
                className="my-3 whitespace-pre-wrap break-words"
              >
                {new Date(event.created_at).toLocaleString()} · {event.action} ·{" "}
                {event.actor_id}
                <p>{event.note}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
