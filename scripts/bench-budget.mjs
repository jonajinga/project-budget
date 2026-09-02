/* Budget domain benchmark - the acceptance instrument for the Phase 1
   month index (budget revamp). Runs the bundled sample through both
   implementations in plain Node (no Alpine proxies - a floor, not the
   browser number) and prints warm timings for 1/3/12 rendered months.

   "One rendered month" = every category's row + that month's RTA, i.e.
   what the grid reads per column.

     node scripts/bench-budget.mjs
*/
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFile, importAsNew } from "../src/assets/js/io/import-json.js";
import {
  categoryRow, readyToAssign, nextMonth,
  buildMonthIndex, buildBudgetTable, tableCategoryRow, tableReadyToAssign,
} from "../src/assets/js/domain/budget.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sample = JSON.parse(readFileSync(join(ROOT, "src/assets/sample/sample.json"), "utf8"));
const profile = importAsNew(parseFile(JSON.stringify(sample)), { name: "bench" });

const ANCHOR = "2026-05"; /* last data month - the worst-case chain */
function monthsFrom(anchor, n) {
  const out = [anchor];
  while (out.length < n) out.push(nextMonth(out[out.length - 1]));
  return out;
}

function legacyRender(months) {
  let sink = 0;
  for (const m of months) {
    for (const c of profile.categories) sink += categoryRow(profile, c.id, m).available;
    sink += readyToAssign(profile, m);
  }
  return sink;
}

function indexedRender(months) {
  /* One table serves every column - this is what the slice memo does. */
  const through = months[months.length - 1];
  const table = buildBudgetTable(profile, through, buildMonthIndex(profile));
  let sink = 0;
  for (const m of months) {
    for (const c of profile.categories) sink += tableCategoryRow(table, c.id, m).available;
    sink += tableReadyToAssign(table, m);
  }
  return sink;
}

function bench(label, fn, arg) {
  fn(arg); fn(arg); /* warm the JIT */
  let best = Infinity;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    fn(arg);
    const dt = performance.now() - t0;
    if (dt < best) best = dt;
  }
  console.log(`  ${label}: ${best.toFixed(2)} ms`);
  return best;
}

/* Both implementations must agree before timing means anything. */
for (const n of [1, 3, 12]) {
  const months = monthsFrom(ANCHOR, n);
  const a = legacyRender(months);
  const b = indexedRender(months);
  if (a !== b) {
    console.error(`DISAGREEMENT at ${n} months: legacy=${a} indexed=${b}`);
    process.exit(1);
  }
}
console.log("implementations agree on 1/3/12-month renders\n");

console.log("legacy scans (the pre-Phase-1 cost):");
for (const n of [1, 3, 12]) bench(`${String(n).padStart(2)} month(s)`, legacyRender, monthsFrom(ANCHOR, n));
console.log("month index (one table per render):");
for (const n of [1, 3, 12]) bench(`${String(n).padStart(2)} month(s)`, indexedRender, monthsFrom(ANCHOR, n));
