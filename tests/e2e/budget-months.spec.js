/* Phase 2 of the budget revamp: parallel month columns.
   The user picks 1-3 visible months (Actual Budget's model); the
   anchor stays $store.budget.currentMonth, extra columns run FORWARD
   (anchor+1, anchor+2). Phones stay single-month. Written red against
   the single-month page. */
import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

const wide = (viewport) => viewport && viewport.width >= 1280;

test("picking 3 months renders three labelled columns with independent inputs", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "3 columns need >=1280");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  await page.getByRole("button", { name: "Show 3 months" }).click();
  await expect(page.locator(".budget__month-head")).toHaveCount(3);
  const labels = await page.locator(".budget__month-head").allTextContents();
  expect(labels.join(" ")).toMatch(/Mar/);
  expect(labels.join(" ")).toMatch(/Apr/);
  expect(labels.join(" ")).toMatch(/May/);
  /* Every editable category row carries one input per visible month. */
  const row = page.locator(".budget__row").filter({ has: page.locator('input[data-month="2026-03"]') }).first();
  await expect(row.locator("input[data-month='2026-04']")).toHaveCount(1);
  await expect(row.locator("input[data-month='2026-05']")).toHaveCount(1);
  await page.close();
});

test("editing a non-anchor column writes to THAT month and only that month", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "needs a second column");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  await page.getByRole("button", { name: "Show 2 months" }).click();
  const catId = await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    return s.profile.categories.find((c) => c.name === "Groceries").id;
  });
  const before = await page.evaluate((id) => {
    const s = window.Alpine.store("budget");
    return { m3: s.assignedFor(id, "2026-03"), m4: s.assignedFor(id, "2026-04") };
  }, catId);
  const input = page.locator(`.budget__row[data-cat-id="${catId}"] input[data-month="2026-04"]`);
  await input.click();
  await input.fill("123.45");
  await input.press("Enter");
  const after = await page.evaluate((id) => {
    const s = window.Alpine.store("budget");
    return { m3: s.assignedFor(id, "2026-03"), m4: s.assignedFor(id, "2026-04") };
  }, catId);
  expect(after.m4).toBe(12345);
  expect(after.m3).toBe(before.m3);
  await page.close();
});

test("a store write updates every visible column (the reactivity handshake)", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "needs a second column");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  await page.getByRole("button", { name: "Show 2 months" }).click();
  const catId = await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    return s.profile.categories.find((c) => c.name === "Groceries").id;
  });
  const pill = page.locator(`.budget__row[data-cat-id="${catId}"] [data-month="2026-04"].budget__available button`);
  const before = await pill.textContent();
  await page.evaluate((id) => window.Alpine.store("budget").assign(id, "2026-04", 777700), catId);
  await expect(pill).not.toHaveText(before, { timeout: 3000 });
  await page.close();
});

test("the URL still carries only the anchor month", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "needs multi-month");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  await page.getByRole("button", { name: "Show 3 months" }).click();
  await page.waitForTimeout(200);
  expect(new URL(page.url()).search).toBe("?m=2026-03");
  await page.close();
});

test("the month count survives a reload", async ({ seeded, viewport }) => {
  test.skip(!wide(viewport), "needs multi-month");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.getByRole("button", { name: "Show 2 months" }).click();
  await expect(page.locator(".budget__month-head")).toHaveCount(2);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Alpine?.store?.("budget")?.loading === false, { timeout: 8000 }).catch(() => {});
  await expect(page.locator(".budget__month-head")).toHaveCount(2);
  await page.close();
});

test("phones stay single-month with no horizontal overflow", async ({ seeded, viewport }) => {
  test.skip(!viewport || viewport.width >= 600, "phone-only assertion");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  /* Even with a stored preference for 3, the viewport clamps to 1. */
  await page.evaluate(() => { try { localStorage.setItem("projectbudget:budget-month-count", "3"); } catch (_e) {} });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Alpine?.store?.("budget")?.loading === false, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const months = await page.evaluate(() =>
    new Set([...document.querySelectorAll(".budget__row input[data-month]")].map((i) => i.dataset.month)).size
  );
  expect(months).toBe(1);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.close();
});
