/* Every /app/ route, driven through the router in one long-lived document.
 *
 * router.spec.js proves the mechanism on a handful of screens. This proves it
 * on all of them, in a single session, in sequence -- which is the thing that
 * actually breaks. A view that leaks a Chart.js canvas, or registers a
 * document-level listener it never removes, or throws in init() after the
 * fragment is already on screen, will look perfectly fine when it is the only
 * route you visit and fail on the fourth hop.
 *
 * Three assertions per route, all of which a screenshot would pass:
 *   - the document was never replaced (the router did not silently fall back
 *     to a full page load, which would hide every problem below it)
 *   - nothing threw
 *   - the view mounted and Alpine bound it
 */

import { test, expect } from "./fixtures.js";
import { appOnlyRoutes } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* Routes that deliberately leave the shell. /app/welcome/ and /app/export/
   redirect, so "the document survived" is the wrong assertion for them. */
const LEAVES_THE_SHELL = new Set(["/app/welcome/", "/app/export/"]);

test.describe("router: every app route", () => {
  test("survives a single session, in sequence", async ({ seeded }) => {
    const routes = appOnlyRoutes().filter((r) => !LEAVES_THE_SHELL.has(r));
    expect(routes.length, "expected the built site to have app routes").toBeGreaterThan(30);

    const page = await seeded.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push({ where: page.url(), message: e.message }));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      errors.push({ where: page.url(), message: "console: " + m.text() });
    });

    await gotoApp(page, "/app/");
    await page.evaluate(() => { window.__pbSession = "one-document"; });

    const failures = [];

    for (const route of routes) {
      const before = errors.length;

      const ok = await page.evaluate((r) => window.pbRouter.navigate(r), route).catch(() => false);
      await page.waitForTimeout(250);

      const state = await page.evaluate(() => ({
        session: window.__pbSession || null,
        path: location.pathname,
        mounted: !!document.querySelector("#app-view [x-data]"),
        bound: (() => {
          const el = document.querySelector("#app-view [x-data]");
          try { return !!(el && window.Alpine.$data(el)); } catch (_e) { return false; }
        })(),
        empty: (document.getElementById("app-view") || { innerHTML: "" }).innerHTML.trim() === "",
      }));

      if (state.session !== "one-document") {
        failures.push(`${route}: document was replaced (router fell back to a full page load)`);
        /* The session marker is gone, so every later route would report the
           same thing. Re-establish it and carry on so one bad route does not
           mask the other forty. */
        await page.evaluate(() => { window.__pbSession = "one-document"; });
      } else if (!ok) {
        failures.push(`${route}: navigate() returned false`);
      } else if (state.path !== route) {
        failures.push(`${route}: landed on ${state.path}`);
      } else if (state.empty) {
        failures.push(`${route}: #app-view is empty`);
      } else if (state.mounted && !state.bound) {
        /* Only demand binding where there is something to bind. /app/contact/,
           /app/integrations/, /app/shortcuts/ and /app/tools/ are static --
           no x-data in their templates at all -- so requiring an Alpine root
           on every route failed four pages that were working correctly. */
        failures.push(`${route}: Alpine never bound the view root`);
      }

      const fresh = errors.slice(before);
      if (fresh.length) {
        failures.push(`${route}: ${fresh.length} error(s) -- ${fresh[0].message.slice(0, 160)}`);
      }
    }

    expect(failures, `${failures.length} of ${routes.length} routes failed:\n  ` + failures.join("\n  ")).toEqual([]);
  });
});
