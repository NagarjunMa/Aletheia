/** Browser component diagnostic: real component/CSS, mock action, no external I/O. */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium, expect } from "@playwright/test";

const cssPath = resolve("app/globals.css");
const css = (
  await postcss([tailwind()]).process(readFileSync(cssPath, "utf8"), {
    from: cssPath,
  })
).css;
const dashboardEditorKey = readFileSync(
  resolve("app/dashboard/page.tsx"),
  "utf8",
).match(/<ApplicationProfileEditor\s+key=\{([^\n]+)\}/u)?.[1];
if (!dashboardEditorKey)
  throw new Error("Dashboard editor needs its account key");
const output = await build({
  write: false,
  bundle: true,
  format: "esm",
  jsx: "automatic",
  platform: "browser",
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `
    import {useEffect,useState} from 'react'; import {createRoot} from 'react-dom/client';
    import FactReview from './app/profile/application/FactReview';
    import ApplicationProfileEditor from './app/profile/application/ApplicationProfileEditor';
    import {candidateProfileInputSchema} from './lib/candidate-profile/schema';
    const original={id:'11111111-1111-4111-8111-111111111111',kind:'technical_project',title:'Policy prototype',context:'Training only; not production.',actions:'I built a policy-grounded prototype.',outcome:'',metrics:[],skills:[],links:[],confirmed:true,sortOrder:0,updatedAt:'2026-10-07T00:00:00.000Z'};
    window.testEvidence=original; window.savedReviews=[];
    function App(){const [record,setRecord]=useState(original);return <main className="product-shell mx-auto max-w-4xl p-4"><FactReview key={record.updatedAt} evidence={record} onClose={()=>{}} onSaved={setRecord}/></main>}
    const readProjects = () => JSON.parse(localStorage.getItem('test-projects') || '[]');
    function TestEditor(){
      const [projects,setProjects]=useState(readProjects);
      useEffect(() => {
        const refresh = () => setProjects(readProjects());
        window.addEventListener('test-refresh', refresh);
        return () => window.removeEventListener('test-refresh', refresh);
      }, []);
      const applicationProfile = { evidence: projects };
      const user = { id: 'editor-test-account' };
      return <main className="product-shell"><ApplicationProfileEditor key={${dashboardEditorKey}} initialProfile={candidateProfileInputSchema.parse({})} initialEvidence={projects} hasPrimaryResume={false}/></main>;
    }
    const editor = new URLSearchParams(location.search).has('editor');
    createRoot(document.getElementById('root')).render(
      editor
        ? <TestEditor/>
        : <App/>
    );
  `,
  },
  plugins: [
    {
      name: "mock-fact-action",
      setup(api) {
        api.onResolve({ filter: /^\.\/actions$/ }, (args) =>
          /(?:FactReview|ApplicationProfileEditor)\.tsx$/.test(args.importer)
            ? { path: "action", namespace: "mock" }
            : undefined,
        );
        api.onResolve({ filter: /^next\/navigation$/ }, () => ({
          path: "router",
          namespace: "mock",
        }));
        api.onLoad({ filter: /^router$/, namespace: "mock" }, () => ({
          contents:
            "export const useRouter = () => ({ refresh() { window.dispatchEvent(new Event('test-refresh')); } });",
        }));
        api.onLoad({ filter: /^action$/, namespace: "mock" }, () => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents: `
      import {prepareFactReview} from '${resolve("lib/candidate-profile/fact-review.ts")}';
      const editor = new URLSearchParams(location.search).has('editor');
      const records = () => JSON.parse(localStorage.getItem('test-projects') || '[]');
      const save = evidence => localStorage.setItem('test-projects', JSON.stringify([...records().filter(x => x.id !== evidence.id), evidence]));
      export async function saveCandidateEvidence(input) {
        if (window.failSave) return {ok:false,error:'Project save failed. Try again.'};
        const evidence = {...input, id:input.id || crypto.randomUUID(), updatedAt:new Date().toISOString()};
        window.testEvidence = evidence; save(evidence);
        window.dispatchEvent(new Event('test-refresh'));
        return {ok:true,evidence};
      }
      export async function saveCandidateFactReview(input){
        const original=editor ? records().find(record => record.id === input.evidenceId) : window.testEvidence;
        if(input.expectedRevision!==original?.updatedAt) return {ok:false,error:'Stale review',stale:true};
        if(window.failReview) return {ok:false,error:'Review save failed. Try again.'};
        window.savedReviews.push(input);
        const confirmed = original.confirmed || input.facts.length > 0;
        const factReview=prepareFactReview({...original,confirmed},input.facts);
        const evidence={...original,confirmed,factReview,updatedAt:new Date(Date.parse(original.updatedAt)+1).toISOString()};
        window.testEvidence=evidence;
        if (editor) save(evidence);
        return {ok:true,evidence};
      }
      export async function saveCandidateProfileCategory() { return {ok:true}; }
      export async function deleteCandidateEvidence() { return {ok:true}; }`,
        }));
      },
    },
  ],
});
const bundle = output.outputFiles[0].text;
const server = createServer((req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/bundle.js"
      ? "text/javascript"
      : req.url === "/styles.css"
        ? "text/css"
        : "text/html",
  );
  res.end(
    req.url === "/bundle.js"
      ? bundle
      : req.url === "/styles.css"
        ? css
        : '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>',
  );
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch();
  const editorPage = await browser.newPage({
    viewport: { width: 375, height: 900 },
  });
  await editorPage.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  await editorPage.goto(origin + "/dashboard?editor#evidence");
  await expect(editorPage.locator("#evidence")).toHaveAttribute("open", "");
  await editorPage.getByRole("button", { name: "Add evidence" }).click();
  await editorPage.locator("#evidence-title").fill("Policy rollout");
  await editorPage
    .locator("#evidence-actions")
    .fill("Our team built a prototype for policy reviews.");
  await editorPage.evaluate(() => {
    window.failSave = true;
  });
  await editorPage
    .getByRole("button", { name: "Save evidence" })
    .press("Enter");
  await expect(
    editorPage.getByRole("alert").filter({ hasText: "Project save failed" }),
  ).toBeVisible();
  await expect(editorPage.locator("#evidence-actions")).toHaveValue(
    "Our team built a prototype for policy reviews.",
  );
  await editorPage.evaluate(() => {
    window.failSave = false;
  });
  await editorPage
    .getByRole("button", { name: "Save evidence" })
    .press("Enter");
  const reviewHeading = editorPage.getByRole("heading", {
    name: "Review individual facts",
  });
  await expect(reviewHeading).toBeFocused();
  await editorPage
    .getByRole("button", { name: "Edit project details" })
    .press("Enter");
  await expect(editorPage.locator("#evidence-title")).toBeFocused();
  await editorPage
    .getByRole("button", { name: "Save evidence" })
    .press("Enter");
  await expect(reviewHeading).toBeFocused();
  await expect(
    editorPage.getByText("Review needed", { exact: true }),
  ).toBeVisible();
  const suggestion = editorPage.locator("fieldset > div").filter({
    has: editorPage.getByText(
      "Our team built a prototype for policy reviews.",
      { exact: true },
    ),
  });
  await expect(suggestion.getByText("What this demonstrates")).toBeVisible();
  await expect(suggestion.getByRole("checkbox")).not.toBeChecked();
  await suggestion.getByRole("checkbox").check();
  await editorPage.evaluate(() => {
    window.failReview = true;
  });
  await editorPage
    .getByRole("button", { name: "Confirm selected facts" })
    .press("Enter");
  await expect(
    editorPage.getByRole("alert").filter({ hasText: "Review save failed" }),
  ).toBeVisible();
  await expect(suggestion.getByRole("checkbox")).toBeChecked();
  await editorPage.evaluate(() => {
    window.failReview = false;
  });
  await editorPage
    .getByRole("button", { name: "Confirm selected facts" })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect(
    editorPage.getByText("1 fact confirmed", { exact: true }),
  ).toBeVisible();
  expect(await editorPage.evaluate(() => window.savedReviews.length)).toBe(1);
  await editorPage.reload();
  await expect(
    editorPage.getByText("1 fact confirmed", { exact: true }),
  ).toBeVisible();
  await editorPage.getByRole("button", { name: "Edit", exact: true }).click();
  await editorPage
    .locator("#evidence-actions")
    .fill("Our team reviewed a policy prototype in a test environment.");
  await editorPage
    .getByRole("button", { name: "Save evidence" })
    .press("Enter");
  await expect(reviewHeading).toBeFocused();
  const updateFromOtherTab =
    "Our team retested the policy prototype on test data.";
  await editorPage.evaluate((actions) => {
    const projects = JSON.parse(localStorage.getItem("test-projects"));
    projects[0].actions = actions;
    projects[0].updatedAt = new Date(
      Date.parse(projects[0].updatedAt) + 1,
    ).toISOString();
    localStorage.setItem("test-projects", JSON.stringify(projects));
  }, updateFromOtherTab);
  await editorPage.locator("fieldset").getByRole("checkbox").first().check();
  await editorPage
    .getByRole("button", { name: "Confirm selected facts" })
    .press("Enter");
  await expect(
    editorPage.getByRole("alert").filter({ hasText: "Stale review" }),
  ).toBeFocused();
  await expect(
    editorPage.getByRole("button", { name: "Confirm selected facts" }),
  ).toBeDisabled();
  await editorPage
    .getByRole("button", { name: "Reload saved project" })
    .press("Enter");
  await expect(reviewHeading).toBeFocused();
  await expect(
    editorPage.locator("blockquote").filter({ hasText: updateFromOtherTab }),
  ).toHaveCount(1);
  await editorPage.reload();
  await expect(
    editorPage.getByText("Review needed", { exact: true }),
  ).toBeVisible();
  await expect(reviewHeading).toHaveCount(0);
  await editorPage
    .getByRole("button", { name: "Review facts", exact: true })
    .press("Enter");
  await expect(reviewHeading).toBeFocused();
  await editorPage.getByRole("button", { name: "Finish later" }).click();
  await expect(
    editorPage.getByRole("button", { name: "Review facts", exact: true }),
  ).toBeFocused();
  await editorPage
    .getByRole("button", { name: "Review facts", exact: true })
    .press("Enter");
  await expect(reviewHeading).toBeFocused();
  await editorPage.close();
  for (const width of [375, 900, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin
        ? route.continue()
        : route.abort(),
    );
    await page.goto(origin);
    await expect(
      page.getByRole("heading", { name: "Review individual facts" }),
    ).toBeVisible();
    await expect(
      page.getByText("Training only; not production.", { exact: true }).first(),
    ).toBeVisible();
    const assertion = page.locator("fieldset > div").filter({
      has: page.getByText("I built a policy-grounded prototype.", {
        exact: true,
      }),
    });
    await expect(assertion.getByRole("checkbox")).not.toBeChecked();
    await expect(assertion.getByLabel("Fact type")).toHaveValue("action");
    await assertion.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Confirm selected facts", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.savedReviews.length))
      .toBe(1);
    await expect(assertion.getByRole("checkbox")).toBeChecked();
    await assertion.getByRole("checkbox").uncheck();
    await page
      .getByRole("button", { name: "Withdraw reviewed facts", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.savedReviews[1]?.facts.length))
      .toBe(0);
    await page
      .getByLabel("Add another exact excerpt from this saved project")
      .fill("Invented production outcome");
    await page
      .getByRole("button", { name: "Add excerpt", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveText(
      "Choose a complete entry from the saved project.",
    );
    await expect(page.getByRole("alert")).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "Fact review browser checks passed at 375/900/1440px: unconfirmed suggestions, explicit type/confirmation, save/reload, withdrawal, unsupported excerpt and no overflow/runtime errors.",
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
