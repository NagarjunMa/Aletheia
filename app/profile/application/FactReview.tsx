"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import {
  CANDIDATE_FACT_KINDS,
  MAX_REVIEWED_FACTS,
  evidenceFactSources,
  findCompleteFactSource,
  readFactReview,
  suggestFactExcerpts,
  type CandidateFact,
} from "@/lib/candidate-profile/fact-review";
import { saveCandidateFactReview } from "./actions";

const control =
  "w-full rounded-lg border border-accent/20 bg-background/55 px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-accent";

export default function FactReview({
  evidence,
  onSaved,
  onClose,
  onEdit,
  onReload,
}: {
  evidence: CandidateEvidenceRecord;
  onSaved: (_evidence: CandidateEvidenceRecord) => void;
  onClose: () => void;
  onEdit?: () => void;
  onReload?: () => void;
}) {
  const existing = readFactReview(evidence, evidence.factReview);
  const sources = evidenceFactSources(evidence);
  const formId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const excerptInput = useRef<HTMLTextAreaElement>(null);
  const saving = useRef(false);
  const [excerpts, setExcerpts] = useState(() =>
    [
      ...new Set([
        ...existing.map((fact) => fact.excerpt),
        ...suggestFactExcerpts(evidence),
      ]),
    ].slice(0, MAX_REVIEWED_FACTS),
  );
  const [facts, setFacts] = useState<CandidateFact[]>(existing);
  const [kinds, setKinds] = useState<
    Record<string, CandidateFact["kind"] | "">
  >(() =>
    Object.fromEntries([
      ...suggestFactExcerpts(evidence).map((excerpt) => [
        excerpt,
        sources.find((source) => source.text === excerpt)?.kind ?? "action",
      ]),
      ...existing.map((fact) => [fact.excerpt, fact.kind]),
    ]),
  );
  const [custom, setCustom] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [stale, setStale] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (editing !== null) excerptInput.current?.focus();
  }, [editing]);
  useEffect(() => {
    if (notice) alert.current?.focus();
  }, [notice]);

  function changeExcerpt() {
    const excerpt = custom.trim();
    const source = findCompleteFactSource(sources, excerpt);
    if (!excerpt || !source) {
      setNotice("Choose a complete entry from the saved project.");
      return;
    }
    if (excerpt !== editing && excerpts.includes(excerpt)) {
      setNotice("This excerpt is already on the list.");
      return;
    }
    if (editing === null) {
      setExcerpts((current) => [...current, excerpt]);
    } else if (excerpt !== editing) {
      setExcerpts((current) =>
        current.map((value) => (value === editing ? excerpt : value)),
      );
      setFacts((current) => current.filter((fact) => fact.excerpt !== editing));
    }
    if (excerpt !== editing)
      setKinds((current) => ({ ...current, [excerpt]: source.kind }));
    setCustom("");
    setEditing(null);
    setNotice("");
  }

  function confirmFacts() {
    if (saving.current || stale) return;
    saving.current = true;
    setNotice("");
    startTransition(async () => {
      try {
        const result = await saveCandidateFactReview({
          evidenceId: evidence.id,
          expectedRevision: evidence.updatedAt,
          facts,
        });
        if (!result.ok) {
          setNotice(result.error);
          setStale(Boolean(result.stale));
          return;
        }
        onSaved(result.evidence);
      } catch {
        setNotice("Could not save reviewed facts. Please try again.");
      } finally {
        saving.current = false;
      }
    });
  }

  return (
    <section
      aria-label={`Review facts for ${evidence.title}`}
      className="mt-4 space-y-5 rounded-xl border border-accent/25 bg-background/65 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4
            ref={heading}
            tabIndex={-1}
            className="text-lg font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            Review individual facts
          </h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Select the exact excerpts you can confirm. Keep qualifications such
            as team ownership, prototype scope, simulated results, or dates.
            Application answers can draw on the facts you confirm here.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-lg px-3 py-2 text-sm text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          Finish later
        </button>
      </div>
      <details open className="rounded-lg border border-accent/15 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          Original project context and qualifications
        </summary>
        <dl className="mt-3 space-y-3 break-words">
          {[
            ["Title", evidence.title],
            ["Context", evidence.context],
            ["Actions", evidence.actions],
            ["Outcome", evidence.outcome],
            ["Metrics", evidence.metrics.join("; ")],
            ["Skills", evidence.skills.join(", ")],
          ].map(([label, text]) =>
            text ? (
              <div key={label}>
                <dt className="text-accent">{label}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {text}
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      </details>
      {excerpts.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Add a complete saved entry or edit the project to write a shorter
          action, reason or outcome with its qualifications.
        </p>
      )}
      <fieldset
        disabled={pending || stale}
        className="space-y-4 disabled:opacity-60"
      >
        <legend className="sr-only">Individual assertions to confirm</legend>
        {excerpts.map((excerpt, index) => {
          const source =
            sources.find(({ text }) => text === excerpt) ??
            sources.find(({ text }) => text.includes(excerpt));
          return (
            <div
              key={excerpt}
              className="space-y-3 rounded-lg border border-accent/15 p-4"
            >
              <p className="text-xs font-semibold text-accent">
                Source · {source?.field}
              </p>
              <blockquote
                id={`${formId}-quote-${index}`}
                className="whitespace-pre-wrap break-words text-sm leading-6"
              >
                {excerpt}
              </blockquote>
              <p className="text-sm text-muted-foreground">
                <strong>What this demonstrates</strong> {source?.demonstrates}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs text-accent focus-visible:outline-2 focus-visible:outline-accent"
                  onClick={() => {
                    setCustom(excerpt);
                    setEditing(excerpt);
                  }}
                >
                  Edit excerpt
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs text-muted-foreground"
                  onClick={() => {
                    setExcerpts((current) =>
                      current.filter((value) => value !== excerpt),
                    );
                    setFacts((current) =>
                      current.filter((fact) => fact.excerpt !== excerpt),
                    );
                  }}
                >
                  Remove excerpt
                </button>
              </div>
              <label
                className="block text-sm"
                htmlFor={`${formId}-kind-${index}`}
              >
                Fact type
              </label>
              <select
                id={`${formId}-kind-${index}`}
                className={control}
                value={kinds[excerpt] ?? ""}
                onChange={(event) => {
                  setKinds((current) => ({
                    ...current,
                    [excerpt]: event.target.value as CandidateFact["kind"] | "",
                  }));
                  setFacts((current) =>
                    current.filter((fact) => fact.excerpt !== excerpt),
                  );
                }}
              >
                <option value="">Choose a type before confirming</option>
                {CANDIDATE_FACT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  className="mt-1 accent-accent"
                  aria-describedby={`${formId}-quote-${index}`}
                  disabled={!kinds[excerpt]}
                  checked={facts.some((fact) => fact.excerpt === excerpt)}
                  onChange={(event) => {
                    const kind = kinds[excerpt];
                    if (!kind) return;
                    setFacts((current) =>
                      event.target.checked
                        ? [
                            ...current.filter(
                              (fact) => fact.excerpt !== excerpt,
                            ),
                            {
                              id: crypto.randomUUID(),
                              kind,
                              excerpt,
                              confirmed: true,
                            },
                          ]
                        : current.filter((fact) => fact.excerpt !== excerpt),
                    );
                  }}
                />
                This is one complete {kinds[excerpt] || "typed"} assertion. I
                confirm its actor, scope, and qualifications are accurate in the
                original context.
              </label>
            </div>
          );
        })}
        {editing !== null || excerpts.length < MAX_REVIEWED_FACTS ? (
          <div className="space-y-2">
            <label htmlFor={`${formId}-excerpt`} className="text-sm">
              {editing !== null
                ? "Edit the exact source excerpt"
                : "Add another exact excerpt from this saved project"}
            </label>
            <textarea
              ref={excerptInput}
              id={`${formId}-excerpt`}
              className={control}
              maxLength={600}
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
            <button
              type="button"
              className="rounded-lg border border-accent/20 px-3 py-2 text-sm"
              disabled={!custom.trim()}
              onClick={changeExcerpt}
            >
              {editing !== null ? "Update excerpt" : "Add excerpt"}
            </button>
            {editing !== null && (
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
                onClick={() => {
                  setEditing(null);
                  setCustom("");
                  setNotice("");
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        ) : null}
      </fieldset>
      {notice ? (
        <p
          ref={alert}
          tabIndex={-1}
          role="alert"
          className="text-sm text-rose-200"
        >
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={
            pending ||
            stale ||
            !evidence.updatedAt ||
            (!facts.length && !existing.length)
          }
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={confirmFacts}
        >
          {pending
            ? "Saving reviewed facts…"
            : facts.length
              ? "Confirm selected facts"
              : "Withdraw reviewed facts"}
        </button>
        {stale && onReload && (
          <button
            type="button"
            onClick={onReload}
            className="rounded-lg px-3 py-2 text-sm text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            Reload saved project
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            disabled={pending || stale}
            onClick={onEdit}
            className="rounded-lg px-3 py-2 text-sm text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            Edit project details
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          {facts.length} of {MAX_REVIEWED_FACTS} facts selected.
        </p>
      </div>
    </section>
  );
}
