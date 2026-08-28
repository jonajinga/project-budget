/* Per-route accessibility counts, for diffing two builds.
 *
 * The ratchet in tests/e2e/a11y.spec.js aggregates by RULE across every
 * route, which is the right shape for a gate but useless for locating a
 * regression: when it says "color-contrast 108 > budget 105" it then names
 * the routes with the highest totals, not the ones that changed. Those are
 * usually routes that were already failing, so the report points away from
 * the three nodes you are looking for.
 *
 * This writes rule counts per route so two builds can be diffed:
 *
 *   git checkout <before> && npm run build
 *   node scripts/a11y-per-route.mjs --out /tmp/before.json
 *   git checkout <after>  && npm run build
 *   node scripts/a11y-per-route.mjs --out /tmp/after.json
 *   node scripts/a11y-per-route.mjs --diff /tmp/before.json /tmp/after.json
 *
 * Expects a server already running on 8181 (scripts/serve-site.mjs).
 */

import { chromium, devices } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseFile, importAsNew } from "../src/assets/js/io/import-json.js";

const args = process.argv.slice(2);

/* ---- diff mode: no browser needed ---- */
if (args[0] === "--diff") {
  const before = JSON.parse(readFileSync(args[1], "utf8"));
  const after = JSON.parse(readFileSync(args[2], "utf8"));
  const routes = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  let any = false;
  for (const route of routes) {
    const b = before[route] || {};
    const a = after[route] || {};
    const rules = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
    for (const rule of rules) {
      const delta = (a[rule] || 0) - (b[rule] || 0);
      if (delta === 0) continue;
      any = true;
      const sign = delta > 0 ? "+" : "";
      console.log(`  ${delta > 0 ? "WORSE" : "better"}  ${route}  ${rule}: ${b[rule] || 0} -> ${a[rule] || 0}  (${sign}${delta})`);
    }
  }
  if (!any) console.log("  no per-route change");
  process.exit(0);
}

/* ---- measure mode ---- */
const outPath = args[args.indexOf("--out") + 1];
const project = args.includes("--desktop") ? "desktop" : "mobile";

const SITE = "_site";
function appRoutes() {
  const out = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "_views") continue;
        walk(full);
      } else if (entry.name === "index.html") {
        const rel = relative(SITE, dir).split(sep).join("/");
        out.push(rel ? `/${rel}/` : "/");
      }
    }
  })(join(SITE, "app"));
  return out.sort();
}

const sample = JSON.parse(readFileSync("./src/assets/sample/sample.json", "utf8"));
const parsed = parseFile(JSON.stringify(sample));
const profile = importAsNew(parsed, { name: "Sample household" });
const entry = { id: profile.id, name: profile.name, lastOpenedAt: profile.updatedAt, schemaVersion: profile.schemaVersion };

const browser = await chromium.launch();
const ctx = await browser.newContext(
  project === "mobile"
    ? { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }
    : { viewport: { width: 1280, height: 800 } }
);
await ctx.addInitScript(([p, pk, e, id]) => {
  try {
    localStorage.setItem("projectbudget:profiles", JSON.stringify([e]));
    localStorage.setItem(pk, p);
    localStorage.setItem("projectbudget:active", id);
    localStorage.setItem("projectbudget:sample-loaded-v2", "1");
  } catch (_e) {}
}, [JSON.stringify(profile), "projectbudget:profile:" + profile.id, entry, profile.id]);

const page = await ctx.newPage();
const report = {};
const routes = appRoutes();

for (const route of routes) {
  try {
    await page.goto("http://localhost:8181" + route, { waitUntil: "domcontentloaded", timeout: 20000 });
    /* Wait for the store the way tests/e2e/helpers.js does. A flat timeout
       measures a half-rendered page and UNDERCOUNTS: an earlier version of
       this script reported "no per-route change" while the gate was reading
       141, because most of the app had not rendered yet when axe ran. A
       measuring tool that quietly reads low is worse than no tool. */
    await page
      .waitForFunction(
        () => window.Alpine && window.Alpine.store && window.Alpine.store("budget"),
        { timeout: 5000 }
      )
      .catch(() => {});
    await page
      .waitForFunction(
        () => {
          const s = window.Alpine?.store?.("budget");
          return s ? s.loading === false : false;
        },
        { timeout: 6000 }
      )
      .catch(() => {});
    await page.waitForTimeout(250);
    const res = await new AxeBuilder({ page }).analyze();
    const counts = {};
    for (const v of res.violations) counts[v.id] = (counts[v.id] || 0) + v.nodes.length;
    report[route] = counts;
  } catch (e) {
    report[route] = { __error: String(e.message).slice(0, 80) };
  }
}

writeFileSync(outPath, JSON.stringify(report, null, 1));
console.log(`  ${routes.length} routes measured (${project}) -> ${outPath}`);
await browser.close();
