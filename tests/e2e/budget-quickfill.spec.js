/* Phase 4 of the budget revamp: quick-budget fills, the RTA overview
   with one-click overspending cover, and hide/unhide. Written red. */
import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

const wide = (viewport) => viewport && viewport.width >= 1180;

async function catIdOf(page, name) {
  const id = await page.evaluate((n) => {
    const s = window.Alpine.store("budget");
    const hit = s.profile.categories.find((c) => c.name === n);
    return hit ? hit.id : null;
  }, name);
  /* A named lookup that misses used to throw "Cannot read properties of
     undefined (reading 'id')", which says nothing about the cause. The
     sample's categories get reworked; "Coffee" and "HOA" were both
     renamed away and three tests failed on that TypeError for months. */
  if (!id) throw new Error(`no category named "${name}" in the sample profile`);
  return id;
}

/* Pick a category by shape rather than by name, so a rename to the
   sample does not break the test again. Skips payment and income
   categories, whose Assigned cells behave differently on purpose. */
async function anyPlainCatId(page, exclude = []) {
  const id = await page.evaluate((skip) => {
    const s = window.Alpine.store("budget");
    const hit = (s.profile.categories || []).find((c) =>
      !skip.includes(c.name) && !c.hidden && !s.paymentCardId(c.id) && !s.isIncomeCategory(c.id));
    return hit ? hit.id : null;
  }, exclude);
  if (!id) throw new Error("the sample has no plain expense category");
  return id;
}

/* Make a category overspent in `month` rather than hunting for one.
   Nothing in the sample is overspent in any 2026 month - the test used
   to rely on "HOA is overspent in 2026-03 (available -$9.00)", which
   stopped being true. Arranging it is both truer to what is under test
   and immune to the next data refresh. */
async function makeOverspent(page, month) {
  const id = await anyPlainCatId(page);
  await page.evaluate(({ id, month }) => {
    const s = window.Alpine.store("budget");
    const row = s.categoryRow(id, month);
    s.assign(id, month, row.assigned - row.available - 900);
  }, { id, month });
  await page.waitForTimeout(200);
  return id;
}

test("a quick fill sets the cell and ONE undo reverts it wholly", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  const catId = await catIdOf(page, "Groceries");
  const before = await page.evaluate((id) => {
    const s = window.Alpine.store("budget");
    return { assigned: s.assignedFor(id, "2026-03"), spent: s.quickLastMonthSpent(id, "2026-03") };
  }, catId);
  expect(before.spent).toBeGreaterThan(0);
  await page.locator(`.budget__row[data-cat-id="${catId}"] .budget__cat-name`).click();
  await page.getByRole("button", { name: /Last month's spending/ }).click();
  const after = await page.evaluate((id) => window.Alpine.store("budget").assignedFor(id, "2026-03"), catId);
  expect(after).toBe(before.spent);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await page.waitForTimeout(300);
  const reverted = await page.evaluate((id) => window.Alpine.store("budget").assignedFor(id, "2026-03"), catId);
  expect(reverted, "one undo restores the pre-fill value").toBe(before.assigned);
  await page.close();
});

test("the RTA stat opens the month overview and its breakdown adds up", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  await page.getByRole("button", { name: /^Ready to Work in / }).click();
  const pane = page.locator(".budget-inspector");
  const shown = await page.evaluate(() => {
    /* Five lines, not three. The panel opens with "Left over from
       <prev month>" - the carried balance - and the test used to model
       only inflow, assigned and lost, so its arithmetic was short by
       the whole carry and it compared 1,799,819 against a displayed
       75,958. The app was right.

       Signs: assigned and lost are rendered with a hard "-" prefix and
       are magnitudes, so they are taken as absolute. carried and rta
       are rendered signed and must keep their sign - a negative Ready
       to Work is a real state and absolute values would hide it. */
    const num = (t) => Math.round(parseFloat(t.replace(/[$,+]/g, "")) * 100);
    const g = (n) => num(document.querySelector(`[data-rta="${n}"]`).textContent);
    return {
      carried: g("carried"),
      inflow: Math.abs(g("inflow")),
      assigned: Math.abs(g("assigned")),
      lost: Math.abs(g("lost")),
      rta: g("rta"),
    };
  });
  /* What this proves, and what it does not. At the domain level the sum
     is a tautology: monthSummary derives `lost` as
     carried + inflow - assigned - rta, so the five numbers reconcile by
     construction and no arithmetic bug could show up here. Its teeth are
     at the DOM level - it catches a data-rta binding pointing at the
     wrong field. Verified: rebinding "lost" to `ahead` fails it. The
     assertion below, against the store, is the one that checks a
     number. */
  expect(shown.carried + shown.inflow - shown.assigned - shown.lost).toBe(shown.rta);
  const real = await page.evaluate(() => window.Alpine.store("budget").readyToAssign("2026-03"));
  expect(shown.rta).toBe(real);
  await pane.locator("[data-rta]").first().waitFor();
  await page.close();
});

test("covering an overspent category zeroes its pill in one click", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  const hoaId = await makeOverspent(page, "2026-03");
  const availBefore = await page.evaluate((id) => window.Alpine.store("budget").categoryRow(id, "2026-03").available, hoaId);
  expect(availBefore).toBeLessThan(0);
  await page.getByRole("button", { name: /^Ready to Work in / }).click();
  const row = page.locator(".budget-inspector [data-overspent-id='" + hoaId + "']");
  await row.getByRole("button", { name: /Cover / }).click();
  await page.waitForTimeout(300);
  const availAfter = await page.evaluate((id) => window.Alpine.store("budget").categoryRow(id, "2026-03").available, hoaId);
  expect(availAfter).toBe(0);
  await page.close();
});

test("a category can be hidden from the UI and unhidden again", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "drives the docked inspector's Hide button");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  const catId = await anyPlainCatId(page, ["Groceries"]);
  const hiddenBefore = await page.evaluate(() => window.Alpine.store("budget").hiddenCategories().length);
  const catName = await page.evaluate((id) => window.Alpine.store("budget").categoryName(id), catId);
  await page.locator(`.budget__row[data-cat-id="${catId}"] .budget__cat-name`).click();
  /* Hide, rename and delete moved behind the inspector's "Category
     actions" kebab; they are menu items now, not buttons sitting on
     the pane. */
  await page.locator(".budget-inspector").getByRole("button", { name: "Category actions" }).click();
  await page.locator(".budget-inspector").getByRole("menuitem", { name: "Hide category" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator(`.budget__row[data-cat-id="${catId}"]`)).toHaveCount(0);
  /* The disclosure below the grid lists it and unhides it. Counted
     relative to what was already hidden, not against a hard-coded 1:
     the sample ships two hidden categories of its own, so this waited
     forever for "Hidden categories (1)" while the button said 3. And
     the row is found by its category rather than by taking the first
     Unhide button, because there are now three of them. */
  await expect
    .poll(() => page.evaluate(() => window.Alpine.store("budget").hiddenCategories().length))
    .toBe(hiddenBefore + 1);
  await page.getByRole("button", { name: /^Hidden categories \(/ }).click();
  await page
    .locator(".budget__hidden li, .budget__hidden tr")
    .filter({ hasText: catName })
    .getByRole("button", { name: "Unhide" })
    .click();
  await page.waitForTimeout(300);
  await expect(page.locator(`.budget__row[data-cat-id="${catId}"]`)).toHaveCount(1);
  await page.close();
});
