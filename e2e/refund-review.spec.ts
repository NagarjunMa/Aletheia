import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
const { build } = createRequire(
  process.cwd() + "/ascendia-extension/package.json",
)("esbuild");
import path from "node:path";
// Browser fixture runs the actual review component; every HTTP request is intercepted.
test("refund operator can review and recover without duplicate actions", async ({
  page,
}) => {
  const result = await build({
    stdin: {
      contents: `import React from 'react';import{createRoot}from'react-dom/client';import Panel from './app/admin/refunds/RefundReviewPanel';createRoot(document.getElementById('root')).render(React.createElement(Panel));`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    alias: { "@": process.cwd() },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const bundle = result.outputFiles[0]?.text;
  if (!bundle) throw new Error("Browser fixture build failed");
  const id = "22222222-2222-4222-8222-222222222222";
  let creditStatus = "pending";
  let decision = "pending";
  let mutations = 0;
  const item = () => ({
    id,
    attempt_id: id,
    user_id: id,
    debit_id: id,
    category: "cold_email",
    failure_code: "MODEL_TIMEOUT",
    created_at: "2026-09-20T00:00:00Z",
    decision,
    credit_status: creditStatus,
    amount: 4,
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/bundle.js")
      return route.fulfill({ contentType: "text/javascript", body: bundle });
    if (url.pathname === `/api/admin/refunds/${id}`) {
      if (route.request().method() === "POST") {
        mutations++;
        const body = route.request().postDataJSON();
        expect(body.action).toBe("approve");
        expect(body).not.toHaveProperty("amount");
        creditStatus = "credited";
        decision = "approved";
      }
      return route.fulfill({
        json: { case: item(), events: [], hasMoreEvents: false },
      });
    }
    if (url.pathname === "/api/admin/refunds")
      return route.fulfill({ json: { items: [item()], hasMore: false } });
    return route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><title>Refund review fixture</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
    });
  });
  await page.goto("http://localhost:45678");
  await page.getByRole("button", { name: /Review case/ }).click();
  await expect(
    page.getByRole("heading", { name: /Case 22222222/ }),
  ).toBeFocused();
  await page
    .getByRole("textbox", { name: "Internal review note" })
    .fill("Confirmed server failure");
  await page
    .getByRole("button", { name: "Approve and restore credits" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Approve and restore credits" }),
  ).toBeDisabled();
  expect(mutations).toBe(1);
  await expect(page.getByRole("status")).toContainText("Case updated");
  await page.screenshot({
    path: path.join(test.info().outputDir, "refund-review.png"),
    fullPage: true,
  });
});
