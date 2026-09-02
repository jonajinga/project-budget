/* The store must boot exactly once.
 *
 * Alpine.store() auto-calls init() on a registered store through the
 * REACTIVE proxy. app.js used to follow the registration with an
 * explicit store.init() on the RAW module object, so two async boot
 * chains raced; the loser's _load() replaced this.profile with writes
 * no effect could see (raw-object writes fire no reactivity). Which
 * chain lost was module-graph timing luck: an unrelated import-size
 * change flipped the race and the dashboard's lazily-seeded board
 * vanished ~100ms after creation, freezing the page on stale state.
 *
 * This test only OBSERVES: it never calls dashboardList() itself,
 * because that read re-seeds and would heal exactly the wound being
 * checked (the first version of this test passed against the broken
 * build for that reason and was rewritten). The page's own tab strip
 * does the seeding; the assertion is that the stored seed is still
 * there after any delayed second boot chain has landed.
 */
import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

test("the dashboard seed survives boot (no second racing _load)", async ({ seeded }) => {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/");
  /* The page's own render must seed and show at least one tab. */
  await page.waitForFunction(
    () => document.querySelectorAll(".dash-tabs__tab").length >= 1,
    { timeout: 8000 }
  );
  /* Give a delayed second boot chain time to clobber, then look at the
     STORED data without touching any read that could re-seed it. */
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    return {
      dash: s.profile ? s.profile.dashboards.length : null,
      booted: s._bootStarted === true,
      tabs: document.querySelectorAll(".dash-tabs__tab").length,
    };
  });
  expect(st.booted, "init() must set its idempotence flag").toBe(true);
  expect(st.dash, "the seed must survive boot").toBeGreaterThanOrEqual(1);
  expect(st.tabs).toBeGreaterThanOrEqual(1);
  await page.close();
});
