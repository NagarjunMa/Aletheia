/** Project the public grounding diagnostic without copying arbitrary response fields. */
export function readApplicationEvidenceGap({ status, code, evidenceGap } = {}) {
  if (
    status !== 422 ||
    !["GROUNDING_PROFILE_INCOMPLETE", "INSUFFICIENT_GROUNDING"].includes(
      code,
    ) ||
    !evidenceGap ||
    typeof evidenceGap !== "object"
  )
    return;

  const { reason, questionNumbers } = evidenceGap;
  if (reason === "shared_coverage") {
    if (code === "INSUFFICIENT_GROUNDING" && questionNumbers === undefined)
      return { reason };
    return;
  }
  if (
    ![
      "missing_reviewed_facts",
      "missing_rationale",
      "incomplete_answer",
    ].includes(reason) ||
    !Array.isArray(questionNumbers) ||
    questionNumbers.length < 1 ||
    questionNumbers.length > 5 ||
    !Array.from(questionNumbers).every(
      (n, i) =>
        Number.isInteger(n) &&
        n >= 1 &&
        n <= 5 &&
        (i === 0 || n > questionNumbers[i - 1]),
    )
  )
    return;

  return { reason, questionNumbers: [...questionNumbers] };
}
