/* Phase 6 of the budget revamp: reduction planning ("planned cuts") -
   the feature that is ours, not parity. Mark a category with a $/%
   monthly reduction target; the row wears a badge, the month overview
   shows the portfolio impact including age of money. Born red. */
import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

const wide = (viewport) => viewport && viewport.width >= 1180;

async function boot(page) {
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  await page.waitForTimeout(300);
}

test("planning a cut from the pane badges the row and reaches the persisted payload", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await boot(page);
  const catId = await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    return s.profile.categories.find((c) => c.name === "Dining out").id;
  });
  await page.locator(`.budget__row[data-cat-id="${catId}"] .budget__cat-name`).click();
  const pane = page.locator(".budget-inspector");
  await pane.locator("#insp-cut-mode").selectOption("percent");
  await pane.locator("#insp-cut-value").fill("25");
  await pane.locator("#insp-cut-goal").fill("Vacation fund");
  await pane.getByRole("button", { name: "Save cut" }).click();
  await page.waitForTimeout(300);
  const cut = await page.evaluate((id) => window.Alpine.store("budget").cutForCategory(id), catId);
  expect(cut.mode).toBe("percent");
  expect(cut.value).toBe(2500);
  expect(cut.goalLabel).toBe("Vacation fund");
  await expect(page.locator(`.budget__row[data-cat-id="${catId}"] .cut-badge`)).toBeVisible();
  /* Persisted (saves are debounced + compressed; the fixture re-seeds
     localStorage on navigation, so assert on the payload). */
  await page.waitForFunction(() => {
    try {
      const key = "projectbudget:profile:" + localStorage.getItem("projectbudget:active");
      const raw = localStorage.getItem(key) || "";
      const json = raw.startsWith("PB2:") ? window.LZString.decompressFromUTF16(raw.slice(4)) : raw;
      return !!json && json.includes("Vacation fund");
    } catch (_e) { return false; }
  }, { timeout: 8000 });
  await page.close();
});

test("the month overview shows the portfolio impact and it matches the store", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await boot(page);
  await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    const dining = s.profile.categories.find((c) => c.name === "Dining out");
    const coffee = s.profile.categories.find((c) => c.name === "Coffee");
    s.addCut({ categoryId: dining.id, mode: "percent", value: 2500 });
    s.addCut({ categoryId: coffee.id, mode: "amount", value: 2000 });
  });
  await page.getByRole("button", { name: /Ready to assign/ }).click();
  await page.waitForTimeout(300);
  const shown = await page.evaluate(() => {
    const cents = (t) => Math.abs(Math.round(parseFloat(t.replace(/[$,+]/g, "")) * 100));
    const g = (n) => cents(document.querySelector(`[data-cuts="${n}"]`).textContent);
    return { planned: g("planned"), realized: g("realized"), annual: g("annual") };
  });
  const real = await page.evaluate(() => window.Alpine.store("budget").cutsSummaryFor("2026-03"));
  expect(shown.planned).toBe(real.monthlyPlanned);
  expect(shown.realized).toBe(real.monthlyRealized);
  expect(shown.annual).toBe(real.annualPlanned);
  expect(real.monthlyPlanned).toBeGreaterThan(0);
  /* Age of money renders (a number of days, current and projected). */
  const aom = await page.locator("[data-cuts='aom']").textContent();
  expect(aom).toMatch(/\d+ days/);
  await page.close();
});

test("removing a cut clears the badge", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await boot(page);
  const catId = await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    const c = s.profile.categories.find((x) => x.name === "Dining out");
    s.addCut({ categoryId: c.id, mode: "amount", value: 5000 });
    return c.id;
  });
  await expect(page.locator(`.budget__row[data-cat-id="${catId}"] .cut-badge`)).toBeVisible();
  await page.locator(`.budget__row[data-cat-id="${catId}"] .budget__cat-name`).click();
  await page.locator(".budget-inspector").getByRole("button", { name: "Remove cut" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator(`.budget__row[data-cat-id="${catId}"] .cut-badge`)).toBeHidden();
  await page.close();
});
