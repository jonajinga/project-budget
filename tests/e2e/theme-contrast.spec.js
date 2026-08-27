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

  /* 26 iterations with no output between them is opaque when it goes wrong:
     a sweep that stalls looks identical to one that is merely slow, and this
     one went from 40s to 15+ minutes without a single line to say where. One
     line per iteration costs nothing and makes the next stall diagnosable. */
  for (const surface of SURFACES) {
    for (const theme of THEMES) {
      const t0 = Date.now();
      const page = await seeded.newPage();
      await page.addInitScript((t) => {
        try { localStorage.setItem("projectbudget-theme", t); } catch (_e) {}
      }, theme);
      const tGoto = Date.now();
      await gotoApp(page, surface);
      const gotoMs = Date.now() - tGoto;
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      await page.waitForTimeout(150);

      const tAxe = Date.now();
      const res = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();
      const axeMs = Date.now() - tAxe;
      const n = res.violations.reduce((a, v) => a + v.nodes.length, 0);
      (report[surface] ||= {})[theme] = n;
      await page.close();
      console.log(
        `  ${surface} ${theme.padEnd(16)} goto ${String(gotoMs + "ms").padEnd(8)}` +
        ` axe ${String(axeMs + "ms").padEnd(8)} total ${Date.now() - t0}ms`
      );
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
