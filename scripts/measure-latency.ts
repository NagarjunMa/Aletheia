import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is not set");
  }
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY environment variable is not set",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("user_feedback")
    .select("metadata")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const times = (data ?? [])
    .map((r) =>
      Number((r.metadata as Record<string, unknown>)?.generationTimeMs),
    )
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (times.length === 0) {
    console.log("No samples.");
    return;
  }

  const pct = (p: number) =>
    times[Math.floor(times.length * p)] ?? (times.at(-1) as number);
  const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  console.log(`N=${times.length}`);
  console.log(`p50 ${fmt(pct(0.5))}`);
  console.log(`p90 ${fmt(pct(0.9))}`);
  console.log(`p95 ${fmt(pct(0.95))}`);
  console.log(`p99 ${fmt(pct(0.99))}`);
  console.log(`max ${fmt(pct(1))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
