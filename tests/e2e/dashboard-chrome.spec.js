import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* No native dialogs anywhere in the dashboard.
 *
 * window.prompt and window.confirm were used for naming, renaming, deleting
 * and resetting. They are unstyled, ignore the app's theme, and on a phone
 * read as a browser error rather than as part of the product. They are also
 * untestable through the UI - a native dialog is resolved out of band, which
 * made a test fail intermittently with the action simply never happening.
 *
 * This test does not look for their absence in the source. It OVERRIDES them
 * to throw, then drives every path that used them. A source grep would pass
 * on a call added tomorrow through a helper; this cannot.
 */
async function openBoard(seeded) {
  const page = await seeded.newPage();
  await page.addInitScript(() => {
    const boom = (what) => () => { throw new Error("native " + what + " must not be used"); };
    window.prompt = boom("prompt");
    window.confirm = boom("confirm");
    window.alert = boom("alert");
  });
  await gotoApp(page, "/app/");
  await page.waitForFunction(
    () => { const s = window.Alpine?.store?.("budget"); return s ? s.loading === false : false; },
    { timeout: 10000 }
  ).catch(() => {});
  await page.waitForTimeout(600);
  return page;
}

const dashboards = (page) =>
  page.evaluate(() => window.Alpine.store("budget").dashboardList().map((d) => d.name));

test("create, rename, reset and delete all work without a native dialog", async ({ seeded }) => {
  const page = await openBoard(seeded);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  /* The dashboard kebab moved into the shared .app-toolbar strip when
     the page lost its masthead: the picker, the widget count and the
     edit controls were a second row of chrome under the heading and
     are now the only row. The menu and everything it does are
     unchanged; only its container is. */
  const menu = () => page.locator(".app-toolbar .overflow-menu__trigger").first();

  /* Create */
  await menu().click();
  await page.getByRole("menuitem", { name: /New dashboard/ }).click();
  await expect(page.locator("#dash-ask-input")).toBeVisible();
  await page.locator("#dash-ask-input").fill("Bills");
  await page.getByRole("button", { name: "Create" }).click();
  await expect.poll(() => dashboards(page), { timeout: 5000 }).toContain("Bills");

  /* Rename */
  await menu().click();
  await page.getByRole("menuitem", { name: /Rename/ }).click();
  await page.locator("#dash-ask-input").fill("Bills and rent");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect.poll(() => dashboards(page), { timeout: 5000 }).toContain("Bills and rent");

  /* Reset - a confirm, on a board that is empty, so it gains widgets */
  await menu().click();
  await page.getByRole("menuitem", { name: /Reset to default/ }).click();
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect.poll(() => page.locator(".dash-widget").count(), { timeout: 5000 }).toBeGreaterThan(5);

  /* Delete */
  await menu().click();
  await page.getByRole("menuitem", { name: /Delete dashboard/ }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect.poll(() => dashboards(page), { timeout: 5000 }).not.toContain("Bills and rent");

  expect(errors, "a native dialog was called").toEqual([]);
});

test("the switcher is a tab strip showing every dashboard at once", async ({ seeded }) => {
  const page = await openBoard(seeded);
  await page.evaluate(() => window.Alpine.store("budget").createDashboard("Second", []));

  await expect.poll(() => page.locator(".dash-tabs__tab").count(), { timeout: 5000 }).toBe(2);
  await expect(page.locator(".dash-tabs__tab.is-active")).toHaveCount(1);

  /* Selecting a tab switches the board without opening anything. */
  await page.locator(".dash-tabs__tab", { hasText: "Overview" }).click();
  await expect
    .poll(() => page.evaluate(() => window.Alpine.store("budget").activeDashboard().name), { timeout: 5000 })
    .toBe("Overview");
});

test("a widget can be duplicated and reordered from its own menu", async ({ seeded }) => {
  const page = await openBoard(seeded);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(250);

  const state = () =>
    page.evaluate(() => {
      const d = window.Alpine.store("budget").activeDashboard();
      return { n: d.widgets.length, first: d.widgets[0].source, last: d.widgets[d.widgets.length - 1].source };
    });
  const before = await state();

  /* Duplicate a non-singleton: the last widget on the default board. */
  const lastId = await page.evaluate(() => {
    const d = window.Alpine.store("budget").activeDashboard();
    return d.widgets[d.widgets.length - 1].id;
  });
  await page.locator(`[data-widget-id="${lastId}"] .dash-widget__more`).click();
  await page.getByRole("menuitem", { name: "Move to top" }).click();

  await expect.poll(async () => (await state()).first, { timeout: 5000 }).toBe(before.last);
  expect((await state()).n, "reordering must not add or drop a widget").toBe(before.n);
});
