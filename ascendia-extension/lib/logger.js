import {
  DIAGNOSTIC_BUFFER_KEY,
  appendDiagnosticEvent,
  buildDiagnosticEvent,
  createOperationId,
} from "./logger-core.js";

let diagnosticWriteQueue = Promise.resolve();

async function persistDiagnosticEvent(event) {
  // chrome.storage has no atomic read-modify-write operation. Serialize
  // writes so back-to-back lifecycle events cannot overwrite one another.
  diagnosticWriteQueue = diagnosticWriteQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        const storage =
          typeof chrome === "undefined" ? undefined : chrome.storage?.session;
        if (!storage) return;
        const current = await storage.get(DIAGNOSTIC_BUFFER_KEY);
        await storage.set({
          [DIAGNOSTIC_BUFFER_KEY]: appendDiagnosticEvent(
            current[DIAGNOSTIC_BUFFER_KEY],
            event,
          ),
        });
      } catch {
        // Content scripts and suspended contexts must retain console diagnostics
        // without making the buffer a requirement for the user-facing workflow.
      }
    });

  return diagnosticWriteQueue;
}

export { createOperationId };

// Exposed for best-effort shutdown handling and deterministic tests. This never
// sends diagnostics anywhere; it only waits for the local session-store queue.
export function flushExtensionDiagnostics() {
  return diagnosticWriteQueue.catch(() => undefined);
}

export function createExtensionLogger(module, { persist = true } = {}) {
  function log(level, event, fields = {}) {
    const entry = buildDiagnosticEvent({ module, level, event, fields });
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else if (level === "debug") console.debug(line);
    else console.log(line);
    if (persist) void persistDiagnosticEvent(entry);
    return entry;
  }

  return {
    debug: (event, fields) => log("debug", event, fields),
    info: (event, fields) => log("info", event, fields),
    warn: (event, fields) => log("warn", event, fields),
    error: (event, fields) => log("error", event, fields),
  };
}

/**
 * Emits the same entry and terminal events as the server-side timed-stage
 * helper. Diagnostics remain local to the extension and every field passes
 * through logger-core redaction before it reaches the console or session
 * buffer.
 */
export function startExtensionTimedStage(logger, stage, fields = {}) {
  const startedAt = Date.now();
  logger.info("stage.start", {
    stage,
    outcome: "started",
    ...fields,
  });

  return (outcome, terminalFields = {}) => {
    logger.info("stage.complete", {
      stage,
      outcome,
      durationMs: Math.max(0, Date.now() - startedAt),
      ...terminalFields,
    });
  };
}
