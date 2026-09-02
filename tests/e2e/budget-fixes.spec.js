/* Phase 0 correctives for the budget revamp. Each of these was written
   red against the shipped page:
   - the empty-state CTA set newGroupOpen inside a hasCategories-gated
     section, so a brand-new profile's only button opened nothing
   - all nine modals lived inside the budgetCollapsed wrapper, so
     collapsing the grid silently disabled their still-visible triggers
   - the year arrows were the only way across a year boundary and landed
     on the same month number of the next year (2025-12 -> 2026-12)
   - keyboard reorder queried .dnd-handle markup that does not exist and
     dropped focus to <body> on every Move up / Move down
   - income categories rendered an editable Assigned input that
     auto-assign and the bulk helpers refuse to touch */
import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

test("empty profile: the empty-state CTA opens the New group modal", async ({ empty }) => {
  const page = await empty.newPage();
  await gotoApp(page, "/app/budget/");
  await page.getByRole("button", { name: /Add a category group/i }).click();
  await expect(page.locator("#bd-group-name")).toBeVisible({ timeout: 3000 });
  await page.close();
});

test("collapsed grid: Auto-assign still opens its modal", async ({ seeded }) => {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.getByRole("button", { name: /Collapse budget grid/ }).click();
  await page.locator(".budget__toolbar").getByRole("button", { name: "Auto-assign" }).click();
  await expect(page.locator("#bd-auto-title")).toBeVisible({ timeout: 3000 });
  await page.close();
});

test("single-step month arrow crosses the year boundary", async ({ seeded }) => {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2025-12"));
  await page.getByRole("button", { name: "Next month" }).click();
  const m = await page.evaluate(() => window.Alpine.store("budget").currentMonth);
  expect(m).toBe("2026-01");
  await page.close();
});

test("keyboard reorder restores focus instead of dropping it to body", async ({ seeded }) => {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  const trigger = page.locator(".budget__row .overflow-menu__trigger").first();
  await trigger.click();
  await page.getByRole("menuitem", { name: "Move down" }).click();
  /* Focus restore runs in $nextTick; give it a beat. */
  await page.waitForTimeout(150);
  const active = await page.evaluate(
    () => (document.activeElement ? document.activeElement.className : "(none)")
  );
  expect(active, "focus must land back on the row's menu trigger").toContain("overflow-menu__trigger");
  await page.close();
});

test("income categories render a read-only Assigned value, not an input", async ({ seeded }) => {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  const incomeCatId = await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    const cat = (s.profile.categories || []).find((c) => s.isIncomeCategory(c.id));
    return cat ? cat.id : null;
  });
  expect(incomeCatId, "the sample must have an income category").toBeTruthy();
  const row = page.locator(`.budget__row[data-cat-id="${incomeCatId}"]`);
  await expect(row.locator(".budget__assigned input")).toHaveCount(0);
  await expect(row.locator(".budget__assigned .budget__assigned-locked")).toHaveCount(1);
  await page.close();
});
