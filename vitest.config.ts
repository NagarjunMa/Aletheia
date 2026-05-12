import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["__tests__/setup.ts"],
    include: ["**/*.test.ts", "**/*.spec.ts"],
    exclude: [
      "**/*.guardrails.test.ts",
      "node_modules/**",
      ".next/**",
      "__tests__/helpers/**",
      "e2e/**",
      "ascendia-extension/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: [
        "lib/database/types.ts",
        "**/*.d.ts",
        "node_modules/**",
        "lib/supabase/client.ts", // thin SDK wrapper — no logic
        "lib/supabase/server.ts", // SSR cookie wiring — no business logic
        "__tests__/**",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
