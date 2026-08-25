import { defineConfig } from "vitest/config";

// There was no vitest config at all, so Vitest used its default include
// pattern -- which swallows the Playwright suite in tests/e2e. Those files
// import @playwright/test and hang the run, and CI runs `npm test` before the
// browser suite, so it would hang there too.
//
// Unit tests are tests/*.test.js; browser tests are tests/e2e/*.spec.js.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    exclude: ["tests/e2e/**", "node_modules/**", "_site/**"],
    environment: "node",
  },
});
