import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const autoFillerSource = readFileSync(
  new URL("./auto-filler.js", import.meta.url),
  "utf8",
);

describe("auto-filler DOM safety", () => {
  it("does not inject generated message content through innerHTML", () => {
    expect(autoFillerSource).not.toContain(
      "element.innerHTML = content.replace",
    );
    expect(autoFillerSource).toContain("element.replaceChildren()");
    expect(autoFillerSource).toContain("document.createTextNode(line)");
  });

  it("builds fill notifications with DOM nodes instead of HTML templates", () => {
    expect(autoFillerSource).not.toContain("notification.innerHTML = `");
    expect(autoFillerSource).toContain("document.createElement('small')");
    expect(autoFillerSource).toContain(
      "count.textContent = `${result.filled.length} field(s) completed`",
    );
  });
});
