import { defineConfig } from "vitest/config";

// Unit tests only. The Playwright specs under e2e/ run via their own config
// (npx playwright test --config e2e/playwright.config.ts) and must not be
// picked up by Vitest.
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    environment: "node",
  },
});
