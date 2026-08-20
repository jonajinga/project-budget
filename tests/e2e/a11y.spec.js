import { test, expect, appOnlyRoutes } from "./fixtures.js";
import { gotoApp } from "./helpers.js";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUDGET_FILE = join(HERE, "a11y-budget.json");

/* Rules the app already passes. These are hard-zero from day one: existing
   debt is capped elsewhere, but these must never regress at all. */
const ZERO_TOLERANCE = [
  "html-has-lang",
  "document-title",
  "bypass",
  "meta-viewport",
  "frame-title",
  "duplicate-id-active",
];

/* Set PB_A11Y_WRITE=1 locally to regenerate the budget after fixing things.
 * Deliberately NOT wired into any npm script and never set in CI -- a ratchet
 * that can rewrite itself during a run is decorative, not a gate. */
const WRITE = process.env.PB_A11Y_WRITE === "1";

function loadBudget() {
  if (!existsSync(BUDGET_FILE)) return {};
  return JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
}

test("accessibility ratchet across every app route", async ({ seeded }, testInfo) => {
  test.setTimeout(600_000);
  const project = testInfo.project.name;

  const counts = {};
  const byRoute = {};

  for (const route of appOnlyRoutes()) {
    const page = await seeded.newPage();
    await gotoApp(page, route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    for (const v of results.violations) {
      counts[v.id] = (counts[v.id] || 0) + v.nodes.length;
      (byRoute[v.id] ||= []).push(`${route}(${v.nodes.length})`);
    }
    await page.close();
  }

  const all = loadBudget();
  const budget = all[project] || {};

  if (WRITE) {
    /* Re-read at write time: the desktop and mobile projects run in parallel
       and both do a read-modify-write on this one file. Re-reading here
       narrows the race to the write itself instead of the whole test run. */
    const fresh = loadBudget();
    fresh[project] = sortKeys(counts);
    writeFileSync(BUDGET_FILE, JSON.stringify(sortKeys(fresh), null, 2) + "\n");
    console.log(`a11y-budget.json[${project}] rewritten:`, JSON.stringify(sortKeys(counts)));
    return;
  }

  const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log(`\nAccessibility violations by rule at ${project} (total nodes):`);
  for (const [rule, n] of summary) {
    const cap = budget[rule];
    const mark = cap === undefined ? "NEW " : n > cap ? "UP  " : n < cap ? "down" : "ok  ";
    console.log(`  ${mark} ${rule}: ${n}${cap === undefined ? "" : ` (budget ${cap})`}`);
  }

  /* 1. Zero-tolerance rules must be absent entirely. */
  const zeroFailures = ZERO_TOLERANCE.filter((r) => counts[r]);
  expect(
    zeroFailures.map((r) => `${r}: ${counts[r]} (${byRoute[r].slice(0, 4).join(", ")})`),
    "zero-tolerance accessibility rules must never fail"
  ).toEqual([]);

  /* 2. No new rule ids. A brand-new class of defect is gated immediately,
        even while existing debt is merely capped. */
  const newRules = Object.keys(counts)
    .filter((r) => budget[r] === undefined && !ZERO_TOLERANCE.includes(r))
    .map((r) => `${r}: ${counts[r]} (${byRoute[r].slice(0, 4).join(", ")})`);
  expect(newRules, "new accessibility rule violations introduced").toEqual([]);

  /* 3. Monotonic -- no rule's count may rise. Lowering is done by a human
        editing a11y-budget.json in the PR that earned it. */
  const regressions = Object.entries(counts)
    .filter(([r, n]) => budget[r] !== undefined && n > budget[r])
    .map(([r, n]) => `${r}: ${n} > budget ${budget[r]} (${byRoute[r].slice(0, 4).join(", ")})`);
  expect(regressions, "accessibility violations increased").toEqual([]);

  /* Surface improvements so the budget file gets tightened rather than
     silently drifting upward-friendly. */
  const improved = Object.entries(budget)
    .filter(([r, cap]) => (counts[r] || 0) < cap)
    .map(([r, cap]) => `${r}: ${counts[r] || 0} < budget ${cap}`);
  if (improved.length) {
    console.log("\nImproved -- lower these in a11y-budget.json:\n  " + improved.join("\n  "));
  }
});

function sortKeys(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}
