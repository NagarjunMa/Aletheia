import { readFileSync, statSync } from "node:fs";
import { inspectResumeLogExport } from "./resume-production-gate";

const MAX_EXPORT_BYTES = 20 * 1024 * 1024;
const exportPath = process.argv[2];
const canaries = (process.env.RESUME_GATE_LOG_CANARIES ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!exportPath || canaries.length === 0) {
  throw new Error(
    "Provide a log export path and RESUME_GATE_LOG_CANARIES for the isolated test run.",
  );
}
if (statSync(exportPath).size > MAX_EXPORT_BYTES) {
  throw new Error("Resume log export exceeds the 20 MiB audit limit.");
}

const result = inspectResumeLogExport(
  readFileSync(exportPath, "utf8"),
  canaries,
);
const passed =
  result.missingStages.length === 0 &&
  result.leakedCanaries.length === 0 &&
  result.forbiddenFields.length === 0;

console.log(
  JSON.stringify({
    passed,
    eventCount: result.eventCount,
    missingStages: result.missingStages,
    leakedCanaryCount: result.leakedCanaries.length,
    forbiddenFieldCount: result.forbiddenFields.length,
  }),
);
if (!passed) process.exitCode = 1;
