import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* One widget per source, at its default view.
 *
 * This single test is the registry's smoke gate. The registries in
 * domain/dashboard-sources.js and domain/dashboard-views.js refer to store
 * methods and chart modules BY NAME, so a rename, a missing module, or an
 * undeclared library dependency cannot be caught by anything but running them.
 * The failure mode is silent by nature: a renderer that reaches for window.d3
 * and returns early when it is absent produces no error at all, just an empty
 * card. Two of the eleven shipped that way and nothing noticed.
 *
 * Two traps this test is written to avoid, both of which produced a
 * confidently wrong "everything renders" during development:
 *
 * 1. Do NOT query the whole widget for canvas/svg. The edit chrome carries
 *    grip and remove icons that are <svg>, so a whole-widget query reports a
 *    drawing for every widget on the board including plain tables.
 *
 * 2. Do NOT wait a fixed time. Charts mount through a dynamic import and
 *    sometimes a 280KB library fetch, so a sleep catches different widgets
 *    mid-mount on every run. Waiting for "the picture stopped changing" is
 *    also wrong: before anything mounts, two consecutive samples are trivially
 *    identical and it returns instantly on an empty board.
 */

test("every source renders something at its default view", async ({ seeded }) => {
  const page = await seeded.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await gotoApp(page, "/app/");
  await page.waitForFunction(
    () => { const s = window.Alpine?.store?.("budget"); return s ? s.loading === false : false; },
    { timeout: 10000 }
  ).catch(() => {});
  await page.waitForTimeout(600);

  const placed = await page.evaluate(async () => {
    const store = window.Alpine.store("budget");
    const mod = await import("/assets/js/domain/dashboard-sources.js");
    const ids = mod.SOURCES.filter((s) => s.family === "reports").map((s) => s.id);
    const d = store.createDashboard("All sources", ids);
    return { asked: ids.length, placed: d.widgets.length };
  });
  expect(placed.placed, "every report source must be placeable").toBe(placed.asked);
  expect(placed.asked, "the registry should not have quietly emptied").toBeGreaterThan(10);

  /* Wait for the thing being measured to exist. */
  await page.waitForFunction(() => {
    const hosts = [...document.querySelectorAll("[data-chart-host]")];
    if (!hosts.length) return false;
    return hosts.every((h) => h.childElementCount > 0 || (h.textContent || "").trim().length > 0);
  }, { timeout: 30000, polling: 400 }).catch(() => {});
  await page.waitForTimeout(600);

  const widgets = await page.evaluate(() =>
    [...document.querySelectorAll(".dash-widget")].map((w) => {
      const body = w.querySelector(".dash-widget__body");
      const text = ((body || w).innerText || "").replace(/\s+/g, " ").trim();
      return {
        label: w.getAttribute("aria-label"),
        drew: !!(body && body.querySelector("canvas, svg")),
        chars: text.length,
      };
    })
  );

  expect(widgets.length).toBe(placed.asked);
  const empty = widgets.filter((w) => !w.drew && w.chars <= 12).map((w) => w.label);
  expect(empty, "these sources rendered nothing at their default view").toEqual([]);
  expect(errors, "a widget must not log an error to render").toEqual([]);
});

/* D3 is 280KB and only five of the eleven renderers want it. A dashboard made
   of Chart.js widgets should never pay for it, and one containing a treemap
   should fetch it exactly when that widget appears - not at page load. */
test("D3 loads only when a widget that needs it is on the board", async ({ seeded }) => {
  const page = await seeded.newPage();
  const d3Requests = [];
  page.on("request", (r) => { if (/d3.*\.min\.js/.test(r.url())) d3Requests.push(r.url()); });

  await gotoApp(page, "/app/");
  await page.waitForFunction(
    () => { const s = window.Alpine?.store?.("budget"); return s ? s.loading === false : false; },
    { timeout: 10000 }
  ).catch(() => {});
  await page.waitForTimeout(1500);

  expect(d3Requests, "the default board has no D3 widget and must not fetch D3").toEqual([]);

  await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    s.createDashboard("Treemap only", ["report:spending"]);
  });
  await expect.poll(() => d3Requests.length, { timeout: 15000 }).toBeGreaterThan(0);
});
