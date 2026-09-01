import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* Authoring a widget from the UI.
 *
 * This is the capability the rebuild exists for. Before it, the dashboard
 * offered thirteen fixed cards and no way to make anything else, in a codebase
 * that already had fourteen parameterised report methods and eleven renderers.
 *
 * The builder and the settings dialog are the SAME form: configuring is that
 * form opened over an existing widget. These tests drive both through the real
 * UI rather than the store, because the store path was already green while the
 * screen was not.
 */

async function openBoard(seeded) {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/");
  await page.waitForFunction(
    () => { const s = window.Alpine?.store?.("budget"); return s ? s.loading === false : false; },
    { timeout: 10000 }
  ).catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(250);
  return page;
}

const lastWidget = (page) =>
  page.evaluate(() => {
    const d = window.Alpine.store("budget").activeDashboard();
    const w = d.widgets[d.widgets.length - 1];
    return { count: d.widgets.length, source: w.source, view: w.view, title: w.title, params: w.params };
  });

test("a widget can be built from scratch and lands on the board", async ({ seeded }) => {
  const page = await openBoard(seeded);
  const before = (await lastWidget(page)).count;

  await page.getByRole("button", { name: "Add widget" }).click();
  await expect(page.locator(".builder")).toBeVisible();

  /* Search narrows the source list rather than making you scroll 27 entries. */
  const allSources = await page.locator(".builder__source").count();
  expect(allSources, "every source should be offered").toBeGreaterThan(20);
  await page.locator("#bld-search").fill("spending");
  await expect.poll(() => page.locator(".builder__source").count()).toBeLessThan(allSources);

  await page.locator(".builder__source-title", { hasText: /^Spending by category$/ }).first().click();

  /* The preview renders through the same macro the board uses, so this is the
     widget, not a picture of one. */
  await expect
    .poll(async () => page.evaluate(() => {
      const b = document.querySelector(".builder__preview-grid .dash-widget__body");
      return !!b && !!(b.querySelector("canvas, svg") || (b.innerText || "").trim().length > 10);
    }), { timeout: 15000 })
    .toBe(true);

  await page.locator(".builder__seg", { hasText: "Table" }).first().click();
  await expect
    .poll(async () => page.evaluate(() =>
      !!document.querySelector(".builder__preview-grid .dash-widget__body table")
    ), { timeout: 8000 })
    .toBe(true);

  await page.locator("#bld-title").fill("Groceries trend");
  await page.getByRole("button", { name: "Add to dashboard" }).click();

  await expect.poll(async () => (await lastWidget(page)).count, { timeout: 5000 }).toBe(before + 1);
  const w = await lastWidget(page);
  expect(w.source).toBe("report:spending");
  expect(w.view, "the shape chosen in the dialog must be the shape stored").toBe("table");
  expect(w.title).toBe("Groceries trend");
});

test("reconfiguring a widget is one undo entry, and redraws", async ({ seeded }) => {
  const page = await openBoard(seeded);

  /* Place something with a known parameter, through the UI. */
  await page.getByRole("button", { name: "Add widget" }).click();
  await page.locator("#bld-search").fill("income");
  /* "Income vs expense" is a substring of the panel "Income vs expense
     (mini)", and panels are listed first - so match the title exactly or the
     test silently configures a different widget than it thinks. */
  await page.locator(".builder__source-title", { hasText: /^Income vs expense$/ }).first().click();
  await page.getByRole("button", { name: "Add to dashboard" }).click();
  await page.waitForTimeout(700);

  const created = await lastWidget(page);
  expect(created.params.count, "the source's declared default").toBe(6);

  const undoBefore = await page.evaluate(() => window.Alpine.store("budget")._undoStack.length);

  /* Reopen it via the widget's own Configure button. */
  await page.locator(`[data-widget-id="${await page.evaluate(() => {
    const d = window.Alpine.store("budget").activeDashboard();
    return d.widgets[d.widgets.length - 1].id;
  })}"] .dash-widget__config`).click();
  await expect(page.locator(".builder")).toBeVisible();

  await page.locator("#bld-p-count").fill("12");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect.poll(async () => (await lastWidget(page)).params.count, { timeout: 5000 }).toBe(12);

  const undoAfter = await page.evaluate(() => window.Alpine.store("budget")._undoStack.length);
  expect(
    undoAfter - undoBefore,
    "changing several fields at once is one decision, so one undo entry"
  ).toBe(1);
});

/* The headline capability: the same data twice, asked differently. This is
   what the params/settings split in the record shape exists to make correct -
   params feed the store's memo key, so two ranges cannot collide in cache. */
test("the same source can appear twice with different parameters", async ({ seeded }) => {
  const page = await openBoard(seeded);

  for (const months of ["6", "24"]) {
    await page.getByRole("button", { name: "Add widget" }).click();
    await page.locator("#bld-search").fill("net worth");
    await page.locator(".builder__source-title", { hasText: /^Net worth$/ }).first().click();
    await page.locator("#bld-p-count").fill(months);
    await page.locator("#bld-title").fill(`Net worth ${months}m`);
    await page.getByRole("button", { name: "Add to dashboard" }).click();
    await page.waitForTimeout(600);
  }

  const both = await page.evaluate(() => {
    const d = window.Alpine.store("budget").activeDashboard();
    const nw = d.widgets.filter((w) => w.source === "report:net-worth");
    return nw.map((w) => ({
      title: w.title,
      count: w.params.count,
      rows: window.Alpine.store("budget").widgetData(w).length,
    }));
  });

  expect(both).toHaveLength(2);
  expect(both[0].count).not.toBe(both[1].count);
  expect(both[0].rows, "different ranges must yield different data, not a shared cache entry")
    .not.toBe(both[1].rows);
});

/* The a11y ratchet caps `label` at 10 across the whole app and fails on any
   NEW rule id outright. The builder adds a dozen form controls, so it is
   exactly the kind of change that trips it - and axe never sees them in the
   normal sweep, because the dialog renders with x-if and does not exist until
   it is opened. This runs axe against the OPEN dialog specifically. */
test("the open builder introduces no new accessibility violations", async ({ seeded }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const page = await openBoard(seeded);

  const closed = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  await page.getByRole("button", { name: "Add widget" }).click();
  await expect(page.locator(".builder")).toBeVisible();
  await page.locator("#bld-search").fill("spending");
  await page.locator(".builder__source-title", { hasText: /^Spending by category$/ }).first().click();
  await page.waitForTimeout(800);

  const open = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const count = (res, id) => res.violations.filter((v) => v.id === id).reduce((n, v) => n + v.nodes.length, 0);

  /* Every control in the dialog is labelled. */
  expect(count(open, "label"), "an unlabelled control in the builder").toBe(count(closed, "label"));

  /* And no rule that was absent before appears now - the ratchet treats a new
     rule id as a hard failure, not a budgeted one. */
  const before = new Set(closed.violations.map((v) => v.id));
  const introduced = open.violations.map((v) => v.id).filter((id) => !before.has(id));
  expect(introduced, "the builder introduced a new class of violation").toEqual([]);
});
