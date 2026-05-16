/* Verify the new header: hamburger persistent on all devices, profile
   centered in app header, no duplicate wordmark on marketing. */

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(readFileSync(resolve(__dirname, "..", "_sample", "sample.json"), "utf8"));
const profile = sample.profile;
const OUT = resolve(__dirname, "..", "_audit");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const vp of [{ name: "360", w: 360, h: 800 }, { name: "1280", w: 1280, h: 800 }]) {
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
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

  /* Marketing — only single wordmark, hamburger visible only on mobile */
  await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const marketingState = await page.evaluate(() => ({
    brandText: document.querySelector(".brand__mark")?.textContent.trim(),
    hamburgerVisible: !!document.querySelector(".site-header__hamburger:not([hidden])") && getComputedStyle(document.querySelector(".site-header__hamburger")).display !== "none",
    navVisible: getComputedStyle(document.querySelector(".site-nav")).display !== "none",
  }));
  await page.screenshot({ path: resolve(OUT, `header-mkt-${vp.name}.png`), clip: { x: 0, y: 0, width: vp.w, height: 80 } });

  /* App — hamburger + centered profile + theme toggle */
  await page.goto("http://localhost:8080/app/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const appState = await page.evaluate(() => {
    const h = document.querySelector(".site-header--app .site-header__hamburger");
    const t = document.querySelector(".app-sidebar-toggle");
    return {
      hamburgerVisible: !!h && getComputedStyle(h).display !== "none",
      profileText: document.querySelector(".site-header__profile-name")?.textContent.trim(),
      floatingToggle: t ? "present" : "removed",
    };
  });
  await page.screenshot({ path: resolve(OUT, `header-app-${vp.name}.png`), clip: { x: 0, y: 0, width: vp.w, height: 80 } });

  /* Click hamburger, screenshot the open menu */
  await page.click(".site-header--app .site-header__hamburger");
  await page.waitForTimeout(400);
  const menuOpen = await page.evaluate(() => document.querySelector(".site-menu.is-open") !== null);
  await page.screenshot({ path: resolve(OUT, `menu-open-${vp.name}.png`), clip: { x: 0, y: 0, width: Math.min(vp.w, 360), height: Math.min(vp.h, 700) } });

  console.log(`\n--- ${vp.name}px ---`);
  console.log("Marketing brand:", marketingState.brandText, "hamburger:", marketingState.hamburgerVisible, "nav:", marketingState.navVisible);
  console.log("App hamburger visible:", appState.hamburgerVisible, "profile:", appState.profileText, "floating-toggle:", appState.sidebarFloatingToggleVisible);
  console.log("Menu open after click:", menuOpen);

  await context.close();
}

await browser.close();
console.log("\nDone — screenshots in _audit/header-*.png and _audit/menu-open-*.png");
