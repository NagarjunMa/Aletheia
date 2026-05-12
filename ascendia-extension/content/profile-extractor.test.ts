import { describe, it, expect } from "vitest";
import {
  isLinkedInProfilePage,
  parseNameFromTitle,
  extractProfileMarkdown,
  extractProfileFromDOM,
  hasProfileChanged,
} from "./profile-extractor.js";

// ─── isLinkedInProfilePage ───

describe("isLinkedInProfilePage", () => {
  it("returns true for /in/ on linkedin.com", () => {
    expect(
      isLinkedInProfilePage({
        pathname: "/in/jane-smith",
        hostname: "www.linkedin.com",
      } as Location),
    ).toBe(true);
  });

  it("returns false for non-profile LinkedIn pages", () => {
    expect(
      isLinkedInProfilePage({
        pathname: "/feed/",
        hostname: "www.linkedin.com",
      } as Location),
    ).toBe(false);
  });

  it("returns false for non-LinkedIn domains", () => {
    expect(
      isLinkedInProfilePage({
        pathname: "/in/test",
        hostname: "www.example.com",
      } as Location),
    ).toBe(false);
  });
});

// ─── parseNameFromTitle ───

describe("parseNameFromTitle", () => {
  it("extracts name from standard LinkedIn title", () => {
    expect(
      parseNameFromTitle("Jane Smith - Software Engineer | LinkedIn"),
    ).toBe("Jane Smith");
  });

  it("handles title without role section", () => {
    expect(parseNameFromTitle("John Doe | LinkedIn")).toBe("John Doe");
  });

  it("handles hyphenated names", () => {
    // "Sarah-Jane O'Brien - Designer | LinkedIn" → split on " - "
    expect(parseNameFromTitle("Sarah-Jane O'Brien - Designer | LinkedIn")).toBe(
      "Sarah-Jane O'Brien",
    );
  });

  it("returns null for empty title", () => {
    expect(parseNameFromTitle("")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(parseNameFromTitle(null as any)).toBeNull();
    expect(parseNameFromTitle(undefined as any)).toBeNull();
  });
});

// ─── extractProfileMarkdown ───

describe("extractProfileMarkdown", () => {
  it("returns empty string for null element", () => {
    expect(extractProfileMarkdown(null)).toBe("");
  });

  it("extracts innerText and trims", () => {
    const el = { innerText: "  Hello World  " } as HTMLElement;
    expect(extractProfileMarkdown(el)).toBe("Hello World");
  });

  it("collapses triple+ newlines", () => {
    const el = { innerText: "A\n\n\n\nB" } as HTMLElement;
    expect(extractProfileMarkdown(el)).toBe("A\n\nB");
  });

  it("truncates to maxChars", () => {
    const el = { innerText: "x".repeat(10000) } as HTMLElement;
    expect(extractProfileMarkdown(el, 500).length).toBe(500);
  });

  it("defaults to 8000 chars", () => {
    const el = { innerText: "x".repeat(10000) } as HTMLElement;
    expect(extractProfileMarkdown(el).length).toBe(8000);
  });
});

// ─── extractProfileFromDOM ───

describe("extractProfileFromDOM", () => {
  it("returns null when name cannot be extracted", () => {
    const doc = {
      title: "",
      querySelector: () => null,
      body: { innerText: "" },
    };
    const loc = { href: "https://linkedin.com/in/test" };
    expect(extractProfileFromDOM(doc as any, loc as any)).toBeNull();
  });

  it("returns null when content too short (<50 chars)", () => {
    const doc = {
      title: "Jane - Eng | LinkedIn",
      querySelector: () => ({ innerText: "Short" }),
      body: { innerText: "Short" },
    };
    const loc = { href: "https://linkedin.com/in/jane" };
    expect(extractProfileFromDOM(doc as any, loc as any)).toBeNull();
  });

  it("extracts full profile when valid", () => {
    const profileText = "A".repeat(100);
    const doc = {
      title: "Jane Smith - Engineer | LinkedIn",
      querySelector: (sel: string) =>
        sel === "main" ? { innerText: profileText } : null,
      body: { innerText: profileText },
    };
    const loc = { href: "https://linkedin.com/in/jane-smith" };

    const result = extractProfileFromDOM(doc as any, loc as any);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Jane Smith");
    expect(result!.profileUrl).toBe("https://linkedin.com/in/jane-smith");
    expect(result!.extractedAt).toBeDefined();
  });

  it("falls back to document.body when main not found", () => {
    const profileText = "B".repeat(100);
    const doc = {
      title: "John Doe - PM | LinkedIn",
      querySelector: () => null,
      body: { innerText: profileText },
    };
    const loc = { href: "https://linkedin.com/in/john" };

    const result = extractProfileFromDOM(doc as any, loc as any);
    expect(result!.profileMarkdown.length).toBe(100);
  });
});

// ─── hasProfileChanged ───

describe("hasProfileChanged", () => {
  it("returns true when old profile is null", () => {
    expect(
      hasProfileChanged(
        { name: "A", profileUrl: "url", profileMarkdown: "md" },
        null,
      ),
    ).toBe(true);
  });

  it("returns true when name changes", () => {
    const old = { name: "A", profileUrl: "url", profileMarkdown: "md" };
    const next = { name: "B", profileUrl: "url", profileMarkdown: "md" };
    expect(hasProfileChanged(next, old)).toBe(true);
  });

  it("returns true when URL changes", () => {
    const old = { name: "A", profileUrl: "url1", profileMarkdown: "md" };
    const next = { name: "A", profileUrl: "url2", profileMarkdown: "md" };
    expect(hasProfileChanged(next, old)).toBe(true);
  });

  it("returns true when markdown length changes", () => {
    const old = { name: "A", profileUrl: "url", profileMarkdown: "short" };
    const next = {
      name: "A",
      profileUrl: "url",
      profileMarkdown: "longer text",
    };
    expect(hasProfileChanged(next, old)).toBe(true);
  });

  it("returns false when nothing changed", () => {
    const p = { name: "A", profileUrl: "url", profileMarkdown: "same" };
    expect(hasProfileChanged(p, p)).toBe(false);
  });
});
