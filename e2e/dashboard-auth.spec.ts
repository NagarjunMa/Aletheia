import { test, expect } from "@playwright/test";

test("dashboard redirects a signed-out visitor before private data renders @smoke", async ({
  page,
}) => {
  const origin = new URL(
    test.info().project.use.baseURL ?? "http://localhost:3000",
  ).origin;
  const creditRequests: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/billing/credits")
      creditRequests.push(url.pathname);
    return url.origin === origin ? route.continue() : route.abort();
  });
  await page.goto("/dashboard");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/auth/login");
  await expect(
    page.getByRole("region", { name: "Workspace metrics" }),
  ).toHaveCount(0);
  expect(creditRequests).toEqual([]);
});
