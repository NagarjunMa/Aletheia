import { vi } from "vitest";

// ─── Silence pino logger output across all route handler tests ─────────────────
// Without this, every test run emits structured JSON to stdout.
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    }),
  }),
  createRequestLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  }),
  startTimedStage: () => vi.fn(),
}));

// ─── Required env vars for all route handler tests ────────────────────────────
// Route handlers call process.env at module load time via lazy factories.
// These must be set before any route module is imported.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
