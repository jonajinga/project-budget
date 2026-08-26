/* The single-shell router.
 *
 * The whole point of this change is that moving between screens stops
 * rebuilding the app. So the assertions here are not "the right content
 * appeared" -- a full page load does that too, which is exactly the failure
 * that would go unnoticed. They are:
 *
 *   1. the document was never replaced (a stamp on window survives), and
 *   2. the Alpine store is the SAME object, not a fresh one with the same
 *      contents.
 *
 * Both are invisible in a screenshot and both are the actual deliverable.
 */

import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* Match on pathname, never on the whole URL. budget-view.js:269 and
   calendar-view.js:208 write their filter state into the query string with
   history.replaceState, so /app/budget/ becomes /app/budget/?m=2026-08 a beat
   after arrival, and a glob over the full URL stops matching. */
const atPath = (p) => (url) => new URL(url).pathname === p;

/* Below 1024px the sidebar is a closed drawer, so its links are not
   clickable until it is opened. Without this the mobile project timed out on
   every test that navigates by clicking nav -- 30s each, for a UI that was
   working fine. open-sidebar is a no-op where the sidebar is already a
   visible column, so one helper covers both viewports. */
async function clickNav(page, name) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("open-sidebar")));
  await page.getByRole("link", { name, exact: true }).first().click();
}

/* Marks the live document and the live store. If either is missing after a
   navigation, the page was thrown away and rebuilt -- the old behaviour. */
async function stamp(page) {
  await page.evaluate(() => {
    window.__pbDocStamp = "alive-" + Math.random().toString(36).slice(2);
    const s = window.Alpine.store("budget");
    s.__pbStoreStamp = window.__pbDocStamp;
    return window.__pbDocStamp;
  });
  return page.evaluate(() => window.__pbDocStamp);
}

async function readStamps(page) {
  return page.evaluate(() => ({
    doc: window.__pbDocStamp || null,
    store: (window.Alpine.store("budget") || {}).__pbStoreStamp || null,
  }));
}

test.describe("router: navigation keeps the document and the store", () => {
  test("clicking a nav link swaps the view without reloading", async ({ seeded }) => {
    const page = await seeded.newPage();
    await gotoApp(page, "/app/budget/");
    const before = await stamp(page);

    await clickNav(page, "Register");
    await page.waitForURL(atPath("/app/register/"));
    /* .first(): the register view root and its inner <section class="register">
       both match, and a two-element locator is a strict-mode violation, not a
       pass. Anchor on the view root only. */
    await expect(page.locator("#app-view [x-data*='registerView']").first()).toBeVisible({ timeout: 6000 });

    const after = await readStamps(page);
    expect(after.doc, "document was replaced -- this was a full page load").toBe(before);
    expect(after.store, "the store was rebuilt rather than reused").toBe(before);
  });

  test("the store is not re-initialised between screens", async ({ seeded }) => {
    const page = await seeded.newPage();
    await gotoApp(page, "/app/");
    await stamp(page);

    for (const name of ["Budget", "Calendar", "Register"]) {
      await clickNav(page, name);
      await page.waitForTimeout(400);
    }

    const after = await readStamps(page);
    expect(after.store, "store lost across three navigations").not.toBeNull();
    expect(after.doc).toBe(after.store);
  });

  test("back and forward work and still do not reload", async ({ seeded }) => {
    const page = await seeded.newPage();
    await gotoApp(page, "/app/budget/");
    const before = await stamp(page);

    await clickNav(page, "Calendar");
    await page.waitForURL(atPath("/app/calendar/"));

    await page.goBack();
    await page.waitForURL(atPath("/app/budget/"));
    expect((await readStamps(page)).doc, "back button triggered a real reload").toBe(before);

    await page.goForward();
    await page.waitForURL(atPath("/app/calendar/"));
    expect((await readStamps(page)).doc, "forward button triggered a real reload").toBe(before);
  });

  test("a route with an inline Alpine factory still binds after the swap", async ({ seeded }) => {
    /* 34 of the 43 fragments carry their factory in an inline <script>.
       innerHTML does not execute those, so the router re-creates them. If
       that ever regresses, x-data stays unbound and the view renders as
       inert markup -- which looks fine in a screenshot. */
    const page = await seeded.newPage();
    await gotoApp(page, "/app/budget/");
    await clickNav(page, "Payees");
    await page.waitForURL(atPath("/app/payees/"));

    const bound = await page.waitForFunction(() => {
      const el = document.querySelector("#app-view [x-data]");
      return !!(el && window.Alpine && window.Alpine.$data && window.Alpine.$data(el));
    }, { timeout: 6000 }).catch(() => null);

    expect(bound, "inline factory never bound after the fragment swap").not.toBeNull();
  });

  test("deep-linking straight to a route still server-renders it", async ({ seeded }) => {
    /* First paint must not wait on a fetch, and the app has to work with the
       router absent entirely. */
    const page = await seeded.newPage();
    await gotoApp(page, "/app/calendar/");
    await expect(page.locator("#app-view")).not.toBeEmpty();
  });

  test("an external or non-app link is left alone", async ({ seeded }) => {
    const page = await seeded.newPage();
    await gotoApp(page, "/app/");
    const hijacked = await page.evaluate(() => {
      const a = document.createElement("a");
      a.href = "https://example.com/";
      document.body.appendChild(a);
      let prevented = false;
      a.addEventListener("click", (e) => { prevented = e.defaultPrevented; e.preventDefault(); });
      a.click();
      a.remove();
      return prevented;
    });
    expect(hijacked, "the router intercepted an off-site link").toBe(false);
  });
});
