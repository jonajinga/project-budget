import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";

/* Phase 1: first run is a choice, not an assumption.
   Previously store.js silently fetched and activated a 723KB sample
   household for anyone with no profiles. */

test("a brand-new visitor is asked, not given someone else's data", async ({ virgin }) => {
  const page = await virgin.newPage();
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/app/welcome/", { timeout: 10000 });
  expect(page.url()).toContain("/app/welcome/");

  const choices = await page.evaluate(() =>
    [...document.querySelectorAll(".card button, .card a.btn")]
      .map((b) => b.textContent.trim())
      .filter(Boolean)
  );
  expect(choices.join(" | ")).toContain("Start with an empty budget");
  expect(choices.join(" | ")).toContain("Explore a sample budget");
  expect(choices.join(" | ")).toContain("Import a backup");
  await page.close();
});

test("no sample profile is loaded before the visitor picks one", async ({ virgin }) => {
  const page = await virgin.newPage();
  await page.goto("/app/welcome/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => {
    const s = window.Alpine.store("budget");
    return { profiles: s.profiles.length, profile: s.profile ? s.profile.name : null };
  });
  expect(state.profiles, "nothing should be seeded unasked").toBe(0);
  expect(state.profile).toBeNull();
  await page.close();
});

test("choosing the sample loads it and lands on the dashboard", async ({ virgin }) => {
  const page = await virgin.newPage();
  await page.goto("/app/welcome/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.Alpine?.store?.("budget"), { timeout: 10000 });
  await page.getByRole("button", { name: /Explore a sample budget/i }).click();
  await page.waitForURL((u) => u.pathname === "/app/", { timeout: 30000 });
  /* waitForURL resolves while the new document is still booting; wait for the
     store to exist there before reading it. */
  await page.waitForFunction(
    () => window.Alpine?.store?.("budget")?.profile?.transactions?.length > 0,
    { timeout: 30000 }
  );
  const txns = await page.evaluate(
    () => window.Alpine.store("budget").profile?.transactions?.length || 0
  );
  expect(txns).toBeGreaterThan(1000);
  await page.close();
});

test("a returning visitor with a profile is never redirected", async ({ seeded }) => {
  const page = await seeded.newPage();
  await gotoApp(page, "/app/");
  await page.waitForTimeout(1200);
  expect(page.url()).not.toContain("/app/welcome/");
  await page.close();
});

test("recovery routes stay reachable with zero profiles", async ({ virgin }) => {
  /* Someone restoring a backup must never be trapped in a setup wizard. */
  for (const route of ["/app/import/", "/app/backup/", "/app/profiles/", "/app/diagnostics/"]) {
    const page = await virgin.newPage();
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    expect(page.url(), `${route} must not bounce to the wizard`).toContain(route);
    await page.close();
  }
});
