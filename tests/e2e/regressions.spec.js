import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* Locks the runtime crashes found when the Playwright harness first ran.
   Each one was invisible to static review and to the unit suite. */

test("register renders transactions on a phone", async ({ seeded, viewport }) => {
  test.skip(!viewport || viewport.width > 500, "mobile viewport only");
  /* register-view.js init() used to throw on `this.form.date` -- state that
     was deleted with the inline add-form but still referenced. The throw
     aborted init() before the matchMedia call that sets isMobile, so the
     card view never activated. Combined with components.css hiding the
     table under 599px, the register rendered NOTHING on a phone. */
  const page = await seeded.newPage();
  await gotoApp(page, "/app/register/");
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const el = document.querySelector('[x-data*="registerView"]');
    const d = el && window.Alpine.$data(el);
    const cards = document.querySelector(".register__cards");
    return {
      isMobile: d ? d.isMobile : null,
      display: cards ? getComputedStyle(cards).display : "absent",
      height: cards ? Math.round(cards.getBoundingClientRect().height) : 0,
      count: cards ? cards.querySelectorAll("li").length : 0,
    };
  });
  expect(r.isMobile, "init() must reach the matchMedia setup").toBe(true);
  expect(r.display, "card list must be visible on mobile").not.toBe("none");
  expect(r.height, "card list must have real height").toBeGreaterThan(100);
  expect(r.count, "cards must render").toBeGreaterThan(0);
  await page.close();
});

test("profile collection fields are always arrays", async ({ seeded }) => {
  /* The bundled sample shipped `budgetTemplates: {}`. It is truthy, so the
     common `(x || []).slice()` guard sailed past it and threw on every
     /app/budget/ load. normalizeShape() in schema.js now coerces on load,
     which also heals profiles already persisted with the bad shape. */
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  const shape = await page.evaluate(() => {
    const p = window.Alpine.store("budget").profile;
    const fields = ["accounts", "categories", "transactions", "goals", "budgetTemplates", "savedViews", "snapshots"];
    return fields.filter((f) => !Array.isArray(p[f]));
  });
  expect(shape, "these profile fields must be arrays").toEqual([]);
  await page.close();
});

test("the settings page does not clobber the header theme picker", async ({ seeded }) => {
  /* partials/theme-picker.njk and pages/app/settings.njk both declared a
     global themePicker(). The page's copy parsed later and won, so the
     header picker lost lightThemes()/darkThemes() and threw on every load. */
  const page = await seeded.newPage();
  const { errors } = await gotoApp(page, "/app/settings/");
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  const ok = await page.evaluate(() => {
    const el = document.querySelector('[x-data*="themePicker()"]');
    if (!el) return "header picker not found";
    const d = window.Alpine.$data(el);
    return typeof d.lightThemes === "function" && typeof d.darkThemes === "function"
      ? "ok"
      : "header picker lost its theme getters";
  });
  expect(ok).toBe("ok");
  await page.close();
});
