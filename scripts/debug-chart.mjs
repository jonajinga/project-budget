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
  const seeded = JSON.parse(JSON.stringify(profile));
  seeded.settings = seeded.settings || {}; seeded.settings.isSample = true;
  localStorage.setItem("projectbudget:profile:" + seeded.id, JSON.stringify(seeded));
  localStorage.setItem("projectbudget:profiles", JSON.stringify([{ id: seeded.id, name: seeded.name, lastOpenedAt: seeded.updatedAt, schemaVersion: seeded.schemaVersion }]));
  localStorage.setItem("projectbudget:active", seeded.id);
  localStorage.setItem("projectbudget-theme", "light");
  localStorage.setItem("projectbudget:sample-loaded", "1");
}, { profile });
const page = await context.newPage();
page.on("pageerror", e => console.log("PAGEERR", e.message));
await page.goto("http://localhost:8080/app/register/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

console.log("--- Fuse available ---");
const fuse = await page.evaluate(() => typeof window.Fuse);
console.log("typeof window.Fuse:", fuse);

const totalRows = await page.locator("tbody tr").count();
console.log("Total rows initially:", totalRows);

console.log("\n--- Search for 'wf' (should match 'Whole Foods' via fuzzy) ---");
await page.fill(".register__toolbar input[type=search]","wf");
await page.waitForTimeout(400);
const wf = await page.locator("tbody tr").count();
console.log("Rows after 'wf':", wf);

console.log("\n--- Search for 'rentl' (typo for 'rent') ---");
await page.fill(".register__toolbar input[type=search]","rentl");
await page.waitForTimeout(400);
const rentl = await page.locator("tbody tr").count();
console.log("Rows after 'rentl':", rentl);

console.log("\n--- Search for 'groceries' (category match) ---");
await page.fill(".register__toolbar input[type=search]","groceries");
await page.waitForTimeout(400);
const groc = await page.locator("tbody tr").count();
console.log("Rows after 'groceries':", groc);

await browser.close();
