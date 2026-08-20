import { describe, it, expect, vi, afterEach } from "vitest";
import { getCorsHeaders, isApprovedExtensionRequest } from "./cors";

const EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";

// Duck-typed mock request — satisfies the headers.get() interface used by getCorsHeaders
function mockRequest(opts: {
  origin?: string | null;
  extensionSource?: string | null;
}): any {
  return {
    headers: {
      get: (name: string) => {
        if (name === "origin") return opts.origin ?? null;
        if (name === "x-extension-source") return opts.extensionSource ?? null;
        return null;
      },
    },
  };
}

describe("getCorsHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete process.env.CHROME_EXTENSION_ID;
    delete process.env.CHROME_EXTENSION_IDS;
    delete process.env.ALLOW_LOCALHOST_CORS;
  });

  describe("localhost origins", () => {
    it("allows http://localhost origin outside production", () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost" }),
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost");
    });

    it("allows http://localhost:3000 origin outside production", () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:3000",
      );
    });

    it("allows https://localhost:443 origin outside production", () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "https://localhost:443" }),
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://localhost:443",
      );
    });

    it("rejects localhost in production by default", () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("ALLOW_LOCALHOST_CORS", "false");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
        { allowCredentials: true },
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe("");
      expect(headers["Access-Control-Allow-Credentials"]).toBe("");
    });

    it("allows localhost in production only when explicitly enabled", () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("ALLOW_LOCALHOST_CORS", "true");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
        { allowCredentials: true },
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:3000",
      );
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    });
  });

  describe("chrome extension origins", () => {
    it("allows the configured chrome-extension:// origin", () => {
      process.env.CHROME_EXTENSION_ID = EXTENSION_ID;

      const headers = getCorsHeaders(
        mockRequest({ origin: `chrome-extension://${EXTENSION_ID}` }),
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        `chrome-extension://${EXTENSION_ID}`,
      );
    });

    it("rejects unconfigured chrome-extension:// origins", () => {
      process.env.CHROME_EXTENSION_ID = EXTENSION_ID;

      const headers = getCorsHeaders(
        mockRequest({
          origin: "chrome-extension://badbadbadbadbadbadbadbadbadbadba",
        }),
      );

      expect(headers["Access-Control-Allow-Origin"]).toBe("");
    });

    it("rejects all chrome-extension:// origins when no extension ID is configured", () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: `chrome-extension://${EXTENSION_ID}` }),
      );

      expect(headers["Access-Control-Allow-Origin"]).toBe("");
    });

    it("allows comma-separated configured chrome-extension IDs", () => {
      const secondId = "ponmlkjihgfedcbaponmlkjihgfedcba";
      process.env.CHROME_EXTENSION_IDS = `${EXTENSION_ID},${secondId}`;

      const headers = getCorsHeaders(
        mockRequest({ origin: `chrome-extension://${secondId}` }),
      );

      expect(headers["Access-Control-Allow-Origin"]).toBe(
        `chrome-extension://${secondId}`,
      );
    });

    it("returns empty for null origin with extension source header (no wildcard bypass)", () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: null, extensionSource: "aletheia-extension" }),
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe("");
    });

    it("does not grant CORS for null origin without extension header", () => {
      const headers = getCorsHeaders(mockRequest({ origin: null }));
      expect(headers["Access-Control-Allow-Origin"]).toBe("");
    });
  });

  describe("unknown origins", () => {
    it("returns empty ACAO for an unknown origin", () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: "https://attacker.com" }),
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe("");
    });

    it("returns empty ACAO for a subdomain not in the allow list", () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: "https://sub.example.com" }),
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe("");
    });
  });

  describe("standard headers", () => {
    it("always includes Access-Control-Allow-Methods", () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
      );
      expect(headers["Access-Control-Allow-Methods"]).toBeDefined();
    });

    it('uses default methods "GET, OPTIONS" when not specified', () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
      );
      expect(headers["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
    });

    it("uses provided methods option", () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
        { methods: "POST, GET, OPTIONS" },
      );
      expect(headers["Access-Control-Allow-Methods"]).toBe(
        "POST, GET, OPTIONS",
      );
    });

    it("always includes Access-Control-Allow-Headers with required values", () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
      );
      expect(headers["Access-Control-Allow-Headers"]).toContain(
        "Authorization",
      );
      expect(headers["Access-Control-Allow-Headers"]).toContain("Content-Type");
      expect(headers["Access-Control-Allow-Headers"]).toContain(
        "X-Aletheia-API-Version",
      );
      expect(headers["Access-Control-Allow-Headers"]).toContain(
        "X-Aletheia-Extension-Version",
      );
      expect(headers["Access-Control-Expose-Headers"]).toContain(
        "X-Aletheia-Minimum-Extension-Version",
      );
    });

    it("always includes Vary: Origin header", () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
      );
      expect(headers["Vary"]).toBe("Origin");
    });
  });

  describe("credentials handling", () => {
    it('sets Allow-Credentials to "true" for allowed origin when allowCredentials is true', () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
        { allowCredentials: true },
      );
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    });

    it("does NOT set credentials for unknown origin even when allowCredentials is true", () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: "https://unknown.com" }),
        { allowCredentials: true },
      );
      expect(headers["Access-Control-Allow-Credentials"]).not.toBe("true");
    });

    it("does NOT set credentials for null-origin extension requests", () => {
      const headers = getCorsHeaders(
        mockRequest({ origin: null, extensionSource: "aletheia-extension" }),
        { allowCredentials: true },
      );
      expect(headers["Access-Control-Allow-Credentials"]).not.toBe("true");
    });

    it("does not set credentials when allowCredentials is false (default)", () => {
      vi.stubEnv("NODE_ENV", "test");
      const headers = getCorsHeaders(
        mockRequest({ origin: "http://localhost:3000" }),
      );
      expect(headers["Access-Control-Allow-Credentials"]).not.toBe("true");
    });
  });

  describe("APP_URL environment variable", () => {
    it("allows the configured APP_URL as origin", () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.aletheia.live");
      const headers = getCorsHeaders(
        mockRequest({ origin: "https://www.aletheia.live" }),
      );
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://www.aletheia.live",
      );
    });
  });
});

describe("isApprovedExtensionRequest", () => {
  afterEach(() => {
    delete process.env.CHROME_EXTENSION_ID;
    delete process.env.CHROME_EXTENSION_IDS;
  });

  it("returns true when Origin matches the configured extension origin", () => {
    process.env.CHROME_EXTENSION_ID = EXTENSION_ID;
    const req = mockRequest({ origin: `chrome-extension://${EXTENSION_ID}` });
    expect(isApprovedExtensionRequest(req)).toBe(true);
  });

  it("returns false when Origin is present but not configured", () => {
    process.env.CHROME_EXTENSION_ID = EXTENSION_ID;
    const req = mockRequest({
      origin: "chrome-extension://badbadbadbadbadbadbadbadbadbadba",
    });
    expect(isApprovedExtensionRequest(req)).toBe(false);
  });

  it("returns true when Origin is null and X-Extension-Source is aletheia-extension", () => {
    const req = mockRequest({
      origin: null,
      extensionSource: "aletheia-extension",
    });
    expect(isApprovedExtensionRequest(req)).toBe(true);
  });

  it("returns false when Origin is null and X-Extension-Source is missing", () => {
    const req = mockRequest({ origin: null });
    expect(isApprovedExtensionRequest(req)).toBe(false);
  });

  it("returns false when Origin is null and X-Extension-Source has the wrong value", () => {
    const req = mockRequest({
      origin: null,
      extensionSource: "some-other-source",
    });
    expect(isApprovedExtensionRequest(req)).toBe(false);
  });
});
