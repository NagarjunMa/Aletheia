/** Only public preflight reasons may cross the worker/popup boundary. */
export function readLinkedinGuidance(response) {
  const value = response?.linkedinGuidance;
  if (
    response?.status !== 422 ||
    response?.code !== "INSUFFICIENT_GROUNDING" ||
    !value ||
    !["missing_context", "no_matching_evidence", "note_limit"].includes(
      value.reason,
    ) ||
    ![200, 300].includes(value.connectionNoteLimit)
  )
    return null;
  return {
    reason: value.reason,
    connectionNoteLimit: value.connectionNoteLimit,
  };
}
