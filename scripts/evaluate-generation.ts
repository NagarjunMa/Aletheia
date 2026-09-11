import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  evaluateGeneration,
  MAX_EXPORT_BYTES,
  renderReport,
  validateManifest,
} from "./generation-evaluation";

/** Read through the same descriptor used for the size/type check, with a hard cap. */
function readBounded(path: string, remaining: number): string {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > remaining)
      throw new Error("Export byte limit exceeded.");
    const data = Buffer.alloc(Math.min(stat.size + 1, remaining + 1));
    let length = 0;
    while (length < data.length) {
      const n = readSync(fd, data, length, data.length - length, null);
      if (!n) break;
      length += n;
    }
    if (length !== stat.size || length > remaining)
      throw new Error("Export changed or byte limit exceeded.");
    return data.subarray(0, length).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function evaluateToDirectory(args: string[]): void {
  if (
    args.length !== 4 ||
    args[0] !== "--manifest" ||
    args[2] !== "--out" ||
    !args[1] ||
    !args[3]
  )
    throw new Error(
      "Usage: eval:generation -- --manifest <path> --out <directory>",
    );
  const manifestPath = resolve(args[1]);
  let raw: unknown;
  try {
    raw = JSON.parse(readBounded(manifestPath, 64 * 1024));
  } catch {
    throw new Error("Cannot read evaluation manifest.");
  }
  const manifest = validateManifest(raw);
  let remaining = MAX_EXPORT_BYTES;
  const sources = (["server", "client"] as const).flatMap((kind) =>
    manifest[kind].map((path) => {
      const contents = readBounded(
        resolve(dirname(manifestPath), path),
        remaining,
      );
      remaining -= Buffer.byteLength(contents);
      return { kind, contents };
    }),
  );
  const report = evaluateGeneration(manifest, sources);
  const output = resolve(args[3]);
  mkdirSync(output, { recursive: true, mode: 0o700 });
  // Exclusive creation prevents accidentally overwriting an export or following a symlink.
  writeFileSync(resolve(output, "report.html"), renderReport(report), {
    flag: "wx",
    mode: 0o600,
  });
  const { samples: _samples, ...aggregate } = report;
  writeFileSync(
    resolve(output, "aggregate.json"),
    JSON.stringify(aggregate, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
}
export function runEvaluation(args: string[]): void {
  try {
    evaluateToDirectory(args);
  } catch {
    throw new Error(
      "Generation evaluation failed. Check the manifest, input limits and a fresh output directory.",
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    runEvaluation(process.argv.slice(2));
    process.stdout.write("Generation evaluation written successfully.\n");
  } catch {
    process.stderr.write(
      "Generation evaluation failed. Check the manifest, input limits and a fresh output directory.\n",
    );
    process.exitCode = 1;
  }
}
