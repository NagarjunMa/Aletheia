export function formatGenerationElapsed(elapsedMs) {
  const seconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function getGenerationProgress(phase, elapsedMs) {
  const preparing = phase === "preparing";
  return {
    label: preparing
      ? "Preparing your selected context"
      : "Generating your draft",
    hint:
      elapsedMs >= 120_000
        ? "Taking longer than expected. Keep this panel open while we wait."
        : "This can take around two minutes; actual time varies.",
    orbState: preparing ? "weaving" : "composing",
  };
}
