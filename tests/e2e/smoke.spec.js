import { test, expect, appOnlyRoutes } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

const ROUTES = appOnlyRoutes();

test("route discovery finds the full app", () => {
  /* Guards against the build silently dropping pages -- if this number falls,
     something stopped generating and every other gate would go quiet with it. */
  expect(ROUTES.length).toBeGreaterThanOrEqual(43);
});

test.describe("every app route loads clean", () => {
  for (const route of ROUTES) {
    test(`${route} has no page errors or failed requests`, async ({ seeded }) => {
      const page = await seeded.newPage();
      const { errors, bad } = await gotoApp(page, route);
      expect(errors, `uncaught JS errors on ${route}`).toEqual([]);
      expect(bad, `failed requests on ${route}`).toEqual([]);
      await page.close();
    });
  }
});

test.describe("main is not blank", () => {
  for (const route of ROUTES) {
    test(`${route} renders content with data`, async ({ seeded }) => {
      const page = await seeded.newPage();
      await gotoApp(page, route);
      const text = await page.locator("#main").innerText();
      /* The guard against x-show regressions: a page whose root section is
         gated on data will render an empty shell rather than erroring, so
         only a content-length assertion catches it. */
      expect(text.replace(/\s+/g, " ").trim().length, `#main was blank on ${route}`)
        .toBeGreaterThan(200);
      await page.close();
    });
  }
});

/* Ported from scripts/audit-viewports.mjs, which had this check but was stale
   and unrunnable (it read a sample path that does not exist, and Playwright
   was never installed). Here it actually gates. */
test.describe("no horizontal overflow", () => {
  for (const route of ROUTES) {
    test(`${route} does not scroll sideways`, async ({ seeded }) => {
      const page = await seeded.newPage();
      await gotoApp(page, route);
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return { scrollW: de.scrollWidth, clientW: de.clientWidth };
      });
      /* 1px of slack absorbs sub-pixel rounding on fractional viewports. */
      expect(
        overflow.scrollW - overflow.clientW,
        `${route} overflows horizontally (${overflow.scrollW} > ${overflow.clientW})`
      ).toBeLessThanOrEqual(1);
      await page.close();
    });
  }
});
