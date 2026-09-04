/* Phase 3 of the budget revamp: the persistent inspector.
   Desktop >=1180 gets a right-hand pane that replaces the Goal modal,
   the row-path Move-money modal, and the per-category activity
   drill-down; below 1180 the same content opens as a bottom sheet on
   the app's modal chrome (1180, not the planned 1024: sidebar + pane
   leave ~370px of table at 1024 - measured, unusable). */
import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

const desktopWide = (viewport) => viewport && viewport.width >= 1180;

async function selectGroceries(page) {
  const catId = await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    return s.profile.categories.find((c) => c.name === "Groceries").id;
  });
  await page.locator(`.budget__row[data-cat-id="${catId}"] .budget__cat-name`).click();
  return catId;
}

test("selecting a category shows a breakdown that adds up to Available", async ({ seeded, viewport }) => {
  test.skip(!desktopWide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  const catId = await selectGroceries(page);
  const pane = page.locator(".budget-inspector");
  /* .budget-inspector__title is the MONTH OVERVIEW heading, rendered
     only when nothing is selected. With a category selected the pane
     titles itself with .insp__title. */
  await expect(pane.locator(".insp__title")).toContainText("Groceries");
  const shown = await page.evaluate(() => {
    const cents = (t) => Math.round(parseFloat(t.replace(/[$,]/g, "")) * 100);
    const g = (n) => cents(document.querySelector(`[data-break="${n}"]`).textContent);
    return { carryIn: g("carryIn"), assigned: g("assigned"), activity: g("activity"), available: g("available") };
  });
  const real = await page.evaluate((id) => window.Alpine.store("budget").categoryRow(id, "2026-03"), catId);
  expect(shown.carryIn).toBe(real.carryIn);
  expect(shown.assigned).toBe(real.assigned);
  expect(shown.activity).toBe(real.activity);
  expect(shown.available).toBe(real.available);
  expect(shown.carryIn + shown.assigned + shown.activity).toBe(shown.available);
  await page.close();
});

test("a category note reaches the persisted profile payload", async ({ seeded, viewport }) => {
  test.skip(!desktopWide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await selectGroceries(page);
  /* Two textareas now: the category note (every month) and a
     month-scoped one. This test is about the category note. */
  /* The pane groups its sections behind disclosures now, so the field
     is in the DOM while its section is shut - which is why this used
     to resolve a locator and then time out waiting for it to become
     editable, rather than failing to find it. */
  await page.locator(".budget-inspector").getByRole("button", { name: /^Notes/ }).click();
  const note = page.locator("#insp-note");
  await note.fill("Costco run twice a month");
  await note.blur();
  /* Cannot assert via reload here: the seeded fixture's init script
     re-writes the ORIGINAL profile into localStorage on every
     navigation (fixtures.js documents this), so any reload loads the
     pre-note copy - a harness artifact, not a product path. Instead
     decompress the actually-persisted payload (saves are debounced
     400ms and LZ-compressed with a "PB2:" prefix) and assert the note
     is in it; unit tests pin that the load path keeps the field. */
  await page.waitForFunction(() => {
    try {
      const key = "projectbudget:profile:" + localStorage.getItem("projectbudget:active");
      const raw = localStorage.getItem(key) || "";
      const json = raw.startsWith("PB2:")
        ? window.LZString.decompressFromUTF16(raw.slice(4))
        : raw;
      return !!json && json.includes("Costco run twice a month");
    } catch (_e) { return false; }
  }, { timeout: 8000 });
  await page.close();
});

test("editing the goal from the pane updates the row badge", async ({ seeded, viewport }) => {
  test.skip(!desktopWide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  const catId = await selectGroceries(page);
  const pane = page.locator(".budget-inspector");
  /* The goal form is behind a disclosure that reads "Goal <summary>";
     the field exists in the DOM while it is shut, which is why this
     resolved a locator and then timed out waiting for it to be
     editable rather than failing to find it. */
  await pane.getByRole("button", { name: /^Goal/ }).click();
  await pane.locator("#insp-goal-target").fill("9999");
  await pane.getByRole("button", { name: "Save goal" }).click();
  await page.waitForTimeout(300);
  const target = await page.evaluate((id) => {
    const s = window.Alpine.store("budget");
    return s.findGoal(id).target;
  }, catId);
  expect(target).toBe(999900);
  await expect(page.locator(`.budget__row[data-cat-id="${catId}"] .goal-bar:not(.goal-bar--cut)`)).toBeVisible();
  await page.close();
});

test("moving money inline from the pane lands on the selected month", async ({ seeded, viewport }) => {
  test.skip(!desktopWide(viewport), "docked inspector needs >=1180");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  const catId = await selectGroceries(page);
  const toId = await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    return s.profile.categories.find((c) => c.name === "Dining out").id;
  });
  const before = await page.evaluate(([a, b]) => {
    const s = window.Alpine.store("budget");
    return { from: s.assignedFor(a, "2026-03"), to: s.assignedFor(b, "2026-03") };
  }, [catId, toId]);
  const pane = page.locator(".budget-inspector");
  await pane.getByRole("button", { name: /^Move money/ }).click();
  await pane.locator("#insp-mv-to").selectOption(toId);
  await pane.locator("#insp-mv-amount").fill("25");
  /* "Move", not "Move money" - that is the disclosure opened above, and
     clicking it a second time just shut the section again. */
  await pane.getByRole("button", { name: "Move", exact: true }).click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(([a, b]) => {
    const s = window.Alpine.store("budget");
    return { from: s.assignedFor(a, "2026-03"), to: s.assignedFor(b, "2026-03") };
  }, [catId, toId]);
  expect(after.from).toBe(before.from - 2500);
  expect(after.to).toBe(before.to + 2500);
  await page.close();
});

test("below 1024 the inspector opens as a focus-trapped sheet and Escape closes it", async ({ seeded, viewport }) => {
  test.skip(!viewport || viewport.width >= 1180, "sheet is the sub-1180 presentation");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/budget/");
  await selectGroceries(page);
  const sheet = page.locator(".modal--sheet");
  await expect(sheet).toBeVisible({ timeout: 3000 });
  /* Focus must be inside the sheet (the modal chrome's trap). */
  await page.waitForTimeout(300);
  const focusInside = await page.evaluate(() =>
    !!document.activeElement && !!document.activeElement.closest(".modal--sheet")
  );
  expect(focusInside).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await page.close();
});
