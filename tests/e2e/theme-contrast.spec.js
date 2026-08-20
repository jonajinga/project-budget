import { test } from "./fixtures.js";
import { gotoApp } from "./helpers.js";
import AxeBuilder from "@axe-core/playwright";

/* The 13 themes from main.js:19-33. Five define a LIGHT accent
   (dracula, nord, one-dark, catppuccin, rose-pine) -- those are where the ~26
   hardcoded `color: #fff` declarations on accent backgrounds go unreadable.
   This sweep is what proves the Phase 4d fix. */
const THEMES = [
  "light", "dark", "paper", "ink", "solarized-light", "solarized-dark",
  "dracula", "nord", "gruvbox-dark", "one-dark", "tokyo-night",
  "catppuccin", "rose-pine",
];

/* /style-guide/ exists and renders every component variant in one place --
   a purpose-built fixture that was sitting unused. /app/budget/ adds the
   dense real-world surface the style guide does not cover. */
const SURFACES = ["/style-guide/", "/app/budget/"];

test("contrast sweep across all 13 themes", async ({ seeded }) => {
  test.setTimeout(600_000);
  const report = {};

  for (const surface of SURFACES) {
    for (const theme of THEMES) {
      const page = await seeded.newPage();
      await page.addInitScript((t) => {
        try { localStorage.setItem("projectbudget-theme", t); } catch (_e) {}
      }, theme);
      await gotoApp(page, surface);
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      await page.waitForTimeout(150);

      const res = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();
      const n = res.violations.reduce((a, v) => a + v.nodes.length, 0);
      (report[surface] ||= {})[theme] = n;
      await page.close();
    }
  }

  console.log("\ncolor-contrast violations by theme (report-only):");
  for (const [surface, byTheme] of Object.entries(report)) {
    console.log(`  ${surface}`);
    for (const [theme, n] of Object.entries(byTheme).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${n === 0 ? "  ok" : String(n).padStart(4)}  ${theme}`);
    }
  }
});
