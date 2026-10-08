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
    import {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import FactReview from './app/profile/application/FactReview';
    const original={id:'11111111-1111-4111-8111-111111111111',kind:'technical_project',title:'Policy prototype',context:'Training only; not production.',actions:'I built a policy-grounded prototype.',outcome:'',metrics:[],skills:[],links:[],confirmed:true,sortOrder:0,updatedAt:'2026-10-07T00:00:00.000Z'};
    window.testEvidence=original; window.savedReviews=[];
    function App(){const [record,setRecord]=useState(original);return <main className="product-shell mx-auto max-w-4xl p-4"><FactReview key={record.updatedAt} evidence={record} onClose={()=>{}} onSaved={setRecord}/></main>}
    createRoot(document.getElementById('root')).render(<App/>);
  `,
  },
  plugins: [
    {
      name: "mock-fact-action",
      setup(api) {
        api.onResolve({ filter: /^\.\/actions$/ }, (args) =>
          args.importer.endsWith("FactReview.tsx")
            ? { path: "action", namespace: "mock" }
            : undefined,
        );
        api.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents: `
      import {prepareFactReview} from '${resolve("lib/candidate-profile/fact-review.ts")}';
      export async function saveCandidateFactReview(input){
        const original=window.testEvidence; if(input.expectedRevision!==original.updatedAt) return {ok:false,error:'Stale review'};
        window.savedReviews.push(input); const factReview=prepareFactReview(original,input.facts);
        const evidence={...original,factReview,updatedAt:new Date(Date.parse(original.updatedAt)+1).toISOString()};
        window.testEvidence=evidence; return {ok:true,evidence};
      }`,
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
    await expect(assertion.getByRole("checkbox")).toBeDisabled();
    await assertion.getByLabel("Fact type").selectOption("action");
    await assertion.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Save reviewed facts", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.savedReviews.length))
      .toBe(1);
    await expect(assertion.getByRole("checkbox")).toBeChecked();
    await assertion.getByRole("checkbox").uncheck();
    await page
      .getByRole("button", { name: "Save reviewed facts", exact: true })
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
    await expect(page.getByRole("status")).toHaveText(
      "Choose an exact excerpt from the saved project.",
    );
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
