import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  bypassHeader,
  GateError,
  readHostedPreviewConfig,
} from "./hosted-preview-config";

const protectedStatus = [301, 302, 303, 307, 308, 401, 403];

export async function runMessageFocusPreflight(
  env: Readonly<Record<string, string | undefined>>,
  inventory: unknown,
  transport = fetch,
) {
  const config = readHostedPreviewConfig(env);
  const inventoryResult = z
    .object({ deployments: z.array(z.unknown()) })
    .safeParse(inventory);
  for (const { mode, url } of config.targets) {
    const deployment = z.object({
      url: z.literal(url.hostname),
      target: z.null(),
      state: z.literal("READY"),
      meta: z.object({ githubCommitSha: z.literal(config.sha) }),
    });
    if (
      !inventoryResult.success ||
      !inventoryResult.data.deployments.some(
        (entry) => deployment.safeParse(entry).success,
      )
    )
      throw new GateError(`Preview inventory check failed (${mode})`);
  }

  const previews = [];
  for (const { mode, url } of config.targets) {
    const enabled = mode === "on";
    async function readProtected(path: string): Promise<unknown> {
      const endpoint = new URL(path, url);
      const options = {
        redirect: "manual",
        cache: "no-store",
      } as const;
      try {
        const locked = await transport(endpoint, {
          ...options,
          signal: AbortSignal.timeout(15_000),
        });
        if (!protectedStatus.includes(locked.status))
          throw new GateError(
            `Preview protection check failed (${mode}, ${path})`,
          );

        const response = await transport(endpoint, {
          ...options,
          headers: { [bypassHeader]: config.bypass },
          signal: AbortSignal.timeout(15_000),
        });
        if (response.status !== 200)
          throw new GateError(
            `Preview response check failed (${mode}, ${path})`,
          );
        return await response.json();
      } catch (error) {
        if (error instanceof GateError) throw error;
        throw new GateError(`Preview response check failed (${mode}, ${path})`);
      }
    }

    const health = z.object({
      status: z.literal("ok"),
      deploymentSha: z.literal(config.sha),
      supabaseOrigin: z.literal(config.supabase.origin),
      groundedResponseGate: z.object({
        projectId: z.literal(config.projectId),
        deploymentHost: z.literal(url.hostname),
        rhetoricalPlans: z.boolean(),
        providerWireDebug: z.boolean(),
      }),
    });
    const identity = health.safeParse(await readProtected("/api/health"));
    if (!identity.success)
      throw new GateError(`Preview identity check failed (${mode})`);
    if (identity.data.groundedResponseGate.providerWireDebug)
      throw new GateError(
        `Preview comparison check failed (${mode}): turn provider wire debug off`,
      );
    if (identity.data.groundedResponseGate.rhetoricalPlans)
      throw new GateError(
        `Preview comparison check failed (${mode}): turn rhetorical plans off`,
      );

    const extensionConfig = z.object({
      supabase_url: z
        .string()
        .refine((value) => URL.parse(value)?.origin === config.supabase.origin),
      capabilities: z.object({ messageFocus: z.literal(enabled) }),
    });
    if (
      !extensionConfig.safeParse(await readProtected("/api/extension/config"))
        .success
    )
      throw new GateError(`Preview capability check failed (${mode})`);
    previews.push({ mode, messageFocus: enabled });
  }

  return { deploymentSha: config.sha, previews };
}

export function loadMessageFocusPreviewInventory(projectId: string): unknown {
  const cliEnv = { ...process.env };
  for (const key of Object.keys(cliEnv)) {
    if (
      key.startsWith("GROUNDED_GATE_") ||
      key.startsWith("MESSAGE_FOCUS_GATE_")
    )
      delete cliEnv[key];
  }
  try {
    return JSON.parse(
      execFileSync(
        "vercel",
        [
          "list",
          projectId,
          "--environment",
          "preview",
          "--status",
          "READY",
          "--json",
          "--limit",
          "100",
        ],
        {
          encoding: "utf8",
          env: cliEnv,
          timeout: 30_000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    );
  } catch {
    throw new GateError(
      "Vercel Preview inventory unavailable; check the CLI session and project access",
    );
  }
}

async function main() {
  try {
    const { projectId } = readHostedPreviewConfig(process.env);
    const result = await runMessageFocusPreflight(
      process.env,
      loadMessageFocusPreviewInventory(projectId),
    );
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    const reason =
      error instanceof GateError ? error.message : "Protected request failed";
    process.stderr.write(`Message Focus rollout preflight failed. ${reason}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
