/* Visit every page at multiple viewports, screenshot full-page, and flag
   any horizontal scroll, JS console errors, or page errors.

   Outputs:
     - _audit/<viewport>/<page>.png  (full-page screenshot)
     - _audit/report.json            (structured findings)
     - stdout summary table */

import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = resolve(__dirname, "..", "_sample", "sample.json");
const OUT_DIR = resolve(__dirname, "..", "_audit");
const BASE = "http://localhost:8080";

mkdirSync(OUT_DIR, { recursive: true });
const sample = JSON.parse(readFileSync(SAMPLE_PATH, "utf8"));
const profile = sample.profile;

const viewports = [
  { name: "360",  w: 360,  h: 800,  label: "iPhone SE / small Android" },
  { name: "414",  w: 414,  h: 896,  label: "iPhone 11 / standard phone" },
  { name: "768",  w: 768,  h: 1024, label: "iPad portrait" },
  { name: "1024", w: 1024, h: 768,  label: "iPad landscape / small laptop" },
  { name: "1280", w: 1280, h: 800,  label: "Standard desktop" },
];

const pages = [
  { name: "home",                 path: "/",                                 wait: 400 },
  { name: "docs-hub",             path: "/docs/",                            wait: 200 },
  { name: "docs-page",            path: "/docs/getting-started/",            wait: 400 },
  { name: "blog",                 path: "/blog/",                            wait: 200 },
  { name: "blog-post",            path: "/blog/hello-project-budget/",       wait: 200 },
  { name: "accessibility",        path: "/accessibility/",                   wait: 200 },
  { name: "sitemap",              path: "/sitemap/",                         wait: 200 },
  { name: "glossary",             path: "/glossary/",                        wait: 200 },
  { name: "open-source",          path: "/open-source/",                     wait: 200 },
  { name: "dashboard",            path: "/app/",                             wait: 600 },
  { name: "budget",               path: "/app/budget/",                      wait: 600 },
  { name: "register",             path: "/app/register/",                    wait: 700 },
  { name: "accounts",             path: "/app/accounts/",                    wait: 500 },
  { name: "categories",           path: "/app/categories/",                  wait: 400 },
  { name: "scheduled",            path: "/app/scheduled/",                   wait: 300 },
  { name: "profiles",             path: "/app/profiles/",                    wait: 300 },
  { name: "import",               path: "/app/import/",                      wait: 300 },
  { name: "export",               path: "/app/export/",                      wait: 300 },
  { name: "settings",             path: "/app/settings/",                    wait: 400 },
  { name: "reports",              path: "/app/reports/",                     wait: 300 },
  { name: "report-spending",      path: "/app/reports/spending/",            wait: 1100 },
  { name: "report-net-worth",     path: "/app/reports/net-worth/",           wait: 1100 },
  { name: "report-projection",    path: "/app/reports/projection/",          wait: 1100 },
];

const findings = [];

const browser = await chromium.launch({ headless: true });
for (const vp of viewports) {
  process.stdout.write("\n=== " + vp.name + "x" + vp.h + " (" + vp.label + ") ===\n");
  const vpDir = resolve(OUT_DIR, vp.name);
  mkdirSync(vpDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  await context.addInitScript(({ profile }) => {
    const prefix = "projectbudget:";
    const seeded = JSON.parse(JSON.stringify(profile));
    seeded.settings = seeded.settings || {};
    seeded.settings.isSample = true;
    localStorage.setItem(prefix + "profile:" + seeded.id, JSON.stringify(seeded));
    localStorage.setItem(prefix + "profiles", JSON.stringify([{ id: seeded.id, name: seeded.name, lastOpenedAt: seeded.updatedAt, schemaVersion: seeded.schemaVersion }]));
    localStorage.setItem(prefix + "active", seeded.id);
    localStorage.setItem("projectbudget-theme", "light");
    localStorage.setItem("projectbudget:sample-loaded", "1");
  }, { profile });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", err => consoleErrors.push("[pageerror] " + err.message));

  for (const p of pages) {
    const url = BASE + p.path;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(p.wait);
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
        const clientWidth = doc.clientWidth;
        const horizontalScroll = scrollWidth > clientWidth + 1;
        /* Count interactive elements smaller than 44x44 (excluding opt-outs). */
        const all = document.querySelectorAll("button, a, input, select, textarea");
        let smallTargets = 0;
        all.forEach(el => {
          if (el.matches("[data-touch='compact']") || el.closest("[data-touch='compact']")) return;
          if (el.type === "hidden" || el.disabled) return;
          if (el.offsetParent === null) return; /* hidden */
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.width < 44 || r.height < 44) smallTargets++;
        });
        return { scrollWidth, clientWidth, horizontalScroll, smallTargets };
      });
      const outFile = resolve(vpDir, p.name + ".png");
      await page.screenshot({ path: outFile, fullPage: true, type: "png" });
      const flag = [];
      if (metrics.horizontalScroll) flag.push("HSCROLL(+" + (metrics.scrollWidth - metrics.clientWidth) + "px)");
      if (metrics.smallTargets > 0) flag.push("SMALL-TARGETS:" + metrics.smallTargets);
      if (consoleErrors.length) flag.push("JS-ERRORS:" + consoleErrors.length);
      const status = flag.length ? flag.join(" ") : "OK";
      console.log("  " + p.path.padEnd(40) + " " + status);
      findings.push({ viewport: vp.name, path: p.path, ...metrics, consoleErrors: consoleErrors.slice() });
      consoleErrors.length = 0;
    } catch (e) {
      console.log("  " + p.path.padEnd(40) + " FAIL " + e.message);
      findings.push({ viewport: vp.name, path: p.path, error: e.message });
    }
  }
  await context.close();
}
await browser.close();

writeFileSync(resolve(OUT_DIR, "report.json"), JSON.stringify(findings, null, 2));

console.log("\n\n=== Summary ===");
const issues = findings.filter(f => f.horizontalScroll || f.smallTargets > 0 || (f.consoleErrors && f.consoleErrors.length) || f.error);
if (!issues.length) {
  console.log("No layout/console issues at any viewport.");
} else {
  console.log("Total flagged: " + issues.length);
  const byVp = {};
  issues.forEach(i => { byVp[i.viewport] = (byVp[i.viewport] || 0) + 1; });
  Object.keys(byVp).forEach(vp => console.log("  " + vp + ": " + byVp[vp]));
}
console.log("\nFull report -> _audit/report.json");
console.log("Screenshots -> _audit/<viewport>/<page>.png");
