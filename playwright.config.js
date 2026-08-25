import { defineConfig, devices } from "@playwright/test";

/* Chromium only on day one. WebKit joins in Phase 3, where the calendar
   touch-drag test needs it -- that is the one place browser emulation
   genuinely lies about behaviour. */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://localhost:8181",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      /* 390x844 = iPhone 14/15. The touch-target census and every mobile
         assertion run here. */
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
      testIgnore: /\.desktop\.spec\.js$/,
    },
    {
      /* WebKit, touch-enabled. Added for the calendar drag: HTML5
         drag-and-drop silently does not fire on iOS Safari, which is exactly
         the failure this suite exists to catch, and Chromium-based emulation
         will happily report success where the real browser does nothing.
         Scoped to the touch specs so the full suite does not triple in cost. */
      name: "webkit-touch",
      use: { ...devices["iPhone 13"] },
      testMatch: /(calendar-drag|drawers)\.spec\.js$/,
    },
  ],
  webServer: {
    command: "node scripts/serve-site.mjs",
    url: "http://localhost:8181/app/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
