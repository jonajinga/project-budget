import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* Both off-canvas drawers hid by transform alone, so a CLOSED drawer kept
   every link in the tab order. On a phone, tabbing from the hamburger walked
   the entire sidebar -- every nav item, every account link, the save pill --
   with nothing visible on screen. */

test("a closed sidebar is not reachable by keyboard", async ({ seeded, viewport }) => {
  test.skip(!viewport || viewport.width >= 1024, "drawer behaviour is below 1024px");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/");

  const open = await page.evaluate(() => {
    const el = document.querySelector("#app-sidebar");
    return el ? el.classList.contains("is-open") : null;
  });
  expect(open, "sidebar should start closed on mobile").toBe(false);

  await page.evaluate(() => document.body.focus());
  let entered = null;
  for (let i = 0; i < 30 && !entered; i++) {
    await page.keyboard.press("Tab");
    entered = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a) return null;
      const sb = a.closest("#app-sidebar, .site-menu");
      return sb ? (a.textContent || a.className || a.tagName).trim().slice(0, 50) : null;
    });
  }
  expect(entered, "focus must never enter a closed drawer").toBeNull();
  await page.close();
});

test("the desktop sidebar is still visible", async ({ seeded, viewport }) => {
  /* The mobile fix sets visibility:hidden in the BASE .app-sidebar rule,
     which applies at every width. Desktop turns the drawer into a permanent
     sticky column and never adds .is-open, so it must restore visibility --
     without this assertion that regression is invisible in a diff. */
  test.skip(!viewport || viewport.width < 1024, "desktop only");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/");
  const state = await page.evaluate(() => {
    const el = document.querySelector("#app-sidebar");
    if (!el) return { present: false };
    const cs = getComputedStyle(el);
    return {
      present: true,
      visibility: cs.visibility,
      display: cs.display,
      width: Math.round(el.getBoundingClientRect().width),
      links: el.querySelectorAll("a").length,
    };
  });
  expect(state.present).toBe(true);
  expect(state.visibility, "desktop sidebar must stay visible").toBe("visible");
  expect(state.width, "desktop sidebar must have width").toBeGreaterThan(100);
  expect(state.links).toBeGreaterThan(5);
  await page.close();
});

test("an opened sidebar is reachable again", async ({ seeded, viewport }) => {
  test.skip(!viewport || viewport.width >= 1024, "drawer behaviour is below 1024px");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("open-sidebar")));
  await page.waitForTimeout(400);
  const vis = await page.evaluate(() => {
    const el = document.querySelector("#app-sidebar");
    return { open: el.classList.contains("is-open"), visibility: getComputedStyle(el).visibility };
  });
  expect(vis.open).toBe(true);
  expect(vis.visibility, "opening must restore visibility").toBe("visible");
  await page.close();
});
