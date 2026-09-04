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
      /* Measure .app-main, not #main. #main CONTAINS the sidebar, so its text
         length swings by ~1000 chars depending on whether the drawer is open
         -- which made the threshold meaningless and produced a false failure
         on /app/profiles/ the moment closed drawers correctly stopped
         contributing text. .app-main is the page's own content and reads the
         same at every viewport.

         The guard against x-show regressions: a page whose root section is
         gated on data renders an empty shell rather than erroring, so only a
         content-length assertion catches it. The thinnest real page is
         /app/profiles/ at 142 characters; a blank shell is under 20. */
      /* innerText plus the value of any textarea or input. A textarea's
         value is not its text content once something has written to it,
         so innerText alone reads /app/diagnostics/ as 62 characters
         while a 749-character report sits in the box. That page is the
         one route whose entire content is a form control, and the
         chrome change that moved its explanatory prose behind the info
         button took it under the threshold. Counting control values
         measures what is on the screen rather than what happens to be
         a text node; a genuinely empty shell is still under 20. */
      const text = await page.locator(".app-main").evaluate((el) => {
        const controls = [...el.querySelectorAll("textarea, input[type='text'], input:not([type])")]
          .map((c) => c.value || "")
          .join(" ");
        return el.innerText + " " + controls;
      });
      expect(text.replace(/\s+/g, " ").trim().length, `.app-main was blank on ${route}`)
        .toBeGreaterThan(100);
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
