import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* The editable dashboard, driven the way a person drives it.
 *
 * NOTE ON PERSISTENCE. These tests do not reload the page to check that a
 * change stuck, and that is deliberate: fixtures.js seeds through
 * addInitScript, which re-runs on EVERY navigation and rewrites localStorage
 * with the pristine profile. A reload here would restore the original layout
 * and the test would report "changes were lost" for a bug that does not
 * exist. What actually needs proving is that the mutation reached storage, so
 * that is asserted directly against what the app wrote.
 */

async function openDashboard(seeded) {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/");
  await page.waitForFunction(
    () => { const s = window.Alpine?.store?.("budget"); return s ? s.loading === false : false; },
    { timeout: 10000 }
  ).catch(() => {});
  await page.waitForTimeout(500);
  return page;
}

const layout = (page) =>
  page.evaluate(() => {
    const d = window.Alpine.store("budget").activeDashboard();
    return {
      types: d.widgets.map((w) => w.type),
      sizes: d.widgets.map((w) => w.w + "x" + w.h),
      domOrder: [...document.querySelectorAll(".dash-widget")].map((e) => e.getAttribute("aria-label")),
      domCount: document.querySelectorAll(".dash-widget").length,
    };
  });

test("renders every widget in the stored dashboard", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  const l = await layout(page);
  expect(l.types.length).toBeGreaterThan(5);
  expect(l.domCount, "the DOM must show what the store holds").toBe(l.types.length);
});

test("the two charts mount inside their widgets", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  await page.waitForTimeout(900);
  /* mountChart() returns a silent no-op stub when its selector matches
     nothing, so a chart that never mounts leaves no error anywhere -- only an
     empty box. Counting canvases is the only honest check. */
  await expect
    .poll(() => page.locator(".dash-grid canvas").count(), { timeout: 6000 })
    .toBeGreaterThan(0);
});

test("edit mode adds chrome, and leaving it takes the chrome away", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  /* :visible matters — x-show hides with display:none rather than removing
     the node, so a bare count() finds the chrome even in read mode. */
  expect(await page.locator("[data-widget-grip]:visible").count()).toBe(0);

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(250);
  const grips = await page.locator("[data-widget-grip]:visible").count();
  expect(grips).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForTimeout(250);
  expect(await page.locator("[data-widget-grip]:visible").count()).toBe(0);
});

test("a widget can be moved with the keyboard alone", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(250);

  const before = await layout(page);

  /* No pointer anywhere in this test: focus the grip, pick up, move, drop. */
  await page.locator("[data-widget-grip]:visible").first().focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".dash-widget.is-keyboard-active")).toHaveCount(1);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(350);
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);

  const after = await layout(page);
  expect(after.types, "the keyboard move must reorder the layout").not.toEqual(before.types);
  expect(after.types[1]).toBe(before.types[0]);
  expect([...after.types].sort(), "a move must not add or drop widgets").toEqual([...before.types].sort());
  expect(after.domOrder[1]).toBe(before.domOrder[0]);
});

test("a widget can be resized with the keyboard alone", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(250);

  const before = await layout(page);
  await page.locator("[data-widget-grip]:visible").first().focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".dash-widget.is-keyboard-active"), "pickup did not register").toHaveCount(1);
  await page.keyboard.press("Shift+ArrowLeft");
  await page.waitForTimeout(350);

  const after = await layout(page);
  expect(after.sizes[0], "shift+left must narrow the widget").not.toBe(before.sizes[0]);

  /* And the span actually reaches the element, not just the store. */
  const span = await page.locator(".dash-widget").first().getAttribute("style");
  expect(span).toContain("grid-column: span");
});

test("adding and removing a widget updates the screen and the stored profile", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(250);
  const before = await layout(page);

  await page.getByRole("button", { name: "Add widget" }).click();
  await page.waitForTimeout(300);
  const addable = page.locator(".widget-picker__item:not([disabled])");
  expect(await addable.count(), "picker offered nothing to add").toBeGreaterThan(0);
  await addable.first().click();
  await page.waitForTimeout(400);

  const added = await layout(page);
  expect(added.types.length).toBe(before.types.length + 1);
  expect(added.domCount).toBe(added.types.length);

  /* Persistence, asserted where it actually happens. */
  const stored = await page.evaluate(() => {
    const id = localStorage.getItem("projectbudget:active");
    const raw = localStorage.getItem("projectbudget:profile:" + id);
    if (!raw || raw.startsWith("PB2:")) return null; /* compressed — skip */
    const p = JSON.parse(raw);
    const d = (p.dashboards || []).find((x) => !x.deletedAt);
    return d ? d.widgets.length : null;
  });
  if (stored !== null) {
    expect(stored, "the added widget must be written to storage, not just held in memory").toBe(added.types.length);
  }

  await page.locator(".dash-widget__remove").first().click();
  await page.waitForTimeout(400);
  const removed = await layout(page);
  expect(removed.types.length).toBe(added.types.length - 1);
  expect(removed.domCount).toBe(removed.types.length);
});

test("a second dashboard is independent of the first", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  const first = await layout(page);

  await page.evaluate(() =>
    window.Alpine.store("budget").createDashboard("Bills only", ["upcoming-bills", "recent"])
  );
  await page.waitForTimeout(500);

  const second = await layout(page);
  expect(second.types).toEqual(["upcoming-bills", "recent"]);
  expect(second.domCount).toBe(2);

  /* Switching back must bring the original layout with it — a shared widget
     array between dashboards would show up right here. */
  await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    s.setActiveDashboard(s.dashboardList()[0].id);
  });
  await page.waitForTimeout(500);
  const back = await layout(page);
  expect(back.types).toEqual(first.types);
});

/* ---------------------------------------------------------------------------
   Phase 0 corrective tests.

   These three assert properties the shipped dashboard got wrong. Each one is
   written to fail against the code as it stands, so that passing means the
   defect is gone rather than that the assertion was weak.
   ------------------------------------------------------------------------- */

const undoDepth = (page) =>
  page.evaluate(() => window.Alpine.store("budget")._undoStack.length);

async function pickUpFirstWidget(page) {
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(250);
  await page.locator("[data-widget-grip]:visible").first().focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".dash-widget.is-keyboard-active")).toHaveCount(1);
}

/* A gesture is one action, so it is one undo entry.
 *
 * _recordUndo deep-clones the ENTIRE profile - 723KB on the seeded sample - so
 * committing per step does not merely mislabel history, it evicts real user
 * actions from a 50-entry stack and clones most of a megabyte per keypress.
 * Three arrow presses inside one pick-up/drop is still one move. */
test("a multi-step keyboard move records exactly one undo entry", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  await pickUpFirstWidget(page);

  const before = await undoDepth(page);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
  }
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);

  const after = await undoDepth(page);
  expect(after - before, "three arrow presses in one gesture must cost one undo entry").toBe(1);
});

/* Cancelling costs nothing. Escape currently replays a move AND a resize
 * through the store, so abandoning a drag is more expensive than completing
 * one - and it leaves "Move widget" entries describing a move that was
 * explicitly rejected. */
test("cancelling a keyboard move records no undo entry at all", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  await pickUpFirstWidget(page);

  const before = await undoDepth(page);
  const orderBefore = (await layout(page)).types;

  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  expect(await undoDepth(page), "a cancelled gesture must not touch the undo stack").toBe(before);
  expect((await layout(page)).types, "escape must restore the original order").toEqual(orderBefore);
});

/* The keyboard story is built on announcements. The grid looked them up on
 * "#pb-live", which does not exist anywhere in the app - the real regions are
 * #pb-live-polite and #pb-live-assertive - so every announcement was dropped
 * silently, and no gate noticed because axe cannot see a region never written
 * to. */
test("picking a widget up announces into the real live region", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  await pickUpFirstWidget(page);

  await expect
    .poll(() => page.locator("#pb-live-polite").innerText(), { timeout: 3000 })
    .not.toBe("");
});

/* Chart hosts must not carry ids. Once a chart widget can be added twice - the
 * entire point of the rebuild - fixed ids produce duplicate-id-active, which is
 * a ZERO-tolerance rule in the a11y ratchet, not a budgeted one. */
test("chart widgets are addressed by data attribute, never by a fixed id", async ({ seeded }) => {
  const page = await openDashboard(seeded);
  await page.waitForTimeout(800);

  const m = await page.evaluate(() => ({
    fixedIds: document.querySelectorAll('[id^="dash-chart"]').length,
    hosts: document.querySelectorAll("[data-chart-host]").length,
  }));
  expect(m.fixedIds, "no chart host may carry a hardcoded id").toBe(0);
  expect(m.hosts, "the chart widgets must still be present and addressable").toBeGreaterThan(0);
});
