/** Real dashboard components + styles; synthetic owners/data and local HTTP only. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium, expect } from "@playwright/test";

const cssPath = resolve("app/globals.css");
const globalCss = (
  await postcss([tailwind()]).process(readFileSync(cssPath, "utf8"), {
    from: cssPath,
  })
).css;
const output = await build({
  write: false,
  bundle: true,
  format: "esm",
  jsx: "automatic",
  platform: "browser",
  outfile: "dashboard-test.js",
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `
import {useEffect,useState} from 'react'; import {createRoot} from 'react-dom/client';
import DashboardView from './app/dashboard/DashboardView'; import {dashboardFixture} from './__tests__/helpers/dashboard-fixtures';
import DashboardPage from './app/dashboard/page';
import ResumeManager from './app/profile/ResumeManager';
function ResumeBoundary(){return <div className="product-shell"><ResumeManager initialResumes={dashboardFixture().resumes} maxResumes={3}/></div>;}
function PageBoundary(){const[view,setView]=useState(null);useEffect(()=>{let active=true;DashboardPage().then(value=>{if(active)setView(value)});return()=>{active=false}},[]);return view;}
function App(){ const [state,setState]=useState({mode:new URLSearchParams(location.search).get('mode')||'populated',owner:'a'});useEffect(()=>{window.setFixture=(mode,owner='a')=>setState({mode,owner});window.refreshFixture=()=>setState({mode:window.refreshMode||'empty',owner:'a'});},[]);const data=dashboardFixture(state.mode,state.owner);return <DashboardView key={state.owner} ownerId={state.owner} name={data.profileName} email={state.owner+'@example.test'} data={data} candidateEditor={<p>Saved candidate details are editable here.</p>}/>;}const params=new URLSearchParams(location.search);
createRoot(document.getElementById('root')).render(params.has('resume-manager')?<ResumeBoundary/>:params.has('page-boundary')?<PageBoundary/>:<App/>);`,
  },
  plugins: [
    {
      name: "mock-next-boundaries",
      setup(api) {
        api.onResolve({ filter: /^next\/link$/ }, () => ({
          path: "link",
          namespace: "mock",
        }));
        api.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: "router",
          namespace: "mock",
        }));
        api.onResolve({ filter: /^@\/app\/auth\/actions$/ }, () => ({
          path: "auth",
          namespace: "mock",
        }));
        api.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, () => ({
          path: "supabase",
          namespace: "mock",
        }));
        api.onResolve({ filter: /^\.\/load-dashboard$/ }, () => ({
          path: "loader",
          namespace: "mock",
        }));
        api.onResolve({ filter: /^\.\/actions$/ }, (args) =>
          /\/profile\/application\//.test(args.importer)
            ? { path: "profile-actions", namespace: "mock" }
            : undefined,
        );
        api.onLoad({ filter: /^supabase$/, namespace: "mock" }, () => ({
          contents:
            "export async function createClient(){return {auth:{async getUser(){return {data:{user:{id:'synthetic-owner',email:'a@example.test'}},error:null}}}}}",
        }));
        api.onLoad({ filter: /^loader$/, namespace: "mock" }, () => ({
          loader: "tsx",
          resolveDir: process.cwd(),
          contents:
            "import{dashboardFixture}from'./__tests__/helpers/dashboard-fixtures';export async function loadDashboard(){return dashboardFixture(new URLSearchParams(location.search).get('mode')||'populated')}",
        }));
        api.onLoad({ filter: /^profile-actions$/, namespace: "mock" }, () => ({
          contents:
            [
              "saveCandidateProfileCategory",
              "saveCandidateEvidence",
              "saveCandidateFactReview",
              "loadResumeFactReview",
              "saveResumeFactReview",
            ]
              .map(
                (name) =>
                  `export async function ${name}(){throw new Error('Action outside test scope')}`,
              )
              .join(";") +
            ";export async function deleteCandidateEvidence(id){(window.evidenceDeletes??=[]).push(id);return window.evidenceDeleteFailure?{ok:false,error:'Evidence could not be deleted.'}:{ok:true}}",
        }));
        api.onLoad({ filter: /^link$/, namespace: "mock" }, () => ({
          loader: "jsx",
          resolveDir: process.cwd(),
          contents:
            "export default function Link({children,...props}){return <a {...props}>{children}</a>}",
        }));
        api.onLoad({ filter: /^router$/, namespace: "mock" }, () => ({
          contents:
            "export const useRouter=()=>({refresh(){window.refreshFixture?.()}});export function redirect(){throw new Error('Unexpected test redirect')}",
        }));
        api.onLoad({ filter: /^auth$/, namespace: "mock" }, () => ({
          contents: "export async function signOutAction(){}",
        }));
      },
    },
  ],
});
const js = output.outputFiles.find((file) => file.path.endsWith(".js"));
const componentCss = output.outputFiles.find((file) =>
  file.path.endsWith(".css"),
);
assert.ok(js && componentCss);
let fontCss = "";
const chunks = resolve(".next/static/chunks");
if (existsSync(chunks))
  for (const file of readdirSync(chunks).filter((name) =>
    name.endsWith(".css"),
  )) {
    fontCss += (
      readFileSync(resolve(chunks, file), "utf8").match(
        /@font-face\{[^}]+\}/gu,
      ) ?? []
    )
      .filter((rule) => /font-family:(?:DM Sans|Flaviotte)/u.test(rule))
      .join("")
      .replaceAll("../media/", "/_next/static/media/");
  }
const css = `${fontCss}\n@font-face{font-family:Flaviotte;src:url('/flaviotte.woff2')} :root{--font-flaviotte:Flaviotte;--font-dm-sans:'DM Sans';}\n${globalCss}\n${componentCss.text}`;
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/app.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(js.contents);
  } else if (path === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css);
  } else if (path === "/flaviotte.woff2")
    res.end(readFileSync(resolve("public/fonts/Flaviotte.woff2")));
  else if (/^\/_next\/static\/media\/[a-z0-9_.-]+\.woff2$/iu.test(path)) {
    res.end(readFileSync(resolve(".next/static/media", basename(path))));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic dashboard component checks</title><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/app.js"></script></html>',
    );
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const screenshots = process.env.DASHBOARD_SCREENSHOTS_DIR;
if (screenshots) mkdirSync(screenshots, { recursive: true });
let browser;
let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log(`Passed: ${name}`);
}
try {
  browser = await chromium.launch();
  const errors = [];
  async function page(
    width = 1440,
    mode = "populated",
    credits = { balance: 42, creditExpiry: null },
  ) {
    const p = await browser.newPage({ viewport: { width, height: 1000 } });
    p.on("pageerror", (error) => errors.push(error.message));
    await p.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    await p.route("**/api/billing/credits", (route) =>
      typeof credits === "function"
        ? credits(route)
        : route.fulfill({
            status: credits === null ? 503 : 200,
            contentType: "application/json",
            body: JSON.stringify(credits ?? {}),
          }),
    );
    await p.goto(`${origin}/dashboard?mode=${mode}`);
    await expect(p.getByRole("heading", { level: 1 })).toContainText(
      "Alex Morgan",
    );
    await p.evaluate(() => document.fonts.ready);
    return p;
  }
  const p = await page();
  const activity = p.getByRole("region", { name: "Outreach activity" });
  const credits = p.getByRole("region", { name: "Credit balance" });
  await check(
    "actual categories, request/output distinction and review denominator",
    async () => {
      await expect(activity).toContainText("24requests");
      await expect(activity).toContainText("30 drafts & answers produced");
      await expect(
        p
          .getByRole("list", { name: "Generation requests by channel" })
          .getByRole("listitem"),
      ).toHaveCount(4);
      await expect(
        p
          .getByRole("list", { name: "Generation requests by channel" })
          .getByRole("listitem")
          .last(),
      ).toContainText("Application answers2");
      await expect(
        p.getByRole("region", { name: "Review health" }),
      ).toContainText("80%");
      await expect(
        p.getByRole("region", { name: "Review health" }),
      ).toContainText("8 approved · 2 rejected");
      await expect(
        p.getByRole("list", { name: "Rejection reason counts" }),
      ).toContainText("Too generic1");
      await expect(credits).toContainText("42credits");
      await expect(credits).toContainText("7 / 30");
    },
  );
  await check(
    "identity, completion and requested information order",
    async () => {
      await expect(
        p.getByText("Platform Engineer", { exact: true }),
      ).toBeVisible();
      await expect(
        p.getByRole("progressbar", { name: "Profile completion" }),
      ).toHaveAttribute("aria-valuenow", "100");
      await expect(
        p
          .getByRole("list", { name: "Profile completion stages" })
          .getByRole("listitem"),
      ).toHaveCount(9);
      assert.equal(
        await p
          .getByRole("link", { name: "Edit profile", exact: true })
          .getAttribute("href"),
        "#candidate-profile",
      );
      assert.equal(
        await p
          .locator("main > section")
          .last()
          .getAttribute("aria-labelledby"),
        "recent-title",
      );
      const metricsBottom = await p
        .getByRole("region", { name: "Workspace metrics" })
        .evaluate((el) => el.getBoundingClientRect().bottom);
      const resumeTop = await p
        .getByRole("heading", { name: "Résumé context" })
        .evaluate((el) => el.closest("section").getBoundingClientRect().top);
      assert.ok(resumeTop > metricsBottom);
      await expect(p.getByText("Draft archive", { exact: true })).toHaveCount(
        0,
      );
      await expect(p.getByText("Reviewed drafts", { exact: true })).toHaveCount(
        0,
      );
      assert.ok(
        !(await p
          .locator("main")
          .innerText()
          .then((text) => text.includes("PRIVATE_SOURCE_CANARY"))),
      );
    },
  );
  await check(
    "keyboard motion pause, resume and hidden-tab pause",
    async () => {
      const pause = p.getByRole("button", { name: "Pause profile animation" });
      await pause.focus();
      await p.keyboard.press("Enter");
      const resume = p.getByRole("button", {
        name: "Resume profile animation",
      });
      await expect(resume).toBeFocused();
      const sweep = p.locator('[role="progressbar"] > span').last();
      const paused = await sweep.evaluate(
        (el) => getComputedStyle(el).transform,
      );
      await p.waitForTimeout(150);
      assert.equal(
        await sweep.evaluate((el) => getComputedStyle(el).transform),
        paused,
      );
      if (screenshots)
        await p.screenshot({
          path: resolve(screenshots, "desktop-paused.png"),
          fullPage: true,
        });
      await resume.click();
      await p.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          value: true,
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      const hidden = await sweep.evaluate(
        (el) => getComputedStyle(el).transform,
      );
      await p.waitForTimeout(150);
      assert.equal(
        await sweep.evaluate((el) => getComputedStyle(el).transform),
        hidden,
      );
      await p.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          value: false,
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await p.waitForTimeout(150);
      assert.notEqual(
        await sweep.evaluate((el) => getComputedStyle(el).transform),
        hidden,
      );
    },
  );
  await check("profile refresh, no-data and removed résumé", async () => {
    await p.getByRole("button", { name: "Refresh dashboard" }).click();
    await expect(
      p.getByRole("progressbar", { name: "Profile completion" }),
    ).toHaveAttribute("aria-valuenow", "0");
    await expect(
      p.getByRole("region", { name: "Review health" }),
    ).toContainText("No reviews yet");
    await expect(
      p.getByRole("heading", { name: "Add context to your experience" }),
    ).toBeVisible();
    await expect(
      p.getByRole("region", { name: "Outreach activity" }),
    ).toContainText("0requests");
    await expect(
      p.getByText("No saved drafts yet.", { exact: true }),
    ).toBeVisible();
  });
  await check("unavailable data is never a false zero", async () => {
    const p = await page(1440, "unavailable", null);
    await expect(
      p.getByText("Credit balance unavailable", { exact: true }),
    ).toBeVisible();
    await expect(
      p.getByText("Quota unavailable", { exact: true }),
    ).toBeVisible();
    await expect(
      p.getByRole("region", { name: "Outreach activity" }),
    ).toContainText("Activity unavailable");
    await expect(
      p.getByRole("region", { name: "Review health" }),
    ).toContainText("Review data unavailable");
    await expect(p.getByRole("progressbar")).toHaveCount(0);
    await expect(
      p.getByRole("heading", { name: "Résumé information unavailable" }),
    ).toBeVisible();
    if (screenshots)
      await p.screenshot({
        path: resolve(screenshots, "unavailable.png"),
        fullPage: true,
      });
    await p.close();
  });
  await check(
    "unlimited access has no invented lifetime counters",
    async () => {
      const p = await page(1440, "populated", {
        balance: null,
        unlimitedCredits: true,
        creditExpiry: null,
      });
      const credits = p.getByRole("region", { name: "Credit balance" });
      await expect(credits).toContainText("Unlimited");
      await expect(credits).toContainText("daily safeguards apply");
      await expect(credits.getByText("Used", { exact: true })).toHaveCount(0);
      await p.close();
    },
  );
  await check(
    "malformed and signed-out credit responses are safe",
    async () => {
      const p = await page(1440, "populated", {
        balance: null,
        creditExpiry: null,
      });
      await expect(
        p.getByText("Credit balance unavailable", { exact: true }),
      ).toBeVisible();
      await p.route("**/api/billing/credits", (route) =>
        route.fulfill({ status: 401, body: "{}" }),
      );
      await p.getByRole("button", { name: "Retry credits" }).click();
      await expect(
        p.getByRole("link", { name: "Sign in again to view credits" }),
      ).toHaveAttribute("href", "/auth/login");
      await p.close();
    },
  );
  await check(
    "two synthetic accounts never reuse cached credit state",
    async () => {
      const p = await page();
      await expect(
        p.getByRole("region", { name: "Credit balance" }),
      ).toContainText("42credits");
      await p.route("**/api/billing/credits", (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ balance: 3, creditExpiry: null }),
        }),
      );
      await p.evaluate(() => window.setFixture("populated", "b"));
      await expect(p.getByRole("heading", { level: 1 })).toContainText(
        "Sam Chen",
      );
      await expect(
        p.getByRole("region", { name: "Credit balance" }),
      ).toContainText("3credits");
      await expect(
        p.getByRole("region", { name: "Credit balance" }),
      ).not.toContainText("42credits");
      await expect(
        p.getByRole("region", { name: "Outreach activity" }),
      ).toContainText("1requests");
      await p.close();
    },
  );
  await check(
    "a late account-A credit response cannot replace account B",
    async () => {
      let release;
      let requests = 0;
      const held = new Promise((done) => {
        release = done;
      });
      const p = await page(1440, "populated", async (route) => {
        const first = ++requests === 1;
        if (first) await held;
        try {
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              balance: first ? 99 : 3,
              creditExpiry: null,
            }),
          });
        } catch {
          /* The old owner request was cancelled. */
        }
      });
      try {
        await expect(
          p.getByText("Loading credits…", { exact: true }),
        ).toBeVisible();
        await p.evaluate(() => window.setFixture("populated", "b"));
        const card = p.getByRole("region", { name: "Credit balance" });
        await expect(card).toContainText("3credits");
        release();
        await p.waitForTimeout(150);
        await expect(card).not.toContainText("99credits");
      } finally {
        release();
        await p.close();
      }
    },
  );
  await check(
    "a real zero balance stays distinct from unavailable credits",
    async () => {
      const p = await page(1440, "empty", { balance: 0, creditExpiry: null });
      await expect(
        p.getByRole("region", { name: "Credit balance" }),
      ).toContainText("0credits");
      await expect(
        p.getByText("Credit balance unavailable", { exact: true }),
      ).toHaveCount(0);
      await p.close();
    },
  );
  await check(
    "removing the only background résumé updates canonical readiness",
    async () => {
      const p = await page(1440, "resume_only");
      await expect(
        p.getByRole("progressbar", { name: "Profile completion" }),
      ).toHaveAttribute("aria-valuenow", "100");
      await p.evaluate(() => window.setFixture("resume_removed"));
      await expect(
        p.getByRole("progressbar", { name: "Profile completion" }),
      ).toHaveAttribute("aria-valuenow", "80");
      await expect(
        p.getByText("Next: Background.", { exact: true }),
      ).toBeVisible();
      await expect(
        p.getByText("No primary selected", { exact: true }),
      ).toBeVisible();
      await p.close();
    },
  );
  await check(
    "real page does not infer missing background during a résumé outage",
    async () => {
      const p = await page(900, "resume_outage&page-boundary=1");
      await expect(
        p.getByText(/Profile context is temporarily unavailable/u),
      ).toBeVisible();
      await expect(
        p.getByText("Add your current role or a primary resume", {
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        p.getByRole("button", { name: "Save current work", exact: true }),
      ).toHaveCount(0);
      await expect(
        p.getByRole("link", { name: "Open application profile" }),
      ).toBeVisible();
      await p.close();
    },
  );
  await check(
    "real page still allows a known role without any résumé",
    async () => {
      const p = await page(900, "role_only&page-boundary=1");
      await expect(
        p.getByRole("button", { name: "Save current work", exact: true }),
      ).toBeVisible();
      await expect(
        p.getByText("Add your current role or a primary resume", {
          exact: true,
        }),
      ).toHaveCount(0);
      await p.close();
    },
  );
  for (const width of [375, 720, 900, 1440])
    await check(
      `responsive layout and reduced motion at ${width}px`,
      async () => {
        const p = await page(width);
        await p.emulateMedia({ reducedMotion: "reduce" });
        await expect(
          p.getByRole("button", { name: "Pause profile animation" }),
        ).toBeHidden();
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        for (const element of [
          p.getByRole("heading", { level: 1 }),
          p.getByRole("link", { name: "Edit profile", exact: true }),
        ])
          assert.ok((await element.boundingBox()).y < 1000);
        if (screenshots)
          await p.screenshot({
            path: resolve(screenshots, `dashboard-${width}.png`),
            fullPage: true,
          });
        await p.close();
      },
    );
  await check("reduced transparency uses a solid panel", async () => {
    const p = await page();
    const session = await p.context().newCDPSession(p);
    await session.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    const panel = p.getByRole("region", { name: "Outreach activity" });
    assert.equal(
      await panel.evaluate((el) => getComputedStyle(el).backdropFilter),
      "none",
    );
    assert.equal(
      await panel.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(9, 24, 20)",
    );
    if (screenshots)
      await p.screenshot({
        path: resolve(screenshots, "solid-fallback.png"),
        fullPage: true,
      });
    await p.close();
  });
  await check(
    "dashboard uses glass on profile sections and evidence",
    async () => {
      const profile = await page(1280, "populated&page-boundary=1");
      const work = profile.getByLabel("Current role", { exact: true });
      await expect(work).toBeVisible();
      const panel = work.locator("xpath=ancestor::details[1]");
      await expect(panel).toHaveCSS("backdrop-filter", /blur\(/u);
      await expect(panel).toHaveCSS(
        "border-top-color",
        "rgba(177, 229, 205, 0.38)",
      );
      await profile.locator("#evidence > summary").click();
      const story = profile.locator("#evidence article").first();
      await expect(story).toBeVisible();
      await expect(story).toHaveCSS("backdrop-filter", "none");
      const rim = (element) =>
        getComputedStyle(element, "::before").animationName;
      assert.match(await panel.evaluate(rim), /dashboard-rim-orbit/u);
      await story.hover();
      assert.match(await story.evaluate(rim), /dashboard-rim-orbit/u);
      if (screenshots)
        await profile.screenshot({
          path: resolve(screenshots, "dashboard-evidence.png"),
        });
      const session = await profile.context().newCDPSession(profile);
      await session.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
      });
      await expect(panel).toHaveCSS("backdrop-filter", "none");
      await expect(work).toHaveCSS("background-color", "rgb(9, 24, 20)");
      await profile.close();
    },
  );
  await check(
    "evidence delete cancels short presses and commits a complete hold once",
    async () => {
      const profile = await page(1280, "populated&page-boundary=1");
      await profile.locator("#evidence > summary").click();
      const launch = profile
        .getByRole("button", { name: /^Delete PRIVATE_SOURCE_CANARY$/ })
        .first();
      await launch.click();
      const dialog = profile.getByRole("dialog", { name: "Delete evidence?" });
      const hold = dialog.getByRole("button", {
        name: "Hold to delete",
        exact: true,
      });
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeFocused();
      await hold.click();
      await expect(hold).toBeVisible();
      assert.deepEqual(
        await profile.evaluate(() => window.evidenceDeletes ?? []),
        [],
      );

      await hold.focus();
      await profile.keyboard.down("Space");
      await expect(hold).toHaveAttribute("data-holding", "true");
      await profile.keyboard.up("Space");
      await expect(hold).toHaveAttribute("data-holding", "false");
      await profile.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(launch).toBeFocused();
      await profile.waitForTimeout(1250);
      assert.deepEqual(
        await profile.evaluate(() => window.evidenceDeletes ?? []),
        [],
      );

      await launch.click();
      await hold.hover();
      await profile.mouse.down();
      await expect(hold).toHaveAttribute("data-holding", "true");
      await profile.mouse.move(0, 0);
      await expect(hold).toHaveAttribute("data-holding", "false");
      await profile.mouse.up();
      assert.deepEqual(
        await profile.evaluate(() => window.evidenceDeletes ?? []),
        [],
      );

      await hold.hover();
      await profile.mouse.down({ button: "left" });
      await profile.mouse.down({ button: "right" });
      await profile.mouse.up({ button: "left" });
      await expect(hold).toHaveAttribute("data-holding", "false");
      await profile.mouse.up({ button: "right" });
      assert.deepEqual(
        await profile.evaluate(() => window.evidenceDeletes ?? []),
        [],
      );

      await hold.hover();
      await profile.mouse.down();
      await expect(hold).toHaveAttribute("data-holding", "true");
      if (screenshots)
        await profile.screenshot({
          path: resolve(screenshots, "evidence-hold.png"),
        });
      await expect(dialog).not.toBeVisible({ timeout: 3000 });
      await profile.mouse.up();
      await expect(profile.getByText("Evidence story deleted.")).toBeVisible();
      assert.deepEqual(await profile.evaluate(() => window.evidenceDeletes), [
        "11111111-1111-4111-8111-111111111111",
      ]);
      await expect(profile.locator("#evidence article")).toHaveCount(1);
      await profile.close();
    },
  );
  await check(
    "résumé confirmation is accessible and retryable after a failed delete",
    async () => {
      const resumePage = await browser.newPage({
        viewport: { width: 390, height: 800 },
        reducedMotion: "reduce",
        hasTouch: true,
        isMobile: true,
      });
      let deletes = 0;
      await resumePage.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
      await resumePage.route("**/api/resumes/**", (route) => {
        assert.equal(route.request().method(), "DELETE");
        assert.equal(
          new URL(route.request().url()).pathname,
          "/api/resumes/33333333-3333-4333-8333-333333333333",
        );
        deletes++;
        return route.fulfill(
          deletes === 1
            ? { status: 503, json: { error: "Could not delete this résumé." } }
            : { json: { success: true } },
        );
      });
      await resumePage.route("**/api/resumes", (route) =>
        route.fulfill({ json: { resumes: [] } }),
      );
      await resumePage.goto(`${origin}/profile?resume-manager=1`);
      const launch = resumePage.getByRole("button", {
        name: "Delete Platform engineering",
      });
      const dialog = resumePage.getByRole("dialog", { name: "Delete résumé?" });
      await launch.tap();
      await expect(dialog).toBeVisible();
      const hold = dialog.getByRole("button", {
        name: "Hold to delete",
        exact: true,
      });
      await hold.tap();
      assert.equal(deletes, 0);
      await dialog
        .getByRole("button", { name: "Confirm without holding" })
        .focus();
      await resumePage.keyboard.down("Enter");
      const confirm = dialog.getByRole("button", {
        name: "Delete permanently",
      });
      await expect(confirm).toBeFocused();
      await resumePage.keyboard.down("Enter");
      await resumePage.keyboard.up("Enter");
      await expect(confirm).toBeFocused();
      assert.equal(deletes, 0);
      await confirm.press("Enter");
      await expect(resumePage.getByRole("alert")).toContainText(
        "Could not delete this résumé.",
      );
      assert.equal(deletes, 1);
      await launch.tap();
      await hold.focus();
      await resumePage.keyboard.down("Space");
      await expect(resumePage.getByText("Resume deleted.")).toBeVisible();
      await resumePage.keyboard.up("Space");
      await expect(launch).toHaveCount(0);
      assert.equal(deletes, 2);
      await resumePage.close();
    },
  );
  await check("screen-reader semantics and privacy", async () => {
    const snapshot = await p.locator("main").ariaSnapshot();
    assert.ok(snapshot.includes("Profile completion"));
    assert.ok(snapshot.includes("Generation requests by channel"));
    assert.ok(!snapshot.includes("PRIVATE_SOURCE_CANARY"));
    assert.equal(
      await p.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
    assert.deepEqual(errors, []);
  });
  console.log(
    `${checks} dashboard browser scenarios passed. Synthetic owners, no hosted auth/database/provider calls. Narrow 720px viewport covers the layout equivalent of 200% zoom on 1440px; manual browser zoom and VoiceOver remain separate.`,
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
