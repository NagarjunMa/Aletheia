import { readBounded } from "./evaluate-generation";
import { performance } from "node:perf_hooks";
import {
  runDiscourseBaseline,
  compareDiscourseVariant,
} from "../lib/ai/evals/grounded-discourse-report";

try {
  const args = process.argv.slice(2);
  if (args.length !== 0 && !(args.length === 2 && args[0] === "--variant"))
    throw new Error("Arguments");
  let variant: unknown;
  if (args.length) {
    variant = JSON.parse(readBounded(args[1]!, 2_000_000));
  }
  const start = performance.now();
  const report =
    variant === undefined
      ? runDiscourseBaseline()
      : compareDiscourseVariant(variant);
  process.stdout.write(
    JSON.stringify(
      {
        ...report,
        localEvaluationMs: Number((performance.now() - start).toFixed(3)),
      },
      null,
      2,
    ) + "\n",
  );
} catch {
  process.stderr.write(
    "Offline discourse evaluation failed. Check arguments and the locked synthetic fixture contract.\n",
  );
  process.exitCode = 1;
}
