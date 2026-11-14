import { describe, expect, it, vi } from "vitest";
import { runMessageFocusPreflight } from "./message-focus-rollout-preflight";

const sha = "a".repeat(40);
const off = "https://focus-off-fixture.vercel.app";
const on = "https://focus-on-fixture.vercel.app";
const database = "https://isolatedfixture.supabase.co";
const env = {
  GROUNDED_GATE_CONFIRM: "yes",
  GROUNDED_GATE_SHA: sha,
  GROUNDED_GATE_OFF_URL: off,
  GROUNDED_GATE_ON_URL: on,
  GROUNDED_GATE_PRODUCTION_APP_URL: "https://aletheia.live",
  GROUNDED_GATE_PROJECT_ID: "prj_isolated",
  GROUNDED_GATE_PRODUCTION_PROJECT_ID: "prj_production",
  GROUNDED_GATE_SUPABASE_URL: database,
  GROUNDED_GATE_PRODUCTION_SUPABASE_URL:
    "https://productionfixture.supabase.co",
  GROUNDED_GATE_VERCEL_BYPASS: "fixture-secret",
};

const inventory = {
  deployments: [off, on].map((origin) => ({
    url: new URL(origin).hostname,
    target: null,
    state: "READY",
    meta: { githubCommitSha: sha },
  })),
};

function preview(failure?: string) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const enabled = url.origin === on;
    const broken =
      failure === "off-debug"
        ? !enabled
          ? "debug"
          : undefined
        : enabled
          ? failure
          : undefined;
    const bypass = new Headers(init?.headers).get("x-vercel-protection-bypass");
    expect([off, on]).toContain(url.origin);
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.redirect).toBe("manual");
    expect(init?.cache).toBe("no-store");
    if (!bypass)
      return new Response(null, {
        status: broken === `unlocked:${url.pathname}` ? 200 : 401,
      });
    expect(bypass).toBe("fixture-secret");
    if (broken === "redirect")
      return Response.redirect(env.GROUNDED_GATE_PRODUCTION_APP_URL);
    if (broken === "invalid-json") return new Response("private fixture data");
    if (url.pathname === "/api/health")
      return Response.json({
        status: "ok",
        deploymentSha: broken === "sha" ? "b".repeat(40) : sha,
        supabaseOrigin:
          broken === "origin"
            ? env.GROUNDED_GATE_PRODUCTION_SUPABASE_URL
            : database,
        groundedResponseGate: {
          projectId: broken === "project" ? "prj_production" : "prj_isolated",
          deploymentHost:
            broken === "alias" ? "different.vercel.app" : url.hostname,
          rhetoricalPlans: broken === "rhetorical",
          ...(broken === "missing-debug"
            ? {}
            : { providerWireDebug: broken === "debug" }),
        },
      });
    expect(url.pathname).toBe("/api/extension/config");
    return Response.json({
      supabase_url:
        broken === "config-origin"
          ? env.GROUNDED_GATE_PRODUCTION_SUPABASE_URL
          : database,
      capabilities:
        broken === "missing-flag"
          ? {}
          : { messageFocus: enabled && broken !== "flag" },
      supabase_anon_key: "private fixture data",
    });
  });
}

describe("Message Focus rollout preflight", () => {
  it("checks both protected deployments using only GET requests and reports no raw config", async () => {
    const transport = preview();
    const report = await runMessageFocusPreflight(env, inventory, transport);
    expect(transport).toHaveBeenCalledTimes(8);
    expect(report).toEqual({
      deploymentSha: sha,
      previews: [
        { mode: "off", messageFocus: false },
        { mode: "on", messageFocus: true },
      ],
    });
  });

  it.each([
    ["GROUNDED_GATE_CONFIRM", "no"],
    ["GROUNDED_GATE_SHA", "abc"],
    ["GROUNDED_GATE_ON_URL", off],
    ["GROUNDED_GATE_ON_URL", `${on}:8443`],
    ["GROUNDED_GATE_ON_URL", `${off}:8443`],
    [
      "GROUNDED_GATE_SUPABASE_URL",
      `${env.GROUNDED_GATE_PRODUCTION_SUPABASE_URL}:8443`,
    ],

    ["GROUNDED_GATE_ON_URL", "https://user@fixture.vercel.app"],
    ["GROUNDED_GATE_ON_URL", env.GROUNDED_GATE_PRODUCTION_APP_URL],
    ["GROUNDED_GATE_SUPABASE_URL", env.GROUNDED_GATE_PRODUCTION_SUPABASE_URL],
    ["GROUNDED_GATE_PROJECT_ID", env.GROUNDED_GATE_PRODUCTION_PROJECT_ID],
    ["GROUNDED_GATE_VERCEL_BYPASS", ""],
  ])("rejects invalid %s before the first request", async (key, value) => {
    const transport = preview();
    await expect(
      runMessageFocusPreflight({ ...env, [key]: value }, inventory, transport),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    { url: "untrusted.vercel.app" },
    { target: "production" },
    { state: "BUILDING" },
    { meta: { githubCommitSha: "b".repeat(40) } },
  ])(
    "does not send the bypass when a target is missing from the trusted inventory",
    async (change) => {
      const transport = preview();
      await expect(
        runMessageFocusPreflight(
          env,
          {
            deployments: [
              inventory.deployments[0],
              { ...inventory.deployments[1], ...change },
            ],
          },
          transport,
        ),
      ).rejects.toThrow("Preview inventory check failed (on)");
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it.each([
    "sha",
    "origin",
    "project",
    "alias",
    "rhetorical",
    "off-debug",
    "missing-debug",
    "flag",
    "missing-flag",
    "config-origin",
    "redirect",
    "invalid-json",
    "unlocked:/api/health",
    "unlocked:/api/extension/config",
  ])("fails closed for %s with a safe error", async (failure) => {
    await expect(
      runMessageFocusPreflight(env, inventory, preview(failure)),
    ).rejects.toThrow(
      /^Preview (identity|protection|capability|response|comparison) check failed/,
    );
  });
});
