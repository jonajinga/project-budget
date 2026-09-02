import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* The kebab menu must open ON SCREEN, wherever its trigger happens to be.
 *
 * It did not. The list was `position: absolute; top: calc(100% + 4px)`, so it
 * always hung downward from the trigger regardless of whether there was room.
 * The budget row menu was nine items -- about 360px -- when this bug shipped
 * (six since the revamp moved Move money / Set goal / Rename into the
 * inspector), so opening one from a row in the lower half of a phone screen
 * put most of it past the bottom edge, unreachable.
 *
 * The trap this test is built to avoid: opening a menu from a row that has
 * just been scrolled to the MIDDLE of the viewport, where there is plenty of
 * room below and the bug does not reproduce. An earlier check did exactly
 * that (scrollIntoViewIfNeeded, which centres the element) and reported the
 * menu comfortably on screen while the real thing was broken. So this
 * deliberately parks each trigger LOW in the viewport before opening it.
 */

/* Routes that render an overflow menu.
 *
 * `required` means the route must have one at EVERY viewport, so a menu that
 * disappears entirely is a failure rather than a silent skip. /app/budget/ is
 * the one this bug was reported against and it carries a kebab per category
 * row at both sizes, so it anchors the suite.
 *
 * The others are viewport-dependent by design -- /app/payees/ renders an
 * inline-edit table on desktop and cards with kebabs only on phones -- so
 * "no trigger here" is a legitimate skip, reported as a skip so it stays
 * visible rather than passing vacuously. */
const CASES = [
  { route: "/app/budget/", label: "budget category row", required: true },
  { route: "/app/accounts/", label: "account card", required: false },
  { route: "/app/payees/", label: "payee card", required: false },
  { route: "/app/scheduled/", label: "scheduled item", required: false },
];

async function openAndMeasure(page, index) {
  const triggers = page.locator(".overflow-menu__trigger:visible");
  const count = await triggers.count();
  if (!count) return null;
  const trigger = triggers.nth(Math.min(index, count - 1));

  /* Park the trigger near the BOTTOM of the viewport -- the position the bug
     needs. Centring it hides the defect. */
  await trigger.evaluate((el) => {
    const vh = document.documentElement.clientHeight;
    const y = el.getBoundingClientRect().top + window.scrollY - (vh - 90);
    window.scrollTo(0, Math.max(0, y));
  });
  await page.waitForTimeout(120);
  await trigger.click();
  await page.waitForTimeout(200);

  const box = await page.evaluate(() => {
    const list = [...document.querySelectorAll(".overflow-menu__list")].find(
      (el) => el.getBoundingClientRect().height > 0 && getComputedStyle(el).display !== "none"
    );
    if (!list) return null;
    const r = list.getBoundingClientRect();
    const de = document.documentElement;
    return {
      top: Math.round(r.top),
      left: Math.round(r.left),
      bottom: Math.round(r.bottom),
      right: Math.round(r.right),
      vw: de.clientWidth,
      vh: de.clientHeight,
    };
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  return box;
}

for (const { route, label, required } of CASES) {
  test(`${label} menu opens fully on screen near the bottom edge`, async ({ seeded }) => {
    const page = await seeded.newPage();
    await gotoApp(page, route);
    await page.waitForTimeout(400);

    const available = await page.locator(".overflow-menu__trigger:visible").count();
    if (!required) {
      test.skip(available === 0, `${route} renders no overflow menu at this viewport`);
    }
    expect(available, `${route} must render an overflow menu at every viewport`).toBeGreaterThan(0);

    /* Check a few triggers, not just the first: menus differ in length and
       only the tall ones overflow. */
    let checked = 0;
    for (const idx of [0, 3, 8]) {
      const box = await openAndMeasure(page, idx);
      if (!box) continue;
      checked++;
      expect(box.bottom, `${route} trigger ${idx}: menu runs past the bottom edge`).toBeLessThanOrEqual(box.vh);
      expect(box.top, `${route} trigger ${idx}: menu runs past the top edge`).toBeGreaterThanOrEqual(0);
      expect(box.right, `${route} trigger ${idx}: menu runs past the right edge`).toBeLessThanOrEqual(box.vw);
      expect(box.left, `${route} trigger ${idx}: menu runs past the left edge`).toBeGreaterThanOrEqual(0);
    }
    expect(checked, `${route} rendered no overflow menu to test — the test would pass vacuously`).toBeGreaterThan(0);
  });
}

/* The other half of the original defect: an absolutely positioned popover is
   clipped by any scrolling ancestor, independently of where the viewport
   edges are. Fixed positioning is what escapes that, so assert it directly --
   if someone puts the menu back to `absolute`, the viewport checks above
   might still pass on a tall desktop screen while this one fails. */
test("the open menu is not laid out inside a scrolling ancestor", async ({ seeded }) => {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.waitForTimeout(400);

  const trigger = page.locator(".overflow-menu__trigger:visible").first();
  await trigger.click();
  await page.waitForTimeout(200);

  const result = await page.evaluate(() => {
    const list = [...document.querySelectorAll(".overflow-menu__list")].find(
      (el) => el.getBoundingClientRect().height > 0 && getComputedStyle(el).display !== "none"
    );
    if (!list) return { none: true };
    const r = list.getBoundingClientRect();
    let clipper = null;
    let el = list.parentElement;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/hidden|auto|scroll/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
        const b = el.getBoundingClientRect();
        if (r.bottom > b.bottom + 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.left < b.left - 1) {
          clipper = (typeof el.className === "string" ? el.className.split(" ")[0] : el.tagName) + ` (${cs.overflow}/${cs.overflowX}/${cs.overflowY})`;
          break;
        }
      }
      el = el.parentElement;
    }
    return { position: getComputedStyle(list).position, clipper };
  });

  expect(result.none, "no menu opened — the assertions below would be vacuous").toBeFalsy();
  expect(result.position, "the menu must be fixed so no scroll container can clip it").toBe("fixed");
  expect(result.clipper, `the menu overflows a scrolling ancestor: ${result.clipper}`).toBeNull();
});
