const modes = ["off", "on"] as const;
export const bypassHeader = "x-vercel-protection-bypass";
const shaPattern = /^[a-f0-9]{40}$/u;
const projectPattern = /^prj_[a-z0-9_]+$/iu;
const vercelHost = /^[a-z0-9][a-z0-9-]*\.vercel\.app$/u;
const supabaseHost = /^[a-z0-9]+\.supabase\.co$/u;

export class GateError extends Error {}

export function readHostedPreviewConfig(
  env: Readonly<Record<string, string | undefined>>,
) {
  function required(key: string) {
    const value = env[`GROUNDED_GATE_${key}`];
    if (!value?.trim()) throw new GateError(`Missing configuration: ${key}`);
    return value;
  }

  function origin(key: string, hostPattern: RegExp) {
    const value = required(key);
    const url = URL.parse(value);
    if (
      !url ||
      url.protocol !== "https:" ||
      url.port !== "" ||
      !hostPattern.test(url.hostname) ||
      (value !== url.origin && value !== `${url.origin}/`)
    )
      throw new GateError(`Invalid origin: ${key}`);
    return url;
  }

  if (required("CONFIRM") !== "yes")
    throw new GateError("Isolation confirmation required");
  const sha = required("SHA");
  if (!shaPattern.test(sha)) throw new GateError("Full workflow SHA required");

  const projectId = required("PROJECT_ID");
  const productionProjectId = required("PRODUCTION_PROJECT_ID");
  if (
    !projectPattern.test(projectId) ||
    !projectPattern.test(productionProjectId) ||
    projectId.toLowerCase() === productionProjectId.toLowerCase()
  )
    throw new GateError("Isolated Vercel project identity required");

  const productionApp = origin("PRODUCTION_APP_URL", /^[a-z0-9.-]+[a-z0-9]$/u);
  const supabase = origin("SUPABASE_URL", supabaseHost);
  const productionSupabase = origin("PRODUCTION_SUPABASE_URL", supabaseHost);
  if (supabase.origin === productionSupabase.origin)
    throw new GateError("Production Supabase project is forbidden");

  const targets = modes.map((mode) => {
    const url = origin(`${mode.toUpperCase()}_URL`, vercelHost);
    if (url.hostname === productionApp.hostname)
      throw new GateError("Production application is forbidden");
    return { mode, url };
  });
  if (new Set(targets.map(({ url }) => url.origin)).size !== modes.length)
    throw new GateError("Distinct Preview deployments required");

  return {
    sha,
    projectId,
    supabase,
    targets,
    bypass: required("VERCEL_BYPASS"),
  };
}
