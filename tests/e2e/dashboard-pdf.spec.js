import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* "Export as PDF" must produce a PDF.
 *
 * The first version called window.print() and called itself PDF export. This
 * asserts the two things that distinguishes a real one: bytes that begin with
 * %PDF, and that the browser's print dialog was never involved.
 */
test("exporting produces a real PDF file and never opens the print dialog", async ({ seeded }) => {
  test.setTimeout(90000);
  const page = await seeded.newPage();

  /* If anything reaches for print, fail loudly rather than silently passing
     because a dialog was suppressed by the harness. */
  await page.addInitScript(() => {
    window.__printed = 0;
    window.print = () => { window.__printed++; };
  });

  await gotoApp(page, "/app/");
  await page.waitForFunction(
    () => { const s = window.Alpine?.store?.("budget"); return s ? s.loading === false : false; },
    { timeout: 10000 }
  ).catch(() => {});
  /* Let the charts mount - a chart widget contributes a captured image, and
     capturing nothing is a legitimate but weaker document. */
  await page.waitForTimeout(2500);

  const downloadPromise = page.waitForEvent("download", { timeout: 60000 });

  /* Kebab now lives in the shared .app-toolbar strip -- see the note
     in dashboard-chrome.spec.js. */
  await page.locator(".app-toolbar .overflow-menu__trigger").first().click();
  await page.getByRole("menuitem", { name: /Export as PDF/ }).click();

  const download = await downloadPromise;
  const path = await download.path();
  expect(path, "no file was produced").toBeTruthy();

  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 4).toString("latin1"), "not a PDF").toBe("%PDF");
  expect(bytes.length, "a PDF of a 13-widget dashboard should not be trivial").toBeGreaterThan(10000);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  expect(await page.evaluate(() => window.__printed), "the print dialog was used").toBe(0);
});
