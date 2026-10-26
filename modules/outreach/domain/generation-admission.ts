/** Server-owned estimated output work, never read from extension payloads. */
export function outputWorkUnits(maxOutputTokens: number): number {
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1)
    throw new Error("Invalid model output budget");
  return Math.ceil(maxOutputTokens / 1_000);
}

export function retryAfterSeconds(retryTime: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((retryTime - now) / 1_000));
}

/** The largest supported YC batch reserves eight output-work units. */
export function resolveWorkUnitLimit(raw: string | undefined): number {
  const value = Number(raw ?? 60);
  return Number.isSafeInteger(value) && value >= 8 && value <= 1_000
    ? value
    : 60;
}
// Keep the admission round trip and complete provider body well inside the
// database's three-minute recovery lease.
export const ADMISSION_RPC_TIMEOUT_MS = 10_000;
export const GENERATION_MODEL_TIMEOUT_MS = 30_000;
