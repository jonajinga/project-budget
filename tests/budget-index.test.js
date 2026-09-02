/* Phase 1 of the budget revamp: the month index.
 *
 * The legacy domain functions recompute everything from raw transaction
 * scans: one rendered month costs ~2.4M transaction visits (categoryRow
 * re-walks the whole carry chain per category, readyToAssign is a
 * months x categories x transactions triple loop). Multi-month columns
 * cannot land on top of that.
 *
 * buildMonthIndex is one O(T) pass bucketing activity/inflow by month;
 * buildBudgetTable is one forward O(months x categories) pass over the
 * index that yields every category row AND ready-to-assign for every
 * month at once (the carry clamp captures per-month overspend "lost",
 * which is exactly the RTA deduction).
 *
 * The legacy scans stay exported as the reference implementation; the
 * differential suite below holds the two implementations equal over
 * every month x category of the bundled 1,399-transaction sample.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMonthIndex, buildBudgetTable, tableCategoryRow, tableReadyToAssign,
  relevantMonths, categoryRow, readyToAssign, activity,
} from "../src/assets/js/domain/budget.js";
import { parseFile, importAsNew } from "../src/assets/js/io/import-json.js";
import { newProfile } from "../src/assets/js/store/schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function sampleProfile() {
  const sample = JSON.parse(readFileSync(join(ROOT, "src/assets/sample/sample.json"), "utf8"));
  const parsed = parseFile(JSON.stringify(sample));
  if (!parsed.ok) throw new Error("sample failed to parse");
  return importAsNew(parsed, { name: "Sample household" });
}

/* Minimal hand-built profile: two categories, controllable txns. */
function tinyProfile() {
  const p = newProfile("tiny");
  p.categoryGroups.push({ id: "g1", name: "Stuff" });
  p.categories.push({ id: "c1", name: "Groceries", groupId: "g1" });
  p.categories.push({ id: "c2", name: "Fun", groupId: "g1" });
  p.accounts.push({ id: "a1", name: "Checking", type: "checking" });
  return p;
}
function txn(p, over) {
  p.transactions.push(Object.assign(
    { id: "t" + p.transactions.length, accountId: "a1", date: "2025-01-15",
      amount: 0, categoryId: null, transferTxnId: null, payeeId: null },
    over
  ));
}
function assign(p, month, catId, cents) {
  if (!p.budgets[month]) p.budgets[month] = { month, assigned: {}, notes: {} };
  p.budgets[month].assigned[catId] = cents;
}

describe("differential: index vs legacy scans over the whole sample", () => {
  const profile = sampleProfile();
  const THROUGH = "2026-06"; /* one month past the end of the data */
  const table = buildBudgetTable(profile, THROUGH, buildMonthIndex(profile));
  const months = relevantMonths(profile, THROUGH);
  /* Also months with no data at all: before, and equal to through. */
  const queryMonths = ["2024-01", ...months];

  it("categoryRow matches for every month x category", () => {
    const bad = [];
    for (const m of queryMonths) {
      for (const c of profile.categories) {
        const a = tableCategoryRow(table, c.id, m);
        const b = categoryRow(profile, c.id, m);
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          bad.push(`${m} ${c.name}: table=${JSON.stringify(a)} legacy=${JSON.stringify(b)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("readyToAssign matches for every month", () => {
    const bad = [];
    for (const m of queryMonths) {
      const a = tableReadyToAssign(table, m);
      const b = readyToAssign(profile, m);
      if (a !== b) bad.push(`${m}: table=${a} legacy=${b}`);
    }
    expect(bad).toEqual([]);
  });

  it("indexed activity matches for every month x category", () => {
    const index = buildMonthIndex(profile);
    const bad = [];
    for (const m of months) {
      for (const c of profile.categories) {
        const a = (index.act[m] && index.act[m][c.id]) || 0;
        const b = activity(profile, c.id, m);
        if (a !== b) bad.push(`${m} ${c.name}: index=${a} legacy=${b}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("queries past the table horizon return null instead of a wrong row", () => {
    expect(tableCategoryRow(table, profile.categories[0].id, "2026-07")).toBeNull();
    expect(tableReadyToAssign(table, "2026-07")).toBeNull();
  });
});

describe("verified semantics survive the index", () => {
  it("overspending is charged to the NEXT month's RTA exactly once, not to carry", () => {
    const p = tinyProfile();
    txn(p, { date: "2025-01-05", amount: 100000 });            /* inflow */
    assign(p, "2025-01", "c1", 10000);
    txn(p, { date: "2025-01-10", amount: -30000, categoryId: "c1" });
    const table = buildBudgetTable(p, "2025-03", buildMonthIndex(p));
    expect(tableCategoryRow(table, "c1", "2025-01")).toEqual(
      { carryIn: 0, assigned: 10000, activity: -30000, available: -20000 });
    expect(tableCategoryRow(table, "c1", "2025-02")).toEqual(
      { carryIn: 0, assigned: 0, activity: 0, available: 0 });
    expect(tableReadyToAssign(table, "2025-01")).toBe(90000);
    expect(tableReadyToAssign(table, "2025-02")).toBe(70000);
    expect(tableReadyToAssign(table, "2025-03")).toBe(70000);
  });

  it("a future-month assignment does not reduce an earlier month's RTA", () => {
    const p = tinyProfile();
    txn(p, { date: "2025-01-05", amount: 100000 });
    assign(p, "2025-03", "c1", 50000);
    const table = buildBudgetTable(p, "2025-03", buildMonthIndex(p));
    expect(tableReadyToAssign(table, "2025-01")).toBe(100000);
    expect(tableReadyToAssign(table, "2025-02")).toBe(100000);
    expect(tableReadyToAssign(table, "2025-03")).toBe(50000);
  });

  it("positive carry rolls forward through an EMPTY month; RTA stays flat", () => {
    const p = tinyProfile();
    txn(p, { date: "2025-01-05", amount: 100000 });
    assign(p, "2025-01", "c1", 40000);
    txn(p, { date: "2025-01-10", amount: -15000, categoryId: "c1" });
    /* No data at all in 2025-02; 2025-03 is only the through bound. */
    const table = buildBudgetTable(p, "2025-03", buildMonthIndex(p));
    expect(tableCategoryRow(table, "c1", "2025-02")).toEqual(
      { carryIn: 25000, assigned: 0, activity: 0, available: 25000 });
    expect(tableCategoryRow(table, "c1", "2025-03")).toEqual(
      { carryIn: 25000, assigned: 0, activity: 0, available: 25000 });
    expect(tableReadyToAssign(table, "2025-02")).toBe(60000);
    expect(tableReadyToAssign(table, "2025-03")).toBe(60000);
  });

  it("split transactions bucket to their leg categories", () => {
    const p = tinyProfile();
    txn(p, { date: "2025-01-10", amount: -9000, categoryId: null,
             splits: [ { categoryId: "c1", amount: -6000 }, { categoryId: "c2", amount: -3000 } ] });
    const index = buildMonthIndex(p);
    expect(index.act["2025-01"]["c1"]).toBe(-6000);
    expect(index.act["2025-01"]["c2"]).toBe(-3000);
  });

  it("payment-category activity = categorized card charges minus card payments", () => {
    const p = tinyProfile();
    p.accounts.push({ id: "card1", name: "Visa", type: "credit" });
    p.categories.push({ id: "pay1", name: "Visa payment", groupId: "g1" });
    p.settings = { creditCardPaymentMap: { card1: "pay1" } };
    /* Categorized charge on the card. */
    txn(p, { date: "2025-01-08", accountId: "card1", amount: -12000, categoryId: "c1" });
    /* Uncategorized charge: informational only, not earmarked. */
    txn(p, { date: "2025-01-09", accountId: "card1", amount: -5000, categoryId: null });
    /* Payment INTO the card (positive transfer). */
    txn(p, { date: "2025-01-20", accountId: "card1", amount: 4000, transferTxnId: "tx-pair" });
    /* A txn categorized DIRECTLY to the payment category (from a plain
       checking account) must be IGNORED: activity() only derives
       payment-category activity from the card, and a verifier found
       nothing locking that exclusion in. */
    txn(p, { date: "2025-01-12", accountId: "a1", amount: -2500, categoryId: "pay1" });
    const index = buildMonthIndex(p);
    expect(index.act["2025-01"]["pay1"]).toBe(12000 - 4000);
    expect(index.act["2025-01"]["pay1"]).toBe(activity(p, "pay1", "2025-01"));
    /* The categorized charge ALSO hits its own category, like legacy. */
    expect(index.act["2025-01"]["c1"]).toBe(activity(p, "c1", "2025-01"));
  });
});
