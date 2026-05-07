import { defineConfig, devices } from "@playwright/test";

const remoteUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: remoteUrl ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Only spin up a local server when not pointing at a remote URL (staging CI, local dev).
  // Spread avoids assigning `undefined` to webServer (exactOptionalPropertyTypes: true).
  ...(!remoteUrl && {
    webServer: {
      command: "npm run build && npm run start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
  }),
});
