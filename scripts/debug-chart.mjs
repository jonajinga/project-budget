/* Log everything to find where the mirror chain breaks. */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(__dirname, "..", "_sample", "sample.json"), "utf8"));
const profile = sample.profile;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
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
page.on("console", msg => console.log("BROWSER " + msg.type() + ":", msg.text()));
page.on("pageerror", e => console.log("PAGEERR", e.message));
await page.goto("http://localhost:8080/app/settings/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const probe = await page.evaluate(async () => {
  const store = window.Alpine.store("budget");
  /* Direct call to the mirror to bypass the takeSnapshot wrapper */
  console.log("Before takeSnapshot, storageBackend:", store.storageBackend);
  const rec = store.takeSnapshot("probe-test");
  console.log("After takeSnapshot, rec:", JSON.stringify({ id: rec?.id?.slice(0, 8), label: rec?.label }));
  /* Wait for any pending micro-task / promise */
  await new Promise(r => setTimeout(r, 1500));
  /* Read back from Dexie directly */
  const db = new window.Dexie("ProjectBudget");
  db.version(1).stores({
    profiles: "id, name, updatedAt",
    snapshots: "[profileId+id], profileId, createdAt",
    backups: "[profileId+day], profileId, day",
    trash: "id, deletedAt",
    meta: "id",
  });
  await db.open();
  const all = await db.snapshots.toArray();
  db.close();
  return { snapshotCount: all.length, labels: all.map(s => s.label) };
});
console.log("PROBE:", JSON.stringify(probe));

await browser.close();
