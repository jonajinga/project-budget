import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* The register's editable cells were <td @click> with no tabindex, role or
   keydown, and register-view.js had no keyboard handling at all -- so the
   main data grid of a budgeting app could only be edited with a mouse.
   shortcuts.njk documented Tab-to-next-cell that was never implemented. */

const desktopOnly = (viewport) => !viewport || viewport.width < 900;

test("exactly one cell is tabbable at a time", async ({ seeded, viewport }) => {
  test.skip(desktopOnly(viewport), "the table only renders on desktop");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/register/");
  await page.waitForTimeout(600);
  const counts = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".register__table td.cell--edit")];
    return {
      total: cells.length,
      tabbable: cells.filter((c) => c.getAttribute("tabindex") === "0").length,
    };
  });
  expect(counts.total, "cells should render").toBeGreaterThan(10);
  expect(counts.tabbable, "roving tabindex means exactly one entry point").toBe(1);
  await page.close();
});

test("arrow keys move across and down the grid", async ({ seeded, viewport }) => {
  test.skip(desktopOnly(viewport), "the table only renders on desktop");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/register/");
  await page.waitForTimeout(600);

  await page.evaluate(() => document.querySelector('td.cell--edit[tabindex="0"]').focus());
  const start = await page.evaluate(() => document.activeElement.dataset.cell);
  expect(start).toMatch(/:date$/);

  await page.keyboard.press("ArrowRight");
  expect(await page.evaluate(() => document.activeElement.dataset.cell)).toMatch(/:accountId$/);

  await page.keyboard.press("End");
  expect(await page.evaluate(() => document.activeElement.dataset.cell)).toMatch(/:amount$/);

  await page.keyboard.press("Home");
  expect(await page.evaluate(() => document.activeElement.dataset.cell)).toMatch(/:date$/);

  const rowBefore = start.split(":")[0];
  await page.keyboard.press("ArrowDown");
  const after = await page.evaluate(() => document.activeElement.dataset.cell);
  expect(after.split(":")[0], "ArrowDown should change row").not.toBe(rowBefore);
  expect(after).toMatch(/:date$/);
  await page.close();
});

test("Enter opens the editor and Enter commits, returning focus to the cell", async ({ seeded, viewport }) => {
  test.skip(desktopOnly(viewport), "the table only renders on desktop");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/register/");
  await page.waitForTimeout(600);

  /* Walk to a memo cell: free text, so committing cannot fail validation. */
  await page.evaluate(() => document.querySelector('td.cell--edit[tabindex="0"]').focus());
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  const cell = await page.evaluate(() => document.activeElement.dataset.cell);
  expect(cell).toMatch(/:memo$/);

  await page.keyboard.press("Enter");
  /* The editor input does not exist until Alpine renders it, so focusing it
     legitimately waits a tick -- unlike cell-to-cell movement, which is
     synchronous because every cell is already in the DOM. */
  await page.waitForFunction(
    () => document.activeElement && document.activeElement.matches("input, select"),
    { timeout: 3000 }
  );

  await page.keyboard.type("keyboard test");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  const landed = await page.evaluate(() => ({
    cell: document.activeElement.dataset ? document.activeElement.dataset.cell : null,
    tag: document.activeElement.tagName,
  }));
  expect(landed.tag, "focus must not fall to body").not.toBe("BODY");
  expect(landed.cell, "focus returns to the cell it came from").toBe(cell);
  await page.close();
});

test("Escape closes the editor without committing", async ({ seeded, viewport }) => {
  test.skip(desktopOnly(viewport), "the table only renders on desktop");
  const page = await seeded.newPage();
  await gotoApp(page, "/app/register/");
  await page.waitForTimeout(600);

  await page.evaluate(() => document.querySelector('td.cell--edit[tabindex="0"]').focus());
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  const cell = await page.evaluate(() => document.activeElement.dataset.cell);
  const before = await page.evaluate((c) =>
    document.querySelector(`[data-cell="${c}"]`).innerText.trim(), cell);

  await page.keyboard.press("Enter");
  await page.keyboard.type("discard me");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const after = await page.evaluate((c) =>
    document.querySelector(`[data-cell="${c}"]`).innerText.trim(), cell);
  expect(after, "Escape must not commit").toBe(before);
  expect(await page.evaluate(() => document.activeElement.dataset.cell)).toBe(cell);
  await page.close();
});
