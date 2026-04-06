import { test, expect } from "@playwright/test";

// Runs in both cd.yml (mocked, local server) and staging.yml (real Anthropic, staging URL).
// No auth, no external API calls — purely verifies the server is up and responding.
test("health check returns ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(typeof body.timestamp).toBe("string");
});
