import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* These lock the structural invariants of the announcement system.
 *
 * Screen-reader announcements themselves cannot be automated -- but the
 * STRUCTURAL bug that silences them can be. Today `.toast-stack` carries
 * aria-live while being x-show + x-cloak gated, so it is display:none at
 * registration and is revealed in the same tick its content arrives: the
 * classic pattern that announces nothing.
 *
 * Every test here is marked test.fail() because it describes the Phase 2
 * target state, not today's. Playwright fails the run if a test.fail() test
 * unexpectedly PASSES -- so when Phase 2 lands the announcers, these turn red
 * until the marker is removed. That is the forcing function.
 */

test.describe("live region structure (Phase 2 target)", () => {
  test.fail();

  test("a permanent polite announcer exists and is never display:none", async ({ seeded }) => {
    const page = await seeded.newPage();
    await gotoApp(page, "/app/");
    const state = await page.evaluate(() => {
      const el = document.getElementById("pb-live-polite");
      if (!el) return { present: false };
      const cs = getComputedStyle(el);
      return {
        present: true,
        display: cs.display,
        hidden: el.hasAttribute("hidden"),
        cloak: el.hasAttribute("x-cloak"),
        live: el.getAttribute("aria-live"),
      };
    });
    expect(state.present, "#pb-live-polite must exist").toBe(true);
    expect(state.display, "announcer must never be display:none").not.toBe("none");
    expect(state.hidden).toBe(false);
    expect(state.cloak).toBe(false);
    expect(state.live).toBe("polite");
    await page.close();
  });

  test("the visual toast stack carries no live-region roles", async ({ seeded }) => {
    const page = await seeded.newPage();
    await gotoApp(page, "/app/");
    const leftover = await page.evaluate(() => {
      const stack = document.querySelector(".toast-stack");
      if (!stack) return ["no .toast-stack found"];
      const bad = [];
      if (stack.hasAttribute("aria-live")) bad.push("stack has aria-live");
      if (stack.hasAttribute("aria-atomic")) bad.push("stack has aria-atomic");
      for (const el of stack.querySelectorAll('[role="status"], [aria-live]')) {
        bad.push("descendant " + el.className + " has a live role");
      }
      return bad;
    });
    expect(leftover, "toasts should be purely visual once announce() exists").toEqual([]);
    await page.close();
  });

  test("triggering a toast writes into the announcer", async ({ seeded }) => {
    const page = await seeded.newPage();
    await gotoApp(page, "/app/");
    await page.evaluate(() => window.Alpine.store("budget").pushToast("Test announcement", "info"));
    await page.waitForTimeout(300);
    const text = await page.evaluate(
      () => document.getElementById("pb-live-polite")?.textContent || ""
    );
    expect(text, "pushToast must route through announce()").toContain("Test announcement");
    await page.close();
  });
});
