"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CANDIDATE_FACT_KINDS } from "@/lib/candidate-profile/fact-review";
import type { ResumeReviewChoice } from "@/lib/candidate-profile/resume-fact-review";
import { loadResumeFactReview, saveResumeFactReview } from "./actions";

type Review = Extract<
  Awaited<ReturnType<typeof loadResumeFactReview>>,
  { ok: true }
>;
type Entry = ResumeReviewChoice & { source: string; selected: boolean };
const button =
  "rounded-lg border border-accent/25 px-3 py-2 text-sm font-medium text-accent hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";

export default function ResumeFactReview() {
  const id = useId();
  const [review, setReview] = useState<Review | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean }>();
  const [pending, startTransition] = useTransition();
  const editInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing !== null) editInput.current?.focus();
  }, [editing]);

  function close() {
    setReview(null);
    setEntries([]);
    setEditing(null);
  }

  function load() {
    setNotice(undefined);
    startTransition(async () => {
      try {
        const result = await loadResumeFactReview();
        if (!result.ok) {
          setNotice({ message: result.error, error: true });
          return;
        }
        setEntries([
          ...result.facts.map(({ kind, excerpt }) => ({
            kind,
            excerpt,
            source: excerpt,
            selected: true,
          })),
          ...result.suggestions
            .filter(
              (source) =>
                !result.facts.some(
                  ({ excerpt }) =>
                    excerpt === source ||
                    excerpt.startsWith(source + "\n") ||
                    excerpt.endsWith("\n" + source),
                ),
            )
            .map((source) => ({
              kind: "action" as const,
              excerpt: source,
              source,
              selected: false,
            })),
        ]);
        setReview(result);
        setEditing(null);
        setStale(false);
      } catch {
        setNotice({
          message: "Could not load résumé suggestions. Try again.",
          error: true,
        });
      }
    });
  }

  function changeEntry(index: number, update: Partial<Entry>) {
    setEntries((current) =>
      current.map((entry, position) =>
        position === index ? { ...entry, ...update } : entry,
      ),
    );
  }

  function save() {
    if (!review || stale || pending) return;
    const facts = entries
      .filter(({ selected }) => selected)
      .map(({ kind, excerpt }) => ({ kind, excerpt }));
    setNotice(undefined);
    startTransition(async () => {
      try {
        const result = await saveResumeFactReview({
          resumeId: review.resumeId,
          expectedRevision: review.revision,
          facts,
        });
        if (!result.ok) {
          setNotice({ message: result.error, error: true });
          setStale(result.stale);
          if (result.stale) close();
          return;
        }
        close();
        setNotice({
          message: facts.length
            ? "Résumé facts saved."
            : "Résumé facts removed.",
        });
      } catch {
        setNotice({
          message: "Could not save résumé facts. Try again.",
          error: true,
        });
      }
    });
  }

  return (
    <section
      data-dashboard-surface="inset"
      aria-labelledby={id}
      className="mt-5 space-y-3 rounded-xl border border-accent/20 bg-background/55 p-4 sm:p-5"
    >
      <h3 id={id} className="font-semibold text-foreground">
        Review facts from your résumé
      </h3>
      <p className="text-sm leading-6 text-muted-foreground">
        Confirm the excerpts that accurately describe your work. Application
        answers can use selected facts. Replacing your primary résumé or
        deleting it removes its approvals.
      </p>
      <button
        type="button"
        className={button}
        disabled={pending}
        aria-expanded={Boolean(review)}
        aria-controls={id + "-review"}
        onClick={() => {
          if (review) {
            close();
            setNotice(undefined);
          } else {
            load();
          }
        }}
      >
        {review
          ? "Close review"
          : stale
            ? "Reload résumé suggestions"
            : "Show résumé suggestions"}
      </button>
      <div id={id + "-review"} hidden={!review} className="space-y-3">
        {review && (
          <>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No complete work excerpts were found. You can add a project and
                review its facts in the Evidence Library.
              </p>
            ) : (
              <fieldset
                disabled={pending || stale}
                className="space-y-3 disabled:opacity-60"
              >
                <legend className="sr-only">Résumé facts to confirm</legend>
                {entries.map(({ excerpt, kind, selected, source }, index) => (
                  <div
                    key={source}
                    className="space-y-3 rounded-lg border border-accent/15 p-4"
                  >
                    <blockquote
                      id={id + "-source-" + index}
                      className="whitespace-pre-wrap break-words border-l border-accent/55 pl-3 text-sm leading-6"
                    >
                      {source}
                    </blockquote>
                    {editing === index ? (
                      <div>
                        <label
                          htmlFor={id + "-edit-" + index}
                          className="text-sm"
                        >
                          Edit source wording
                        </label>
                        <textarea
                          ref={editInput}
                          id={id + "-edit-" + index}
                          maxLength={600}
                          rows={4}
                          className="mt-1 w-full rounded-lg border border-accent/25 bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent"
                          value={excerpt}
                          onChange={(event) =>
                            changeEntry(index, {
                              excerpt: event.target.value,
                              selected: false,
                            })
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Adjust spacing or add the next complete suggestion.
                          Keep the original claim and all qualifications.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={button}
                        onClick={() => setEditing(index)}
                      >
                        Edit excerpt
                      </button>
                    )}
                    {editing !== index && excerpt !== source && (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {excerpt}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-describedby={id + "-source-" + index}
                          className="size-4 accent-primary"
                          checked={selected}
                          onChange={(event) =>
                            changeEntry(index, {
                              selected: event.target.checked,
                            })
                          }
                        />
                        Confirm fact {index + 1}
                      </label>
                      <label className="flex items-center gap-2">
                        <span>Type</span>
                        <select
                          aria-label={"Fact " + (index + 1) + " type"}
                          className="rounded-lg border border-accent/25 bg-background px-2 py-1 capitalize focus-visible:outline-2 focus-visible:outline-accent"
                          value={kind}
                          onChange={(event) =>
                            changeEntry(index, {
                              kind: event.target.value as Entry["kind"],
                              selected: false,
                            })
                          }
                        >
                          {CANDIDATE_FACT_KINDS.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </fieldset>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button + " bg-primary/12 text-foreground"}
                disabled={
                  pending ||
                  stale ||
                  (!review.facts.length &&
                    !entries.some(({ selected }) => selected))
                }
                onClick={save}
              >
                Save reviewed résumé facts
              </button>
            </div>
          </>
        )}
      </div>
      {pending && !notice && (
        <p role="status" className="text-sm text-muted-foreground">
          Working…
        </p>
      )}
      {notice && (
        <p role={notice.error ? "alert" : "status"} className="text-sm">
          {notice.message}
        </p>
      )}
    </section>
  );
}
