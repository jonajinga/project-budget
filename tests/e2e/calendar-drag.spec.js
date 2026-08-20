import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* Calendar drag-to-reschedule used raw HTML5 drag-and-drop (:draggable,
   @dragstart, @drop). Those events do not fire on iOS Safari or Android
   Chrome, so on every phone the feature silently did nothing. It now runs
   through ui/sortable-bind.js, which already solved touch dragging for the
   budget and account lists. */

/* The bundled sample's transactions stop at 2026-05-28, so the calendar's
   default month (today's) is empty and there is nothing to drag. Anchor the
   view to a month that actually has data. Derived from the store rather than
   hardcoded, so refreshing the sample does not silently gut this suite. */
async function openWeekView(seeded) {
  const page = await openMonthView(seeded);
  await page.evaluate(() => {
    window.Alpine.$data(document.querySelector('[x-data*="calendarView"]')).view = "week";
  });
  await page.waitForTimeout(900);
  return page;
}

async function openMonthView(seeded) {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/calendar/");
  await page.waitForFunction(
    () => window.Alpine?.store?.("budget")?.profile?.transactions?.length > 0,
    { timeout: 15000 }
  );
  await page.evaluate(() => {
    const el = document.querySelector('[x-data*="calendarView"]');
    const d = window.Alpine.$data(el);
    const dates = window.Alpine.store("budget").profile.transactions
      .map((t) => t.date).sort();
    d.view = "month";
    d.anchorISO = dates[dates.length - 1];
  });
  await page.waitForTimeout(900);
  return page;
}

test("entry lists are registered as drop targets", async ({ seeded }) => {
  const page = await openMonthView(seeded);
  const info = await page.evaluate(() => {
    const lists = [...document.querySelectorAll('[data-sortable-kind="calendar"]')];
    return {
      lists: lists.length,
      withIso: lists.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.getAttribute("data-sortable-group-id") || "")).length,
      bound: lists.filter((l) => l.__pbSortable).length,
      items: document.querySelectorAll('[data-sortable-kind="calendar"] li[data-sortable-id]').length,
    };
  });
  expect(info.lists, "month grid should register day lists").toBeGreaterThan(20);
  expect(info.withIso, "every list keys to a real ISO date").toBe(info.lists);
  expect(info.bound, "SortableJS must actually bind them").toBe(info.lists);
  expect(info.items, "chips must carry their transaction id").toBeGreaterThan(0);
  await page.close();
});

test("no HTML5 drag attributes survive", async ({ seeded }) => {
  const page = await openMonthView(seeded);
  const leftovers = await page.evaluate(() => ({
    draggable: document.querySelectorAll(".cal__entry[draggable], .cal-week__entry[draggable]").length,
    dropTargets: document.querySelectorAll(".cal__cell--drop-target, .cal-week__day--drop-target").length,
  }));
  expect(leftovers.draggable, "HTML5 draggable should be gone").toBe(0);
  expect(leftovers.dropTargets).toBe(0);
  await page.close();
});

test("reconciled and transfer chips are filtered from dragging", async ({ seeded }) => {
  const page = await openMonthView(seeded);
  const locked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-sortable-kind="calendar"] li')];
    return {
      total: items.length,
      locked: items.filter((i) => i.getAttribute("data-sortable-locked") === "1").length,
    };
  });
  expect(locked.total).toBeGreaterThan(0);
  /* Scheduled items are always locked; the sample has several. */
  expect(locked.locked, "locked rows must be filterable by SortableJS").toBeGreaterThan(0);
  await page.close();
});

/* NOT VERIFIED IN CI. Marked fixme deliberately rather than deleted or left
   flaky-green.
 *
 * The wiring above IS verified: lists register as drop targets keyed to real
 * ISO dates, SortableJS binds them, chips carry their transaction id, locked
 * rows are filterable, and no HTML5 drag attributes survive. Instrumentation
 * also confirmed the full drag lifecycle fires (onChoose -> onStart -> onEnd)
 * and that the pointer lands on the destination day's list.
 *
 * What is not reliable is driving a cross-list SortableJS drop from a test.
 * Synthesised PointerEvents miss entirely, because SortableJS picks its event
 * model per browser -- Safari uses touch, Chromium uses pointer. Playwright's
 * real mouse input does start the drag, and this assertion has passed, but
 * only for some source/destination pairs, so it is luck rather than a gate.
 *
 * The plan always called for a real-device pass on iOS Safari and Android
 * Chrome for exactly this item, on the grounds that emulation lies here. That
 * pass is what should promote this test, not more harness engineering. */
test.fixme("a touch drag moves a transaction to another day", async ({ seeded, viewport }) => {
  /* The assertion that matters, and the reason webkit-touch exists as a
     project: HTML5 drag-and-drop silently no-ops on iOS Safari, and a
     Chromium-only suite would have reported this feature working for years. */
  /* Month view on a phone collapses entries to 6px dots (font-size 0, both
     child spans display:none) -- dragging those is not a real interaction,
     and making the day cell the target there is a Phase 4 decision. The WEEK
     view renders full-width rows at every size, so that is where touch drag
     is actually verified. */
  const narrow = viewport && viewport.width < 600;
  const page = narrow ? await openWeekView(seeded) : await openMonthView(seeded);

  const target = await page.evaluate(() => {
    const item = [...document.querySelectorAll('[data-sortable-kind="calendar"] li[data-sortable-id]')]
      .find((li) => li.getAttribute("data-sortable-locked") !== "1"
                 && li.getBoundingClientRect().height > 0);
    if (!item) return null;
    item.scrollIntoView({ block: "center" });
    const list = item.closest('[data-sortable-kind="calendar"]');
    const from = list.getAttribute("data-sortable-group-id");
    /* The ADJACENT day in document order: spatially next to the source, so
       it stays on screen at any viewport. On a 390px phone the month cells
       collapse to 6px dots, and a "fully visible" filter finds nothing. */
    const all = [...document.querySelectorAll('[data-sortable-kind="calendar"]')];
    const idx = all.indexOf(list);
    const other = all.slice(idx + 1).concat(all.slice(0, idx).reverse())
      .find((l) => l.getAttribute("data-sortable-group-id")
                && l.getAttribute("data-sortable-group-id") !== from);
    if (!other) return null;
    other.scrollIntoView({ block: "center" });
    item.scrollIntoView({ block: "center" });
    return {
      id: item.getAttribute("data-sortable-id"),
      from,
      to: other.getAttribute("data-sortable-group-id"),
    };
  });
  expect(target, "needed a draggable chip and a visible different day").not.toBeNull();

  const before = await page.evaluate((id) =>
    window.Alpine.store("budget").profile.transactions.find((t) => t.id === id).date, target.id);
  expect(before).toBe(target.from);

  /* Real input, not synthesised events. SortableJS picks its event model per
     browser -- Safari uses touch, Chromium uses pointer -- so hand-dispatched
     PointerEvents land in the wrong listener on WebKit and the drag never
     starts. Playwright's mouse generates trusted events that SortableJS's
     forceFallback path handles identically to a finger, and delayOnTouchOnly
     means the mouse path has no hold delay. */
  const pts = await page.evaluate((t) => {
    const item = document.querySelector(`li[data-sortable-id="${t.id}"]`);
    const dest = document.querySelector(`[data-sortable-group-id="${t.to}"]`);
    if (!item || !dest) return null;
    const ir = item.getBoundingClientRect();
    const dr = dest.getBoundingClientRect();
    return {
      sx: Math.round(ir.left + ir.width / 2), sy: Math.round(ir.top + ir.height / 2),
      tx: Math.round(dr.left + dr.width / 2), ty: Math.round(dr.top + Math.max(6, dr.height / 2)),
    };
  }, target);
  expect(pts, "could not locate drag endpoints").not.toBeNull();

  await page.mouse.move(pts.sx, pts.sy);
  await page.mouse.down();
  /* sortable-bind sets delay:200 with delayOnTouchOnly, so on the
     touch-enabled projects the press has to be held before it counts as a
     drag rather than a scroll. Harmless on desktop. */
  await page.waitForTimeout(280);
  /* Several small steps: SortableJS needs movement above its threshold and
     a moveend on the destination list to register the drop target. */
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(
      pts.sx + ((pts.tx - pts.sx) * i) / 12,
      pts.sy + ((pts.ty - pts.sy) * i) / 12
    );
    await page.waitForTimeout(20);
  }
  await page.mouse.up();

  await page.waitForTimeout(700);

  const after = await page.evaluate((id) =>
    window.Alpine.store("budget").profile.transactions.find((t) => t.id === id).date, target.id);
  expect(after, `chip should have moved from ${target.from} to ${target.to}`).toBe(target.to);
  await page.close();
});
