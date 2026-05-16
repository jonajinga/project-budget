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
const errs = [];
page.on("console", msg => { if (msg.type() === "error") errs.push("console: " + msg.text()); });
page.on("pageerror", err => errs.push("pageerror: " + err.message + "\n" + (err.stack || "").split("\n").slice(0, 4).join("\n")));

for (const path of ["/app/accounts/", "/app/categories/"]) {
  errs.length = 0;
  await page.goto("http://localhost:8080" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  console.log("\n=== " + path + " ===");
  if (errs.length === 0) console.log("(no errors)");
  else errs.forEach(e => console.log(e));
}

await browser.close();
