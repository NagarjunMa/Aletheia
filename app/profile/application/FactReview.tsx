"use client";

import { useState, useTransition } from "react";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import {
  CANDIDATE_FACT_KINDS,
  MAX_REVIEWED_FACTS,
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
}: {
  evidence: CandidateEvidenceRecord;
  onSaved: (_evidence: CandidateEvidenceRecord) => void;
  onClose: () => void;
}) {
  const existing = readFactReview(evidence, evidence.factReview);
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
    Object.fromEntries(existing.map((fact) => [fact.excerpt, fact.kind])),
  );
  const [custom, setCustom] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section
      aria-label={`Review facts for ${evidence.title}`}
      className="mt-4 space-y-5 rounded-xl border border-accent/25 bg-background/65 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-lg font-semibold text-foreground">
            Review individual facts
          </h4>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose only complete, accurate assertions. Keep limitations such as
            prototype, simulated results, team ownership, or dates. Suggestions
            are excerpts, not verified facts. Review once here—not before each
            draft.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-lg px-3 py-2 text-sm text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          Close review
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
      {!evidence.confirmed ? (
        <p role="status" className="text-sm text-muted-foreground">
          Save and confirm the project before reviewing facts.
        </p>
      ) : null}
      <fieldset
        disabled={pending || !evidence.confirmed}
        className="space-y-4 disabled:opacity-60"
      >
        <legend className="sr-only">Individual assertions to confirm</legend>
        {excerpts.map((excerpt, index) => (
          <div
            key={excerpt}
            className="space-y-3 rounded-lg border border-accent/15 p-4"
          >
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {excerpt}
            </p>
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
            <label className="block text-sm" htmlFor={`fact-kind-${index}`}>
              Fact type
            </label>
            <select
              id={`fact-kind-${index}`}
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
                disabled={!kinds[excerpt]}
                checked={facts.some((fact) => fact.excerpt === excerpt)}
                onChange={(event) => {
                  const kind = kinds[excerpt];
                  if (!kind) return;
                  setFacts((current) =>
                    event.target.checked
                      ? [
                          ...current.filter((fact) => fact.excerpt !== excerpt),
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
        ))}
        {excerpts.length < MAX_REVIEWED_FACTS ? (
          <div className="space-y-2">
            <label htmlFor="fact-excerpt" className="text-sm">
              Add another exact excerpt from this saved project
            </label>
            <textarea
              id="fact-excerpt"
              className={control}
              maxLength={600}
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
            <button
              type="button"
              className="rounded-lg border border-accent/20 px-3 py-2 text-sm"
              disabled={!custom.trim()}
              onClick={() => {
                const excerpt = custom.trim();
                if (
                  ![
                    evidence.title,
                    evidence.context,
                    evidence.actions,
                    evidence.outcome,
                    ...evidence.metrics,
                    ...evidence.skills,
                  ].some((field) => field.includes(excerpt))
                ) {
                  setNotice("Choose an exact excerpt from the saved project.");
                  return;
                }
                setExcerpts((current) => [...new Set([...current, excerpt])]);
                setCustom("");
                setNotice("");
              }}
            >
              Add excerpt
            </button>
          </div>
        ) : null}
      </fieldset>
      {notice ? (
        <p role="status" className="text-sm text-accent">
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={pending || !evidence.confirmed || !evidence.updatedAt}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={() => {
            startTransition(async () => {
              try {
                const result = await saveCandidateFactReview({
                  evidenceId: evidence.id,
                  expectedRevision: evidence.updatedAt,
                  facts,
                });
                if (!result.ok) {
                  setNotice(result.error);
                  return;
                }
                onSaved(result.evidence);
                setNotice(
                  "Reviewed facts saved. Editing the project will require a new review.",
                );
              } catch {
                setNotice("Could not save reviewed facts. Please try again.");
              }
            });
          }}
        >
          {pending ? "Saving reviewed facts…" : "Save reviewed facts"}
        </button>
        <p className="text-xs text-muted-foreground">
          {facts.length} of {MAX_REVIEWED_FACTS} facts selected. Save with none
          selected to withdraw them all.
        </p>
      </div>
    </section>
  );
}
