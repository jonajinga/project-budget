/* Verify manual-snapshot UI updates without a page refresh, and that
   PapaParse is now loaded in the app layout. */

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(__dirname, "..", "_sample", "sample.json"), "utf8"));
const profile = sample.profile;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
page.on("pageerror", e => console.log("PAGEERR", e.message));

await page.goto("http://localhost:8080/app/settings/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

console.log("--- PapaParse load check ---");
const papa = await page.evaluate(() => typeof window.Papa);
console.log("typeof window.Papa:", papa, "(expect 'object')");

console.log("\n--- Snapshot reactivity check ---");
const beforeRowCount = await page.locator("table tbody tr").count();
console.log("Snapshot rows before:", beforeRowCount);

await page.fill("#snap-label", "audit-test");
await page.click("button:has-text('Take snapshot now')");
await page.waitForTimeout(600);

const afterRowCount = await page.locator("table tbody tr").count();
console.log("Snapshot rows after:", afterRowCount);
const labelInTable = await page.locator("table tbody tr:has-text('audit-test')").count();
console.log("Found 'audit-test' label in table:", labelInTable);

await browser.close();
console.log("\nDONE");
