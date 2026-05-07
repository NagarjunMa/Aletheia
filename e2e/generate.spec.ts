import { test, expect } from "@playwright/test";

// @e2e — Real Anthropic E2E used in staging.yml only.
// Authenticates as the permanent staging test user via Supabase Auth REST API,
// then calls the generate endpoint with a real Anthropic API call.
// Capped at one cold_email call to control spend (~$0.01 per run).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TEST_EMAIL = process.env.STAGING_TEST_USER_EMAIL!;
const TEST_PASSWORD = process.env.STAGING_TEST_USER_PASSWORD!;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

async function getAccessToken(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

test("generate cold email returns structured output @e2e", async ({
  request,
}) => {
  const token = await getAccessToken();

  const response = await request.post(`${BASE_URL}/api/extension/generate`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      profileMarkdown: [
        "Jane Smith",
        "VP Engineering at Acme Corp",
        "Former Staff Engineer at Google.",
        "Builds distributed systems and leads platform teams.",
      ].join("\n"),
      profileUrl: "https://linkedin.com/in/jane-smith",
      category: "cold_email",
      intent: "networking",
      resume:
        "Software engineer with 5 years experience in distributed systems.",
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(typeof body.subject_line).toBe("string");
  expect(body.subject_line.length).toBeGreaterThan(5);
  expect(typeof body.body).toBe("string");
  expect(body.word_count).toBeLessThanOrEqual(150);
  expect(typeof body.authenticityScore).toBe("number");
  expect(body.authenticityScore).toBeGreaterThan(0);
});
