import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_FILES = [
  "AGENTS.md",
  "docs/agents/engineering-guide.md",
  ".github/pull_request_template.md",
] as const;

export const ENGINEERING_POLICY_MARKERS = [
  "<!-- engineering-policy:contract -->",
  "<!-- engineering-policy:risk -->",
  "<!-- engineering-policy:implementation -->",
  "<!-- engineering-policy:review -->",
  "<!-- engineering-policy:evidence -->",
  "<!-- engineering-policy:stop -->",
  "<!-- engineering-policy:aletheia -->",
] as const;

export const POLICY_EVIDENCE_MARKERS = [
  "<!-- engineering-loop:acceptance -->",
  "<!-- engineering-loop:risk -->",
  "<!-- engineering-loop:evidence -->",
  "<!-- engineering-loop:security -->",
  "<!-- engineering-loop:performance -->",
  "<!-- engineering-loop:compatibility -->",
  "<!-- engineering-loop:regression -->",
  "<!-- engineering-loop:remaining-risk -->",
] as const;

const PLACEHOLDER_PATTERNS = [
  /\bTODO(?:\([^)]*\))?\s*:/i,
  /\bTBD\b/i,
  /<skill-name>/i,
  /replace this scaffold/i,
  /write (?:your|the) .{0,40} here/i,
] as const;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function validateEngineeringPolicy(
  repositoryRoot = process.cwd(),
): Promise<string[]> {
  const errors: string[] = [];
  const contents = new Map<string, string>();

  for (const relativePath of REQUIRED_FILES) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    if (!(await fileExists(absolutePath))) {
      errors.push(`Missing required file: ${relativePath}`);
      continue;
    }

    contents.set(relativePath, await readFile(absolutePath, "utf8"));
  }

  const agents = contents.get("AGENTS.md");
  if (agents !== undefined) {
    if (!agents.includes("docs/agents/engineering-guide.md")) {
      errors.push("AGENTS.md must reference docs/agents/engineering-guide.md");
    }
    if (!agents.includes("Mandatory Engineering Loop")) {
      errors.push("AGENTS.md must require the Mandatory Engineering Loop");
    }
  }

  const guide = contents.get("docs/agents/engineering-guide.md");
  if (guide !== undefined) {
    for (const marker of ENGINEERING_POLICY_MARKERS) {
      if (!guide.includes(marker)) {
        errors.push(`Engineering guide is missing policy marker: ${marker}`);
      }
    }
  }

  const template = contents.get(".github/pull_request_template.md");
  if (template !== undefined) {
    for (const marker of POLICY_EVIDENCE_MARKERS) {
      if (!template.includes(marker)) {
        errors.push(
          `Pull request template is missing evidence marker: ${marker}`,
        );
      }
    }
  }

  for (const [relativePath, content] of contents) {
    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(content))) {
      errors.push(`Unfinished scaffold placeholder in ${relativePath}`);
    }
  }

  return errors;
}

/** A structural evidence check, never a claim that the stated checks actually ran. */
export function validatePullRequestEvidence(body: unknown): string[] {
  if (typeof body !== "string" || !body.trim() || body.length > 65_536)
    return ["Provide a nonempty PR description within 65536 characters."];
  const visible: string[] = [];
  let fence: { character: string; length: number } | undefined;
  for (const line of body
    .replace(/<!--[\s\S]*?(?:-->|$)/gu, "")
    .split(/\r?\n/u)) {
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if (fence) {
      if (
        delimiter &&
        delimiter[1]?.[0] === fence.character &&
        delimiter[1].length >= fence.length &&
        !delimiter[2]?.trim()
      )
        fence = undefined;
      continue;
    }
    if (delimiter) {
      fence = { character: delimiter[1]![0]!, length: delimiter[1]!.length };
      continue;
    }
    if (/^(?: {4}|\t|\s*>)/u.test(line)) continue;
    visible.push(line.replace(/\*\*/gu, ""));
  }
  const completed = (value: string) =>
    Boolean(value.trim()) &&
    !/^(?:TBD|TODO)\b/iu.test(value.trim()) &&
    !/^(?:N\/A|none|reason|result|command)$/iu.test(value.trim()) &&
    !/<[^>]+>/u.test(value);
  const errors: string[] = [];
  const risk = visible
    .map((line) =>
      line.match(
        /^\s*(?:[-*]\s+)?Risk(?: tier)?:\s*(Trivial|Standard|Significant|Critical)\s*[—–:-]\s*(.+)$/iu,
      ),
    )
    .find((match) => match && completed(match[2] ?? ""));
  if (!risk)
    errors.push("Add Risk: Trivial/Standard/Significant/Critical — reason.");
  let verificationLevel: number | undefined;
  let evidence = false;
  for (const line of visible) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/u);
    if (heading) {
      const level = heading[1]!.length;
      if (verificationLevel !== undefined && level <= verificationLevel)
        verificationLevel = undefined;
      if (
        /^(?:Verification|Validation)(?: evidence)?$/iu.test(
          (heading[2] ?? "").replace(/\s+#+\s*$/u, ""),
        )
      )
        verificationLevel ??= level;
    }
    if (verificationLevel !== undefined) {
      const outcome = line.match(
        /^\s*(?:[-*]\s+)?(?:Passed|Failed|Blocked|Not run):\s*(.+)$/iu,
      );
      if (outcome && completed(outcome[1] ?? "")) evidence = true;
    }
  }
  if (!evidence)
    errors.push(
      "Under Verification or Validation, add Passed/Failed/Blocked/Not run: check and result or reason.",
    );
  return errors;
}

async function runCli(): Promise<void> {
  const errors = await validateEngineeringPolicy();
  const args = process.argv.slice(2);
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--event" || !args[1])
      throw new Error("Invalid policy CLI arguments");
    if ((await stat(args[1])).size > 2_097_152)
      throw new Error("PR event exceeds the input bound");
    const event: unknown = JSON.parse(await readFile(args[1], "utf8"));
    const pr =
      event && typeof event === "object" && "pull_request" in event
        ? event.pull_request
        : null;
    const body = pr && typeof pr === "object" && "body" in pr ? pr.body : null;
    errors.push(...validatePullRequestEvidence(body));
  }
  if (errors.length > 0) {
    console.error("Engineering policy validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Engineering policy validation passed.");
}

const invokedScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedScript === import.meta.url) {
  void runCli().catch(() => {
    console.error(
      "Engineering policy validation could not run; check files and the PR event format/size.",
    );
    process.exitCode = 1;
  });
}
