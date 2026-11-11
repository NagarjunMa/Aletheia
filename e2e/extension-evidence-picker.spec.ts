import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Route,
  type Worker,
} from "@playwright/test";
import { dirname, resolve } from "node:path";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import JSZip from "jszip";

const test = base.extend<{ slowReader: boolean; storeZip: boolean }>({
  slowReader: [false, { option: true }],
  storeZip: [false, { option: true }],
});

const first = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Policy prototype",
  kind: "technical_project",
};
const second = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Review guide",
  kind: "technical_project",
};
const jd =
  "Build and maintain a policy evaluation system, working with engineers to measure behavior and document deployment limits.";
const answer = Array.from({ length: 50 }, (_, index) => `word${index}`).join(
  " ",
);

declare const chrome: {
  tabs: {
    query: (_query: { url: string }) => Promise<Array<{ id: number }>>;
    sendMessage: (_tabId: number, _message: unknown) => Promise<unknown>;
  };
  storage: {
    session: { get: (_key: string) => Promise<Record<string, unknown>> };
    local: {
      set: (_values: Record<string, unknown>) => Promise<void>;
      get: (_key: string) => Promise<Record<string, unknown>>;
    };
  };
};

async function signIn(worker: Worker, id: string, expiresIn = 3600) {
  await worker.evaluate(
    async ({ userId, expiresIn }) => {
      await chrome.storage.local.set({
        profileExtractionConsent: true,
        aletheia_auth: {
          access_token: `token-${userId}`,
          refresh_token: "unused",
          expires_at: Math.floor(Date.now() / 1000) + expiresIn,
          supabase_url: "https://www.aletheia.live",
          supabase_anon_key: "synthetic-key",
          user: { id: userId, email: `${userId}@example.test` },
        },
      });
    },
    { userId: id, expiresIn },
  );
}

let browser: BrowserContext;
let scratchExtension: string | undefined;
test.beforeEach(async ({ slowReader, storeZip }) => {
  let extension = resolve("ascendia-extension/dist");
  if (storeZip) {
    const zip = await JSZip.loadAsync(
      await readFile(resolve(extension, "aletheia-extension.zip")),
    );
    scratchExtension = await mkdtemp(resolve(tmpdir(), "aletheia-store-zip-"));
    extension = scratchExtension;
    for (const file of Object.values(zip.files)) {
      if (file.dir) continue;
      const destination = resolve(extension, file.name);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, await file.async("nodebuffer"));
    }
  }
  if (slowReader) {
    scratchExtension = await mkdtemp(resolve(tmpdir(), "ale55-chromium-"));
    await cp(extension, scratchExtension, { recursive: true });
    extension = scratchExtension;
    // Exercise the built panel and worker with a controllably delayed reader.
    await writeFile(
      resolve(extension, "content/linkedin-reader.js"),
      `
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.action !== "getProfile") return;
        const name = document.title;
        const respond = () => sendResponse({ success: true, profile: {
          name, profileMarkdown: name + " builds evaluation tools for applied AI systems.",
        } });
        if (name !== "Alice") { respond(); return; }
        const root = document.documentElement;
        root.dataset.readerPending = "true";
        if (root.dataset.releaseReader) { respond(); return; }
        const observer = new MutationObserver(() => {
          if (!root.dataset.releaseReader) return;
          observer.disconnect();
          respond();
        });
        observer.observe(root, { attributes: true, attributeFilter: ["data-release-reader"] });
        return true;
      });
    `,
    );
  }
  browser = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      "--host-resolver-rules=MAP www.aletheia.live 127.0.0.1, MAP aletheia.live 127.0.0.1, MAP www.linkedin.com 127.0.0.1",
    ],
  });
});
test.afterEach(async () => {
  await browser?.close();
  if (scratchExtension) {
    await rm(scratchExtension, { recursive: true, force: true });
    scratchExtension = undefined;
  }
});

async function openPanel(worker: Worker) {
  const page = await browser.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
  );
  await expect(page.locator("#userBadge")).toBeVisible();
  return page;
}

test("the packaged extension leaves a LinkedIn composer untouched when the draft exceeds its limit", async () => {
  const url = "https://www.linkedin.com/in/composer-fixture";
  await browser.route(url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<textarea hidden name="message" maxlength="300">Unrelated draft</textarea>
      <div role="dialog" aria-label="Add a note">
        <textarea name="message" maxlength="200">Existing text</textarea>
        <div><span aria-live="polite">13/300</span></div>
      </div>
      <div style="opacity: 0">
        <textarea placeholder="Add a note" maxlength="300">Fading draft</textarea>
      </div>
      <textarea placeholder="Add a note for yourself">Personal note</textarea>
      <div role="dialog" aria-label="New message">
        <textarea name="message" maxlength="300">InMail draft</textarea>
      </div>`,
    }),
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  const page = await browser.newPage();
  await page.goto(url);
  const invitation = page.locator('[aria-label="Add a note"]');
  const fading = page.locator('textarea[placeholder="Add a note"]');
  const personal = page.getByPlaceholder("Add a note for yourself", {
    exact: true,
  });
  const textarea = invitation.locator("textarea");
  const inmail = page
    .getByRole("dialog", { name: "New message" })
    .getByRole("textbox");
  const unrelated = page.locator("textarea[hidden]");
  const fill = (length: number) =>
    worker.evaluate(
      async ({ url, length }) => {
        const [tab] = await chrome.tabs.query({ url });
        return chrome.tabs.sendMessage(tab!.id, {
          action: "autoFill",
          data: { category: "linkedin_connection", body: "x".repeat(length) },
        });
      },
      { url, length },
    );

  await expect
    .poll(async () => fill(201))
    .toMatchObject({
      success: false,
      error: expect.stringContaining("200 characters"),
    });
  await expect(textarea).toHaveValue("Existing text");
  await expect(unrelated).toHaveValue("Unrelated draft");
  await expect(page.getByText("Message Filled!")).toHaveCount(0);
  await textarea.evaluate((element) => element.removeAttribute("maxlength"));
  const counter = invitation.locator('[aria-live="polite"]');
  await counter.evaluate((element) =>
    element.setAttribute("style", "visibility: hidden"),
  );
  expect(await fill(201)).toMatchObject({ success: false });
  await expect(textarea).toHaveValue("Existing text");
  await counter.evaluate((element) => element.removeAttribute("style"));
  expect(await fill(301)).toMatchObject({
    success: false,
    error: expect.stringContaining("300 characters"),
  });
  await expect(textarea).toHaveValue("Existing text");
  expect(await fill(300)).toMatchObject({ success: true });
  await expect(textarea).toHaveValue("x".repeat(300));
  await counter.evaluate((element) => {
    element.textContent = "300/500";
  });
  expect(await fill(201)).toMatchObject({ success: false });
  await expect(textarea).toHaveValue("x".repeat(300));
  await textarea.fill("Existing text");
  await counter.evaluate((element) => {
    element.textContent = "13/100";
  });
  expect(await fill(101)).toMatchObject({
    success: false,
    error: expect.stringContaining("100 characters"),
  });
  await counter.evaluate((element) => element.remove());
  expect(await fill(201)).toMatchObject({ success: false });
  await expect(textarea).toHaveValue("Existing text");
  expect(await fill(200)).toMatchObject({ success: true });
  await expect(textarea).toHaveValue("x".repeat(200));
  await textarea.evaluate((element) =>
    element.setAttribute("maxlength", "300"),
  );
  expect(await fill(201)).toMatchObject({ success: true });
  await expect(textarea).toHaveValue("x".repeat(201));
  await expect(unrelated).toHaveValue("Unrelated draft");
  await expect(inmail).toHaveValue("InMail draft");
  await invitation.evaluate((element) => element.setAttribute("hidden", ""));
  expect(await fill(200)).toMatchObject({ success: false });
  await expect(inmail).toHaveValue("InMail draft");
  await expect(fading).toHaveValue("Fading draft");
  await expect(personal).toHaveValue("Personal note");
  await invitation.evaluate((element) => element.removeAttribute("hidden"));
  await textarea.evaluate((element) => element.setAttribute("readonly", ""));
  expect(await fill(200)).toMatchObject({ success: false });
  await expect(textarea).toHaveValue("x".repeat(201));
  await textarea.evaluate((element) => {
    element.removeAttribute("readonly");
    element.setAttribute("disabled", "");
  });
  expect(await fill(200)).toMatchObject({ success: false });
  await expect(textarea).toHaveValue("x".repeat(201));
});

test.describe("Store ZIP", () => {
  test.use({ storeZip: true });

  for (const layout of ["shadow", "standalone"] as const) {
    test(`the Store ZIP honors the counter linked to a ${layout} note`, async () => {
      const url = `https://www.linkedin.com/in/linked-counter-${layout}`;
      const note = `<div><textarea id="note" name="message" placeholder="Add a note" maxlength="300"
        aria-describedby="hint invisible count">Existing note</textarea></div>
        <footer><p id="hint">Please add a short note</p>
        <span id="invisible" hidden aria-live="polite">13/10</span>
        ${
          layout === "shadow"
            ? '<div id="count"><span>Note length</span><span aria-live="polite">13/200</span></div>'
            : '<span id="count">13/200</span>'
        }</footer>`;
      await browser.route(url, (route) =>
        route.fulfill({
          contentType: "text/html",
          body:
            layout === "shadow"
              ? `<div id="interop-outlet"><template shadowrootmode="open">
                <section role="dialog" aria-label="Add a note to your invitation">
                  ${note}<button id="send" type="button" onclick="this.dataset.clicked='true'">Send invitation</button>
                </section>
              </template></div>`
              : note,
        }),
      );
      const worker =
        browser.serviceWorkers()[0] ??
        (await browser.waitForEvent("serviceworker"));
      const page = await browser.newPage();
      await page.goto(url);
      const field = page.locator("#note");
      const fill = (length: number) =>
        worker.evaluate(
          async ({ url, length }) => {
            const [tab] = await chrome.tabs.query({ url });
            return chrome.tabs.sendMessage(tab!.id, {
              action: "autoFill",
              data: {
                category: "linkedin_connection",
                body: "x".repeat(length),
              },
            });
          },
          { url, length },
        );

      let result: unknown;
      await expect
        .poll(async () => {
          try {
            result = await fill(250);
            return true;
          } catch (error) {
            if (
              !(error instanceof Error) ||
              !error.message.includes("Receiving end does not exist")
            )
              throw error;
            return false;
          }
        })
        .toBe(true);
      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining("200 characters"),
      });
      await expect(field).toHaveValue("Existing note");
      expect(await fill(200)).toMatchObject({ success: true });
      await expect(field).toHaveValue("x".repeat(200));

      await field.evaluate((textarea) => {
        const root = textarea.getRootNode() as Document | ShadowRoot;
        const counter = root.getElementById("count")!;
        const count = document.createElement("span");
        count.textContent = "13/200";
        counter.replaceChildren(count);
        counter.setAttribute("style", "display: contents");
      });
      expect(await fill(250)).toMatchObject({
        success: false,
        error: expect.stringContaining("200 characters"),
      });
      await expect(field).toHaveValue("x".repeat(200));

      await field.evaluate((textarea) => {
        textarea.removeAttribute("maxlength");
        const root = textarea.getRootNode() as Document | ShadowRoot;
        const counter = root.getElementById("count")!;
        const hidden = document.createElement("span");
        hidden.setAttribute("aria-live", "polite");
        hidden.hidden = true;
        hidden.textContent = "0/300";
        counter.replaceChildren(hidden);
        counter.setAttribute("style", "display: block; min-height: 20px");
      });
      expect(await fill(250)).toMatchObject({
        success: false,
        error: expect.stringContaining("200 characters"),
      });
      await expect(field).toHaveValue("x".repeat(200));
      await field.evaluate((textarea) => {
        const root = textarea.getRootNode() as Document | ShadowRoot;
        const hidden = root.getElementById("count")!.firstElementChild!;
        hidden.removeAttribute("hidden");
        hidden.setAttribute(
          "style",
          "position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap",
        );
      });
      expect(await fill(250)).toMatchObject({
        success: false,
        error: expect.stringContaining("200 characters"),
      });
      await expect(field).toHaveValue("x".repeat(200));

      await field.evaluate((textarea) => {
        const root = textarea.getRootNode() as Document | ShadowRoot;
        const counter = root.getElementById("count")!;
        const clipped = document.createElement("span");
        clipped.setAttribute(
          "style",
          "position: absolute; width: 0; height: 0; overflow: hidden; white-space: nowrap",
        );
        const count = document.createElement("span");
        count.setAttribute("aria-live", "polite");
        count.textContent = "0/300";
        clipped.append(count);
        counter.replaceChildren(clipped);
      });
      expect(await fill(250)).toMatchObject({
        success: false,
        error: expect.stringContaining("200 characters"),
      });
      await expect(field).toHaveValue("x".repeat(200));

      await field.evaluate((textarea) => {
        textarea.setAttribute("maxlength", "300");
        const root = textarea.getRootNode() as Document | ShadowRoot;
        const counter = root.getElementById("count")!;
        const wrapper = counter.firstElementChild!;
        const count = wrapper.firstElementChild!;
        counter.setAttribute("style", "position: relative; min-height: 20px");
        wrapper.setAttribute(
          "style",
          "display: block; width: 0; height: 0; overflow: hidden",
        );
        count.setAttribute("style", "position: absolute; top: 0; left: 0");
        count.textContent = "13/200";
      });
      expect(await fill(250)).toMatchObject({
        success: false,
        error: expect.stringContaining("200 characters"),
      });
      await expect(field).toHaveValue("x".repeat(200));
      if (layout === "shadow")
        expect(
          await page.locator("#send").getAttribute("data-clicked"),
        ).toBeNull();
    });
  }

  test("the Store ZIP rejects clipped fields and counters unrelated to the composer", async () => {
    const url = "https://www.linkedin.com/in/untrusted-composer-counter";
    await browser.route(url, (route) =>
      route.fulfill({
        contentType: "text/html",
        body:
          '<div id="interop-outlet"><template shadowrootmode="open">' +
          '<section role="dialog" aria-label="Add a note to your invitation">' +
          '<div id="note-wrap" style="height:0;overflow:hidden">' +
          '<textarea id="note" name="message" aria-describedby="counter">Existing note</textarea></div>' +
          '<span id="counter" aria-live="polite">13/300</span>' +
          '<button id="send" onclick="this.dataset.clicked=\'true\'">Send invitation</button>' +
          "</section></template></div>",
      }),
    );
    const worker =
      browser.serviceWorkers()[0] ??
      (await browser.waitForEvent("serviceworker"));
    const page = await browser.newPage();
    await page.goto(url);
    const fill = (length: number) =>
      worker.evaluate(
        async ({ url, length }) => {
          const [tab] = await chrome.tabs.query({ url });
          return chrome.tabs.sendMessage(tab!.id, {
            action: "autoFill",
            data: { category: "linkedin_connection", body: "x".repeat(length) },
          });
        },
        { url, length },
      );

    const note = page.locator("#note");
    expect.soft(await fill(150)).toMatchObject({ success: false });
    await expect.soft(note).toHaveValue("Existing note", { timeout: 500 });

    await note.evaluate((field) => {
      const root = field.getRootNode() as ShadowRoot;
      root.getElementById("note-wrap")!.removeAttribute("style");
      root.getElementById("counter")!.style.clipPath = "inset(100%)";
      (field as HTMLTextAreaElement).value = "Existing note";
    });
    expect.soft(await fill(250)).toMatchObject({
      success: false,
      error: expect.stringContaining("200 characters"),
    });
    await expect.soft(note).toHaveValue("Existing note", { timeout: 500 });
    await page.locator("#counter").evaluate((counter) => {
      counter.removeAttribute("style");
      counter.textContent = "12/300";
    });
    expect(await fill(250)).toMatchObject({ success: false });
    await expect(note).toHaveValue("Existing note");
    await page.locator("#counter").evaluate((counter) => {
      counter.textContent = "13/300";
    });
    await page.locator("#counter").evaluate((counter) => {
      counter.setAttribute("aria-label", "Team member count");
    });
    expect.soft(await fill(250)).toMatchObject({ success: false });
    await expect.soft(note).toHaveValue("Existing note", { timeout: 500 });
    await page.locator("#counter").evaluate((counter) => {
      counter.removeAttribute("aria-label");
      counter.setAttribute(
        "style",
        "display:block;width:3ch;overflow:hidden;white-space:nowrap",
      );
      (counter.getRootNode() as ShadowRoot).querySelector<HTMLTextAreaElement>(
        "#note",
      )!.value = "Existing note";
    });
    expect.soft(await fill(250)).toMatchObject({ success: false });
    await expect.soft(note).toHaveValue("Existing note", { timeout: 500 });
    await page.locator("#counter").evaluate((counter) => {
      counter.removeAttribute("style");
      const root = counter.getRootNode() as ShadowRoot;
      root.querySelector<HTMLTextAreaElement>("#note")!.value = "Existing note";
      const other = document.createElement("section");
      other.setAttribute("role", "dialog");
      counter.after(other);
      other.append(counter);
    });
    expect.soft(await fill(250)).toMatchObject({ success: false });
    await expect.soft(note).toHaveValue("Existing note", { timeout: 500 });
    await page.locator("#counter").evaluate((counter) => {
      const root = counter.getRootNode() as ShadowRoot;
      const field = root.querySelector<HTMLTextAreaElement>("#note")!;
      field.value = "Existing note";
      field.style.clipPath = "inset(0)";
      const other = counter.parentElement!;
      other.before(counter);
      other.remove();
    });
    expect(await fill(250)).toMatchObject({ success: true });
    await expect(note).toHaveValue("x".repeat(250));
    expect(await page.locator("#send").getAttribute("data-clicked")).toBeNull();

    await page.locator("body").evaluate((body) => {
      body.innerHTML =
        '<textarea id="note" placeholder="Add a note">Existing note</textarea>' +
        '<span aria-live="polite">Saved</span>' +
        '<span aria-live="polite" aria-label="Team member count">13/300</span>';
    });
    expect.soft(await fill(250)).toMatchObject({
      success: false,
      error: expect.stringContaining("200 characters"),
    });
    await expect.soft(note).toHaveValue("Existing note", { timeout: 500 });
    await note.evaluate((field) => {
      (field as HTMLTextAreaElement).value = "Existing note";
      const counter = field.nextElementSibling!;
      counter.textContent = "12/100";
    });
    expect(await fill(150)).toMatchObject({ success: true });
  });

  test("the packaged extension fills only the live-shaped LinkedIn shadow composer", async () => {
    const url = "https://www.linkedin.com/in/shadow-composer-fixture";
    await browser.route(url, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<textarea name="message" id="dm">Unrelated message</textarea>
      <div id="interop-outlet"><template shadowrootmode="open">
        <div role="dialog" aria-labelledby="send-invite-modal">
          <h2 id="send-invite-modal">Add a note to your invitation</h2>
          <textarea name="message" id="custom-message" placeholder="Ex: We know each other from…">Existing note</textarea>
          <div><span aria-live="polite">13/300</span></div>
          <button type="submit">Send invitation</button>
        </div>
      </template></div>`,
      }),
    );
    const worker =
      browser.serviceWorkers()[0] ??
      (await browser.waitForEvent("serviceworker"));
    const page = await browser.newPage();
    await page.goto(url);
    const host = page.locator("#interop-outlet");
    const note = host.locator("#custom-message");
    const send = host.getByRole("button", { name: "Send invitation" });
    await send.evaluate((button) => {
      button.addEventListener("click", () =>
        button.setAttribute("data-clicked", "true"),
      );
    });
    const fill = (length: number) =>
      worker.evaluate(
        async ({ url, length }) => {
          const [tab] = await chrome.tabs.query({ url });
          return chrome.tabs.sendMessage(tab!.id, {
            action: "autoFill",
            data: { category: "linkedin_connection", body: "x".repeat(length) },
          });
        },
        { url, length },
      );

    expect(await fill(301)).toMatchObject({
      success: false,
      error: expect.stringContaining("300 characters"),
    });
    await expect(note).toHaveValue("Existing note");
    expect(await fill(300)).toMatchObject({ success: true });
    await expect(note).toHaveValue("x".repeat(300));
    await expect(page.locator("#dm")).toHaveValue("Unrelated message");
    expect(await send.getAttribute("data-clicked")).toBeNull();

    await host.evaluate((element) =>
      element.setAttribute("aria-hidden", "true"),
    );
    expect(await fill(200)).toMatchObject({ success: false });
    await expect(note).toHaveValue("x".repeat(300));
    await host.evaluate((element) => element.removeAttribute("aria-hidden"));
    await host.evaluate((element) => {
      const otherNote = document.createElement("textarea");
      otherNote.id = "other-shadow-note";
      otherNote.placeholder = "Add a note";
      otherNote.value = "Unrelated note";
      element.shadowRoot!.append(otherNote);
    });
    expect(await fill(200)).toMatchObject({ success: true });
    await expect(note).toHaveValue("x".repeat(200));
    await expect(host.locator("#other-shadow-note")).toHaveValue(
      "Unrelated note",
    );
    await page.locator("body").evaluate((body) => {
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-label", "Add a note");
      dialog.innerHTML =
        '<textarea name="message">Another invitation</textarea>';
      body.append(dialog);
    });
    expect(await fill(200)).toMatchObject({ success: false });
    await expect(note).toHaveValue("x".repeat(200));
    await expect(page.getByText("Another invitation")).toHaveCount(1);

    await page
      .getByText("Another invitation")
      .evaluate((field) => field.closest('[role="dialog"]')?.remove());
    await note.evaluate((field) => {
      field.setAttribute("maxlength", "300");
      field.nextElementSibling!.querySelector("span")!.textContent = "200/200";
    });
    expect(await fill(250)).toMatchObject({
      success: false,
      error: expect.stringContaining("200 characters"),
    });
    await expect(note).toHaveValue("x".repeat(200));
    await note.evaluate((field) => {
      const adjacent = field.nextElementSibling!;
      const status = document.createElement("span");
      status.setAttribute("aria-live", "polite");
      status.textContent = "Saved";
      adjacent.append(status);
    });
    expect(await fill(250)).toMatchObject({ success: false });
    await note.evaluate((field) => {
      field.nextElementSibling!.lastElementChild!.textContent = "200/300";
    });
    expect(await fill(250)).toMatchObject({ success: false });
    await expect(note).toHaveValue("x".repeat(200));
    await note.evaluate((field) => {
      const status = document.createElement("span");
      status.setAttribute("aria-live", "polite");
      status.textContent = "Saved";
      field.after(status);
    });
    expect(await fill(250)).toMatchObject({ success: false });
    await expect(note).toHaveValue("x".repeat(200));
    await note.evaluate((field) => {
      field.nextElementSibling!.remove();
      field.removeAttribute("maxlength");
      const wrapper = field.nextElementSibling!;
      const counter = wrapper.querySelector("span")!;
      counter.textContent = "200/300";
      wrapper.replaceWith(counter);
    });
    expect(await fill(250)).toMatchObject({ success: true });
    await expect(note).toHaveValue("x".repeat(250));

    await host.locator("#send-invite-modal").evaluate((heading) => {
      heading.textContent = "Send invitation to Event";
    });
    expect(await fill(100)).toMatchObject({ success: false });
    await expect(note).toHaveValue("x".repeat(250));

    await host.evaluate((element) => {
      const shadow = element.shadowRoot!;
      shadow.replaceChildren();
      const hidden = document.createElement("div");
      hidden.setAttribute("aria-hidden", "true");
      hidden.append(document.createElement("slot"));
      shadow.append(hidden);
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-label", "Add a note to your invitation");
      const slottedNote = document.createElement("textarea");
      slottedNote.id = "slotted-note";
      slottedNote.name = "message";
      slottedNote.value = "Hidden note";
      dialog.append(slottedNote);
      element.append(dialog);
    });
    expect(await fill(100)).toMatchObject({ success: false });
    await expect(host.locator("#slotted-note")).toHaveValue("Hidden note");

    await page.locator("body").evaluate((body) => {
      const event = document.createElement("div");
      event.setAttribute("role", "dialog");
      event.setAttribute("aria-label", "Send invitation to Event");
      const eventNote = document.createElement("textarea");
      eventNote.id = "event-note";
      eventNote.placeholder = "Add a note";
      eventNote.value = "Event draft";
      event.append(eventNote);
      body.append(event);
    });
    expect(await fill(100)).toMatchObject({ success: false });
    await expect(page.locator("#event-note")).toHaveValue("Event draft");

    await page.locator("#event-note").evaluate((field) => {
      field.closest('[role="dialog"]')?.remove();
      field.setAttribute("id", "legacy-note");
      field.setAttribute("maxlength", "300");
      const counter = document.createElement("span");
      counter.setAttribute("aria-live", "polite");
      counter.textContent = "11/200";
      document.body.append(field, counter);
    });
    expect(await fill(250)).toMatchObject({ success: false });
    await expect(page.locator("#legacy-note")).toHaveValue("Event draft");
  });
});

test("remembers the LinkedIn note limit and sends it with and without a job description", async () => {
  const url = "https://www.linkedin.com/in/note-limit-fixture";
  const posts: Record<string, unknown>[] = [];
  await browser.route(url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Alex Example | LinkedIn</title><main>Alex Example leads policy evaluation and data platform tooling at Example Labs.</main>",
    }),
  );
  await browser.route(
    "https://www.aletheia.live/api/extension/generate",
    async (route) => {
      const body = route.request().postDataJSON();
      posts.push(body);
      return route.fulfill({
        json: {
          success: true,
          category: "linkedin_connection",
          body: "x".repeat(body.connectionNoteLimit === 300 ? 280 : 190),
        },
      });
    },
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a");
  const profile = await browser.newPage();
  await profile.goto(url);
  const panel = await browser.newPage();
  await profile.bringToFront();
  await panel.goto(
    `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
  );
  await expect(panel.locator("#profileName")).toHaveText("Alex Example");

  const limit = panel.getByLabel("LinkedIn note limit");
  const generate = panel.locator("#generateBtn");
  const count = panel.locator("#messageCharCount");
  await expect(limit).toHaveValue("200");
  await limit.selectOption("300");
  await generate.click();
  await expect(count).toHaveText("280/300");
  expect(posts[0]).toMatchObject({ connectionNoteLimit: 300, jd: "" });

  await profile.bringToFront();
  await panel.reload();
  await expect(panel.locator("#profileName")).toHaveText("Alex Example");
  await expect(limit).toHaveValue("300");
  await panel.locator("#jdInput").fill(jd);
  await generate.click();
  await expect(generate).toBeEnabled();
  expect(posts[1]).toMatchObject({ connectionNoteLimit: 300, jd });

  await limit.selectOption("200");
  await expect(count).toHaveText("280/200");
  await expect(count).toHaveClass(/over-limit/);
  await generate.click();
  await expect(count).toHaveText("190/200");
  expect(posts[2]).toMatchObject({ connectionNoteLimit: 200, jd });

  await panel.locator("#category").selectOption("linkedin_inmail");
  await expect(limit).toBeHidden();
});

test("uses the selected endpoint, recovers from stale stories and clears before automatic generation", async () => {
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  let refusal: 422 | 405 | null = null;
  let listAvailable = false;
  const refreshRequests: string[] = [];
  await browser.route(
    "https://www.aletheia.live/auth/v1/token?*",
    async (route) => {
      refreshRequests.push(route.request().method());
      await route.fulfill({ status: 401 });
    },
  );
  await browser.route(
    "https://www.aletheia.live/api/extension/**",
    async (route) => {
      const req = route.request();
      if (req.method() === "GET")
        return listAvailable
          ? route.fulfill({ json: { evidence: [first, second] } })
          : route.fulfill({ status: 404 });
      posts.push({
        path: new URL(req.url()).pathname,
        body: req.postDataJSON(),
      });
      if (refusal)
        return route.fulfill({
          status: refusal,
          json: {
            success: false,
            code: "EVIDENCE_SELECTION_UNAVAILABLE",
            message: "The story is unavailable.",
          },
        });
      return route.fulfill({
        json: { success: true, category: "yc_application", body: answer },
      });
    },
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", 120);
  const page = await openPanel(worker);
  await page.locator("#category").selectOption("yc_application");
  await page.locator("#jdInput").fill(jd);
  await page.getByText("Story focus · Automatic", { exact: true }).click();
  await expect(page.locator("#evidenceStatus")).toContainText(
    "unavailable on this server",
  );
  listAvailable = true;
  await page.getByRole("button", { name: "Reload stories" }).click();
  await page.getByRole("checkbox", { name: /Policy prototype/ }).check();
  await page.getByRole("checkbox", { name: /Review guide/ }).check();
  await expect(page.locator("#evidenceSummary")).toHaveText(/2 selected/);
  await page.locator("#generateBtn").click();
  await expect(page.locator("#output")).toBeVisible();
  expect(posts[0]).toMatchObject({
    path: "/api/extension/evidence",
    body: { selectedEvidenceIds: [first.id, second.id] },
  });
  expect(
    await worker.evaluate(() => chrome.storage.local.get("lastGeneration")),
  ).toEqual({});

  refusal = 422;
  await page.locator("#generateBtn").click();
  await expect(page.locator("#evidenceStatus")).toContainText(
    "Change your selection",
  );
  await expect(
    page.getByRole("checkbox", { name: /Policy prototype/ }),
  ).toBeChecked();

  refusal = 405;
  await page.locator("#generateBtn").click();
  await expect(page.locator("#errorText")).toContainText(
    "cannot generate with selected stories",
  );
  expect(posts).toHaveLength(3);
  expect(posts.every(({ path }) => path === "/api/extension/evidence")).toBe(
    true,
  );

  expect(refreshRequests).toEqual([]);
  refusal = null;
  await signIn(worker, "user-a");
  await page
    .locator("#jdInput")
    .fill(jd + " The role also supports customer research.");
  await expect(
    page.getByRole("checkbox", { name: /Policy prototype/ }),
  ).not.toBeChecked();
  await page.locator("#generateBtn").click();
  await expect.poll(() => posts.length).toBe(4);
  expect(posts[3]?.path).toBe("/api/extension/generate");
  expect(posts[3]?.body).not.toHaveProperty("selectedEvidenceIds");
});

test("uses the near-expiry bearer without changing auth and discards a delayed response after an account switch", async () => {
  let delayed: Route | undefined;
  const refreshRequests: string[] = [];
  await browser.route(
    "https://www.aletheia.live/auth/v1/token?*",
    async (route) => {
      refreshRequests.push(route.request().method());
      await route.fulfill({ status: 401 });
    },
  );
  await browser.route(
    "https://www.aletheia.live/api/extension/evidence",
    async (route) => {
      if (route.request().headers().authorization === "Bearer token-user-a") {
        delayed = route;
        return;
      }
      await route.fulfill({ json: { evidence: [second] } });
    },
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", 120);
  const page = await openPanel(worker);
  await page.getByText("Story focus · Automatic", { exact: true }).click();
  await expect
    .poll(() => (delayed ? "list" : (refreshRequests[0] ?? "waiting")))
    .toBe("list");
  await expect(page.locator("#evidenceStatus")).toContainText(
    "Loading confirmed stories",
  );
  await signIn(worker, "user-b");
  await expect(page.locator("#userBadge")).toContainText("user-b@example.test");
  await delayed?.fulfill({ json: { evidence: [first] } });
  await page.getByText("Story focus · Automatic", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Review guide/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Policy prototype/ }),
  ).toHaveCount(0);
  expect(refreshRequests).toEqual([]);
});

test("an expired startup session cannot restore the previous account", async () => {
  let pending: Route | undefined;
  await browser.route(
    "https://www.aletheia.live/api/extension/session",
    (route) => {
      pending = route;
    },
  );
  await browser.route("https://www.aletheia.live/auth/v1/token?*", (route) => {
    pending = route;
  });
  await browser.route(
    "https://www.aletheia.live/api/extension/evidence",
    (route) =>
      route.fulfill({
        json: {
          evidence:
            route.request().headers().authorization === "Bearer token-user-b"
              ? [second]
              : [first],
        },
      }),
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", -60);
  const page = await browser.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
  );
  await expect.poll(() => pending?.request().method()).toMatch(/^(GET|POST)$/u);
  await signIn(worker, "user-b");
  await pending?.fulfill({
    json: {
      access_token: "token-user-a",
      refresh_token: "unused",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      supabase_url: "https://www.aletheia.live",
      supabase_anon_key: "synthetic-key",
      user: { id: "user-a", email: "user-a@example.test" },
    },
  });
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const key = "aletheia_diagnostic_events_v1";
        const stored = await chrome.storage.session.get(key);
        const events = stored[key] as Array<{ event: string }> | undefined;
        return events?.some(
          ({ event }) => event === "auth.silent_check.complete",
        );
      }),
    )
    .toBe(true);
  expect(
    await worker.evaluate(() => chrome.storage.local.get("aletheia_auth")),
  ).toMatchObject({ aletheia_auth: { user: { id: "user-b" } } });
  await expect(page.locator("#userBadge")).toContainText("user-b@example.test");
  await page.getByText("Story focus · Automatic", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Review guide/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Policy prototype/ }),
  ).toHaveCount(0);
});

test("renews the connected account before checking the web session", async () => {
  let webSessionRequests = 0;
  await browser.route(
    "https://www.aletheia.live/api/extension/session",
    (route) => {
      webSessionRequests++;
      return route.fulfill({ status: 401, json: {} });
    },
  );
  await browser.route("https://www.aletheia.live/auth/v1/token?*", (route) =>
    route.fulfill({
      json: {
        access_token: "renewed-user-a",
        refresh_token: "rotated-user-a",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "user-a", email: "user-a@example.test" },
      },
    }),
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", -60);
  const page = await openPanel(worker);
  await expect(page.locator("#userBadge")).toContainText("user-a@example.test");
  expect(
    await worker.evaluate(() => chrome.storage.local.get("aletheia_auth")),
  ).toMatchObject({
    aletheia_auth: { user: { id: "user-a" }, access_token: "renewed-user-a" },
  });
  expect(webSessionRequests).toBe(0);
});

test("a delayed automatic generation 401 leaves the newly connected account intact", async () => {
  let pending: Route | undefined;
  let webSessionRequests = 0;
  await browser.route(
    "https://www.aletheia.live/api/extension/generate",
    async (route) => {
      if (route.request().method() === "POST") {
        pending = route;
        return;
      }
      await route.fulfill({ json: {} });
    },
  );
  await browser.route(
    "https://www.aletheia.live/api/extension/session",
    (route) => {
      webSessionRequests++;
      return route.fulfill({ status: 401, json: {} });
    },
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a");
  const page = await openPanel(worker);
  await page.locator("#category").selectOption("yc_application");
  await page.locator("#jdInput").fill(jd);
  await page.locator("#generateBtn").click();
  await expect.poll(() => Boolean(pending)).toBe(true);

  await signIn(worker, "user-b");
  await pending?.fulfill({
    status: 401,
    json: { code: "SESSION_UNAVAILABLE" },
  });
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const key = "aletheia_diagnostic_events_v1";
        const stored = await chrome.storage.session.get(key);
        const events = stored[key] as
          Array<{ stage?: string; errorCode?: string }> | undefined;
        return events?.some(
          (entry) =>
            entry.stage === "generation.workflow" &&
            entry.errorCode === "AUTH_ACCOUNT_CHANGED",
        );
      }),
    )
    .toBe(true);
  await expect(page.locator("#userBadge")).toContainText("user-b@example.test");
  expect(webSessionRequests).toBe(0);
  expect(
    await worker.evaluate(() => chrome.storage.local.get("aletheia_auth")),
  ).toMatchObject({ aletheia_auth: { user: { id: "user-b" } } });
});

test("adopts a different web account only after the user explicitly connects", async () => {
  await browser.route("https://www.aletheia.live/auth/v1/token?*", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await browser.route(
    "https://www.aletheia.live/api/extension/session",
    (route) =>
      route.fulfill({
        json: {
          access_token: "token-user-b",
          refresh_token: "new-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          supabase_url: "https://www.aletheia.live",
          supabase_anon_key: "synthetic-key",
          user: { id: "user-b", email: "user-b@example.test" },
        },
      }),
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  await signIn(worker, "user-a", -60);
  const page = await browser.newPage();
  await page.goto(
    `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
  );
  const connect = page.getByRole("button", { name: "Connect to Aletheia" });
  await expect(connect).toBeVisible();
  expect(
    await worker.evaluate(() => chrome.storage.local.get("aletheia_auth")),
  ).toMatchObject({ aletheia_auth: { user: { id: "user-a" } } });
  await connect.click();
  await expect(page.locator("#userBadge")).toContainText("user-b@example.test");
});

test.describe("delayed profile read", () => {
  test.use({ slowReader: true });

  test("ignores the previous profile and clears the old account's visible stories during startup", async () => {
    await browser.route("https://www.linkedin.com/in/*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<title>${route.request().url().endsWith("alice") ? "Alice" : "Bob"}</title>`,
      }),
    );
    await browser.route(
      "https://www.aletheia.live/api/extension/evidence",
      (route) =>
        route.fulfill({
          json: {
            evidence:
              route.request().headers().authorization === "Bearer token-user-a"
                ? [first]
                : [second],
          },
        }),
    );
    const worker =
      browser.serviceWorkers()[0] ??
      (await browser.waitForEvent("serviceworker"));
    await signIn(worker, "user-a");
    const alice = await browser.newPage();
    await alice.goto("https://www.linkedin.com/in/alice");
    const bob = await browser.newPage();
    await bob.goto("https://www.linkedin.com/in/bob");
    const page = await browser.newPage();
    await alice.bringToFront();
    await page.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
    );
    await expect(alice.locator("html")).toHaveAttribute(
      "data-reader-pending",
      "true",
    );
    await page.getByText("Story focus · Automatic", { exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: /Policy prototype/ }),
    ).toBeVisible();

    // Both events happen before the old profile read resolves.
    await bob.bringToFront();
    await expect(page.locator("#profileName")).toHaveText("Bob");
    await page.getByRole("checkbox", { name: /Policy prototype/ }).check();
    await signIn(worker, "user-b");
    await expect(page.locator("#userBadge")).toContainText(
      "user-b@example.test",
    );
    await expect(page.locator("#profileName")).toHaveText("Bob");
    await alice
      .locator("html")
      .evaluate((element) =>
        element.setAttribute("data-release-reader", "yes"),
      );
    await page.getByText("Story focus · Automatic", { exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: /Review guide/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /Policy prototype/ }),
    ).toHaveCount(0);
    await expect(page.locator("#profileName")).toHaveText("Bob");
  });
});
