import { chromium } from "playwright";

/* Test the real first-visit auto-load. NO localStorage seed — we want
   to verify the in-app fetch + import path works end-to-end. */

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("console", msg => console.log("BROWSER", msg.type(), msg.text()));
page.on("pageerror", err => console.log("PAGEERR", err.message));
await page.goto("http://localhost:8080/app/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);  /* allow fetch + import + boot */
const inspect = await page.evaluate(() => {
  const store = window.Alpine && window.Alpine.store && window.Alpine.store("budget");
  return {
    hasStore: !!store,
    profileName: store && store.profile && store.profile.name,
    isSample: store && store.profile && store.profile.settings && store.profile.settings.isSample,
    accountCount: store && store.profile && store.profile.accounts.length,
    txnCount: store && store.profile && store.profile.transactions.length,
    bannerVisible: !!document.querySelector(".sample-banner [x-show]:not([style*='display: none'])"),
    storageKeys: Object.keys(localStorage).filter(k => k.startsWith("projectbudget")),
    sampleLoadedFlag: localStorage.getItem("projectbudget:sample-loaded"),
  };
});
console.log("INSPECT", JSON.stringify(inspect, null, 2));
await browser.close();
