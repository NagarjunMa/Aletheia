import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("keeps reviewed draft options out of server Sentry telemetry", () => {
  // Use a fresh process so Sentry instruments the actual SDK import.
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=commonjs",
      "-e",
      `
      const Sentry = require("@sentry/nextjs");
      require("./sentry.server.config.ts");
      const envelopes = [];
      Sentry.getClient().getTransport().send = async (envelope) => {
        envelopes.push(envelope);
        return { statusCode: 200 };
      };

      const { Anthropic } = require("@anthropic-ai/sdk");
      const client = new Anthropic({
        apiKey: "synthetic",
        maxRetries: 0,
        fetch: async () => new Response(JSON.stringify({
          id: "msg_synthetic",
          type: "message",
          role: "assistant",
          model: "synthetic",
          stop_reason: "end_turn",
          content: [],
          usage: { input_tokens: 8, output_tokens: 2 },
        }), { headers: { "content-type": "application/json" } }),
      });

      async function run() {
        await Sentry.startSpan(
          { name: "synthetic-generation", forceTransaction: true },
          () => client.messages.create({
            model: "synthetic",
            max_tokens: 8,
            messages: [{ role: "user", content: "SyntheticIntentCanary" }],
            tools: [{
              name: "return_draft",
              description: "I built SyntheticReviewedFactCanary.",
              input_schema: { type: "object" },
            }],
          }),
        );
        await Sentry.close(1000);
        const serialized = JSON.stringify(envelopes);
        console.log(JSON.stringify({
          traced: serialized.includes("synthetic-generation"),
          containsFocus: serialized.includes("SyntheticIntentCanary"),
          containsDraft: serialized.includes("SyntheticReviewedFactCanary"),
          containsToolDefinitions: serialized.includes("gen_ai.request.available_tools"),
        }));
      }

      run().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
      `,
    ],
    {
      encoding: "utf8",
      timeout: 10_000,
      env: {
        DEBUG: "false",
        NODE_ENV: "development",
        NEXT_PUBLIC_ENABLE_ERROR_REPORTING: "true",
        SENTRY_DSN: "https://public@example.invalid/1",
      },
    },
  );
  expect(JSON.parse(output)).toEqual({
    traced: true,
    containsFocus: false,
    containsDraft: false,
    containsToolDefinitions: false,
  });
}, 12_000);
