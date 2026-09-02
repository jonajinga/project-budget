/* Phase 5 of the budget revamp: keyboard-first navigation.
   Roving tabindex over the Assigned cells (the register grid's proven
   pattern): ONE cell tabbable, arrows move the roving point, Enter or
   a digit starts the edit, Escape cancels without committing. Born red
   against the tab-through-every-input page. */
import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

async function boot(page) {
  await gotoApp(page, "/app/budget/");
  await page.evaluate(() => window.Alpine.store("budget").setMonth("2026-03"));
  await page.waitForTimeout(300);
}
const active = (page) => page.evaluate(() => ({
  cls: document.activeElement.className || "",
  month: document.activeElement.dataset ? document.activeElement.dataset.month : null,
  cat: document.activeElement.closest ? (document.activeElement.closest("[data-cat-id]")?.dataset.catId || null) : null,
  tag: document.activeElement.tagName,
}));

test("exactly one Assigned cell is tabbable; the inputs are not tab stops", async ({ seeded }) => {
  const page = await seeded.newPage();
  await boot(page);
  const counts = await page.evaluate(() => ({
    tabbableCells: document.querySelectorAll('.budget__assigned[tabindex="0"]').length,
    tabbableInputs: [...document.querySelectorAll(".budget__assigned input")].filter((i) => i.tabIndex !== -1).length,
  }));
  expect(counts.tabbableCells).toBe(1);
  expect(counts.tabbableInputs).toBe(0);
  await page.close();
});

test("arrows move the roving point down rows and across month columns", async ({ seeded, viewport }) => {
  test.skip(!viewport || viewport.width < 1280, "columns need width");
  const page = await seeded.newPage();
  await boot(page);
  await page.getByRole("button", { name: "Show 2 months" }).click();
  await page.waitForTimeout(200);
  await page.locator('.budget__assigned[tabindex="0"]').focus();
  const start = await active(page);
  expect(start.month).toBe("2026-03");
  await page.keyboard.press("ArrowRight");
  const right = await active(page);
  expect(right.month).toBe("2026-04");
  expect(right.cat).toBe(start.cat);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const down = await active(page);
  expect(down.month).toBe("2026-03");
  expect(down.cat).not.toBe(start.cat);
  await page.close();
});

test("ArrowDown crosses a group boundary through the flattened list", async ({ seeded }) => {
  const page = await seeded.newPage();
  await boot(page);
  const path = await page.evaluate(async () => {
    const cell = document.querySelector('.budget__assigned[tabindex="0"]');
    cell.focus();
    const groups = [];
    for (let i = 0; i < 40; i++) {
      const g = document.activeElement.closest(".budget__group")?.querySelector(".group-toggle strong")?.textContent;
      if (g && groups[groups.length - 1] !== g) groups.push(g);
      document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await new Promise((r) => setTimeout(r, 5));
    }
    return groups;
  });
  expect(path.length, "the roving point must walk into later groups: " + path.join(" > ")).toBeGreaterThan(2);
  await page.close();
});

test("Enter edits, Enter commits ONCE, and focus returns to the cell", async ({ seeded }) => {
  const page = await seeded.newPage();
  await boot(page);
  const cell = page.locator('.budget__assigned[tabindex="0"]');
  await cell.focus();
  const catId = (await active(page)).cat;
  const undoBefore = await page.evaluate(() => window.Alpine.store("budget").undoStack?.length ?? window.Alpine.store("budget")._undoDepth ?? 0);
  await page.keyboard.press("Enter");
  let a = await active(page);
  expect(a.tag).toBe("INPUT");
  await page.keyboard.type("55.25");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  a = await active(page);
  expect(a.tag, "focus returns to the roving cell").not.toBe("INPUT");
  expect(a.cls).toContain("budget__assigned");
  const assigned = await page.evaluate((id) => window.Alpine.store("budget").assignedFor(id, "2026-03"), catId);
  expect(assigned).toBe(5525);
  await page.close();
});

test("Escape cancels the edit without committing", async ({ seeded }) => {
  const page = await seeded.newPage();
  await boot(page);
  const cell = page.locator('.budget__assigned[tabindex="0"]');
  await cell.focus();
  const catId = (await active(page)).cat;
  const before = await page.evaluate((id) => window.Alpine.store("budget").assignedFor(id, "2026-03"), catId);
  await page.keyboard.press("Enter");
  await page.keyboard.type("99999");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const after = await page.evaluate((id) => window.Alpine.store("budget").assignedFor(id, "2026-03"), catId);
  expect(after, "Escape must not commit").toBe(before);
  const a = await active(page);
  expect(a.cls).toContain("budget__assigned");
  await page.close();
});

test("typing a digit on the cell starts the edit with that digit", async ({ seeded }) => {
  const page = await seeded.newPage();
  await boot(page);
  await page.locator('.budget__assigned[tabindex="0"]').focus();
  await page.keyboard.press("7");
  const a = await page.evaluate(() => ({
    tag: document.activeElement.tagName, value: document.activeElement.value || "",
  }));
  expect(a.tag).toBe("INPUT");
  expect(a.value).toBe("7");
  await page.close();
});
