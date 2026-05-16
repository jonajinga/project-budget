/* Load the dev server, seed the sample profile into localStorage, and
   screenshot every page (light + dark, 1440 wide). Outputs to
   src/assets/img/screenshots/. */

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = resolve(__dirname, "..", "_sample", "sample.json");
const OUT_DIR = resolve(__dirname, "..", "src", "assets", "img", "screenshots");
const BASE = "http://localhost:8080";

mkdirSync(OUT_DIR, { recursive: true });

const sample = JSON.parse(readFileSync(SAMPLE_PATH, "utf8"));
const profile = sample.profile;

/* Pages to capture. `wait` lets reports finish rendering. */
const pages = [
  { name: "home",                  path: "/",                                wait: 500 },
  { name: "docs",                  path: "/docs/",                           wait: 200 },
  { name: "open-source",           path: "/open-source/",                    wait: 200 },
  { name: "dashboard",             path: "/app/",                            wait: 600 },
  { name: "budget",                path: "/app/budget/",                     wait: 600 },
  { name: "register",              path: "/app/register/",                   wait: 600 },
  { name: "accounts",              path: "/app/accounts/",                   wait: 400 },
  { name: "categories",            path: "/app/categories/",                 wait: 400 },
  { name: "scheduled",             path: "/app/scheduled/",                  wait: 400 },
  { name: "profiles",              path: "/app/profiles/",                   wait: 400 },
  { name: "import",                path: "/app/import/",                     wait: 300 },
  { name: "export",                path: "/app/export/",                     wait: 300 },
  { name: "settings",              path: "/app/settings/",                   wait: 400 },
  { name: "reports",               path: "/app/reports/",                    wait: 300 },
  { name: "report-income-expense", path: "/app/reports/income-expense/",     wait: 1200 },
  { name: "report-net-worth",      path: "/app/reports/net-worth/",          wait: 1200 },
  { name: "report-spending",       path: "/app/reports/spending/",           wait: 1200 },
  { name: "report-trends",         path: "/app/reports/trends/",             wait: 1200 },
  { name: "report-debt",           path: "/app/reports/debt/",               wait: 1200 },
  { name: "report-assignment",     path: "/app/reports/assignment-history/", wait: 1200 },
  { name: "report-projection",     path: "/app/reports/projection/",         wait: 1200 },
];

async function capture(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  /* Seed the profile + theme directly so screenshots are deterministic.
     We mark the profile with settings.isSample so the sample banner
     renders alongside the populated data. */
  await context.addInitScript(({ profile, theme }) => {
    const prefix = "projectbudget:";
    const seeded = JSON.parse(JSON.stringify(profile));
    seeded.settings = seeded.settings || {};
    seeded.settings.isSample = true;
    localStorage.setItem(prefix + "profile:" + seeded.id, JSON.stringify(seeded));
    localStorage.setItem(prefix + "profiles", JSON.stringify([{
      id: seeded.id, name: seeded.name, lastOpenedAt: seeded.updatedAt, schemaVersion: seeded.schemaVersion,
    }]));
    localStorage.setItem(prefix + "active", seeded.id);
    localStorage.setItem("projectbudget-theme", theme);
    /* Stop the in-app auto-load from racing. */
    localStorage.setItem("projectbudget:sample-loaded", "1");
  }, { profile, theme });

  for (const p of pages) {
    const url = BASE + p.path;
    process.stdout.write(`  ${theme.padEnd(5)} ${p.path.padEnd(40)} `);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(p.wait);
      const outFile = resolve(OUT_DIR, `${p.name}-${theme}.png`);
      await page.screenshot({ path: outFile, fullPage: true, type: "png" });
      console.log("OK -> " + outFile.replace(__dirname + "\\..\\", ""));
    } catch (e) {
      console.log("FAIL " + e.message);
    }
  }

  await browser.close();
}

console.log("Capturing light theme...");
await capture("light");
console.log("\nCapturing dark theme...");
await capture("dark");
console.log("\nDone. " + (pages.length * 2) + " screenshots in " + OUT_DIR);
