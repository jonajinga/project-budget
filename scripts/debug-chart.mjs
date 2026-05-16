import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = resolve(__dirname, "..", "_sample", "sample.json");
const sample = JSON.parse(readFileSync(SAMPLE_PATH, "utf8"));
const profile = sample.profile;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(({ profile }) => {
  const prefix = "projectbudget:";
  localStorage.setItem(prefix + "profile:" + profile.id, JSON.stringify(profile));
  localStorage.setItem(prefix + "profiles", JSON.stringify([{ id: profile.id, name: profile.name, lastOpenedAt: profile.updatedAt, schemaVersion: profile.schemaVersion }]));
  localStorage.setItem(prefix + "active", profile.id);
  localStorage.setItem("projectbudget-theme", "light");
}, { profile });
const page = await context.newPage();
page.on("console", msg => console.log("BROWSER", msg.type(), msg.text()));
page.on("pageerror", err => console.log("PAGEERR", err.message));
await page.goto("http://localhost:8080/app/reports/income-expense/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const inspect = await page.evaluate(() => {
  return {
    hasD3: typeof window.d3,
    hasAlpine: typeof window.Alpine,
    hasStore: !!(window.Alpine && window.Alpine.store && window.Alpine.store("budget")),
    profileName: window.Alpine && window.Alpine.store && window.Alpine.store("budget") && window.Alpine.store("budget").profile && window.Alpine.store("budget").profile.name,
    chartHTML: (document.querySelector("#chart-ie") || {}).innerHTML || "(missing)",
    chartChildren: (document.querySelector("#chart-ie") || {}).children?.length ?? -1,
    seenScripts: [...document.scripts].map(s => s.src || "(inline " + s.type + ")")
  };
});
console.log("INSPECT", JSON.stringify(inspect, null, 2));
await browser.close();
