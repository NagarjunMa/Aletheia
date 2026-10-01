import { z } from "zod";

export interface ConnectionValidationDetail {
  field: string;
  code: string;
  actualCount?: number;
  bound?: number;
  unit?: "characters" | "items";
}

const MAX_DETAILS = 8;

function safeField(path: (string | number)[]): string {
  if (
    path.length === 1 &&
    (path[0] === "target_observation" || path[0] === "cta")
  )
    return path[0];
  if (path[0] === "candidate_relevance") {
    if (path.length === 1) return "candidate_relevance";
    if (path.length === 2 && path[1] === "text")
      return "candidate_relevance.text";
    if (path[1] === "source_ids") {
      if (path.length === 2) return "candidate_relevance.source_ids";
      if (path.length === 3 && typeof path[2] === "number")
        return "candidate_relevance.source_ids.item";
    }
  }
  return "composition";
}

/** Only fixed paths, Zod codes and numeric bounds cross the logging boundary. */
export function connectionValidationDiagnostics(
  error: z.ZodError,
  input: unknown,
) {
  const pending = [...error.issues];
  const validationDetails: ConnectionValidationDetail[] = [];
  while (pending.length && validationDetails.length < MAX_DETAILS) {
    const issue = pending.shift();
    if (!issue) break;
    const detail: ConnectionValidationDetail = {
      field: safeField(issue.path),
      code: issue.code,
    };
    if (issue.code === "invalid_union") {
      // Zod wraps relevance-object failures in a nullable union. Expand only a
      // bounded prefix so text, array and item failures remain distinguishable.
      pending.unshift(
        ...issue.unionErrors
          .flatMap((branch) => branch.issues)
          .slice(0, MAX_DETAILS),
      );
    }
    if (issue.code === "too_big" || issue.code === "too_small") {
      let value: unknown = input;
      for (const part of issue.path) {
        value =
          value && typeof value === "object"
            ? (value as Record<string | number, unknown>)[part]
            : undefined;
      }
      const actual =
        typeof value === "string"
          ? issue.code === "too_small" ||
            detail.field === "candidate_relevance.source_ids.item"
            ? value.trim().length
            : value.length
          : Array.isArray(value)
            ? value.length
            : undefined;
      const bound = issue.code === "too_big" ? issue.maximum : issue.minimum;
      if (actual !== undefined && typeof bound === "number") {
        detail.actualCount = actual;
        detail.bound = bound;
        detail.unit = Array.isArray(value) ? "items" : "characters";
      }
    }
    validationDetails.push(detail);
  }
  return {
    invalidFields: [
      ...new Set(
        validationDetails
          .map(({ field }) => field.split(".")[0])
          .filter(
            (field): field is string =>
              typeof field === "string" && field !== "composition",
          ),
      ),
    ],
    validationCodes: [...new Set(validationDetails.map(({ code }) => code))],
    validationDetails,
  };
}
