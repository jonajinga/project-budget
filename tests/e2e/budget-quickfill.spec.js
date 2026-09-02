/* Phase 4 of the budget revamp: quick-budget fills, the RTA overview
   with one-click overspending cover, and hide/unhide. Written red. */
import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

const wide = (viewport) => viewport && viewport.width >= 1180;

async function catIdOf(page, name) {
  return page.evaluate((n) => {
    const s = window.Alpine.store("budget");
    return s.profile.categories.find((c) => c.name === n).id;
  }, name);
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
  await page.getByRole("button", { name: /Ready to assign/ }).click();
  const pane = page.locator(".budget-inspector");
  const shown = await page.evaluate(() => {
    /* assigned + lost display with a minus prefix (they are
       deductions); the arithmetic uses magnitudes. */
    const cents = (t) => Math.abs(Math.round(parseFloat(t.replace(/[$,]/g, "")) * 100));
    const g = (n) => cents(document.querySelector(`[data-rta="${n}"]`).textContent);
    return { inflow: g("inflow"), assigned: g("assigned"), lost: g("lost"), rta: g("rta") };
  });
  expect(shown.inflow - shown.assigned - shown.lost).toBe(shown.rta);
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
  /* HOA is overspent in 2026-03 in the sample (available -$9.00). */
  const hoaId = await catIdOf(page, "HOA");
  const availBefore = await page.evaluate((id) => window.Alpine.store("budget").categoryRow(id, "2026-03").available, hoaId);
  expect(availBefore).toBeLessThan(0);
  await page.getByRole("button", { name: /Ready to assign/ }).click();
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
  const catId = await catIdOf(page, "Coffee");
  await page.locator(`.budget__row[data-cat-id="${catId}"] .budget__cat-name`).click();
  await page.locator(".budget-inspector").getByRole("button", { name: "Hide category" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator(`.budget__row[data-cat-id="${catId}"]`)).toHaveCount(0);
  /* The disclosure below the grid lists it and unhides it. */
  await page.getByRole("button", { name: /Hidden categories \(1\)/ }).click();
  await page.locator(".budget__hidden").getByRole("button", { name: "Unhide" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator(`.budget__row[data-cat-id="${catId}"]`)).toHaveCount(1);
  await page.close();
});
