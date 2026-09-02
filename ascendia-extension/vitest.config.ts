import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.ts", "**/*.test.js"],
    exclude: ["node_modules/**", "dist/**"],
  },
  resolve: {
    alias: { "@ext": path.resolve(__dirname, ".") },
  },
});
