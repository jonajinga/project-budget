import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { reportsSlice } from "../src/assets/js/store/slices/reports.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { transactionsSlice } from "../src/assets/js/store/slices/transactions.js";
import { budgetSlice } from "../src/assets/js/store/slices/budget.js";
import { payeesSlice } from "../src/assets/js/store/slices/payees.js";
import { rulesSlice } from "../src/assets/js/store/slices/rules.js";

function build() {
  var h = makeHost([
    reportsSlice, accountsSlice, categoriesSlice, transactionsSlice,
    budgetSlice, payeesSlice, rulesSlice,
  ]);
  h.currentMonth = "2024-03";
  var foodGrp = h.addCategoryGroup("Food");
  var incomeGrp = h.addCategoryGroup("Income");
  incomeGrp.kind = "income";
  var groceries = h.addCategory({ name: "Groceries", groupId: foodGrp.id });
  var dining = h.addCategory({ name: "Dining", groupId: foodGrp.id });
  var salary = h.addCategory({ name: "Paycheck", groupId: incomeGrp.id });
  var acct = h.addAccount({ name: "Checking", type: "checking", openingBalance: 100000 });
  /* February — set the prior-month baseline. */
  h.addTransaction({ accountId: acct.id, date: "2024-02-15", payeeName: "Whole Foods", amount: -6000, categoryId: groceries.id });
  h.addTransaction({ accountId: acct.id, date: "2024-02-28", payeeName: "Employer", amount: 200000, categoryId: salary.id });
  /* March — current month. */
  h.addTransaction({ accountId: acct.id, date: "2024-03-05", payeeName: "Whole Foods", amount: -8000, categoryId: groceries.id });
  h.addTransaction({ accountId: acct.id, date: "2024-03-12", payeeName: "Whole Foods", amount: -5500, categoryId: groceries.id });
  h.addTransaction({ accountId: acct.id, date: "2024-03-15", payeeName: "Restaurant", amount: -3200, categoryId: dining.id });
  h.addTransaction({ accountId: acct.id, date: "2024-03-30", payeeName: "Employer", amount: 200000, categoryId: salary.id });
  return { host: h, groceries: groceries, dining: dining, salary: salary, acct: acct };
}

describe("reportsSlice", () => {
  it("reportIncomeVsExpense aggregates by month with net = income - expense", () => {
    var ctx = build();
    var rows = ctx.host.reportIncomeVsExpense("2024-03", 2);
    expect(rows).toHaveLength(2);
    var feb = rows[0];
    var mar = rows[1];
    expect(feb.month).toBe("2024-02");
    expect(feb.income).toBe(200000);
    expect(feb.expense).toBe(6000);
    expect(feb.net).toBe(194000);
    expect(mar.month).toBe("2024-03");
    expect(mar.income).toBe(200000);
    expect(mar.expense).toBe(8000 + 5500 + 3200);
    expect(mar.net).toBe(200000 - (8000 + 5500 + 3200));
  });

  it("reportSpending groups outflow by category for the given month", () => {
    var ctx = build();
    var rows = ctx.host.reportSpending("2024-03", "2024-03");
    var grocRow = rows.find(function (r) { return r.categoryId === ctx.groceries.id; });
    var dineRow = rows.find(function (r) { return r.categoryId === ctx.dining.id; });
    expect(grocRow.value).toBe(8000 + 5500);
    expect(dineRow.value).toBe(3200);
  });

  it("reportPayeeLeaderboard ranks payees by absolute outflow", () => {
    var ctx = build();
    var rows = ctx.host.reportPayeeLeaderboard("2024-03", "2024-03", 5);
    /* Whole Foods totals 13500, Restaurant 3200. */
    var wf = rows.find(function (r) { return /Whole Foods/.test(r.payee); });
    var rt = rows.find(function (r) { return /Restaurant/.test(r.payee); });
    expect(wf).toBeTruthy();
    expect(rt).toBeTruthy();
    expect(wf.total).toBe(13500);
    expect(rt.total).toBe(3200);
    /* Whole Foods rank should be ahead of Restaurant. */
    expect(rows.indexOf(wf)).toBeLessThan(rows.indexOf(rt));
  });

  it("reportNetWorth returns one entry per month with {month, value}", () => {
    var ctx = build();
    var rows = ctx.host.reportNetWorth("2024-03", 3);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveProperty("month");
    expect(rows[0]).toHaveProperty("value");
    /* Net worth in this scenario rises across months as income lands. */
    expect(rows[2].value).toBeGreaterThan(rows[0].value);
  });

  it("reportBudgetVsActual returns one row per non-payment category", () => {
    var ctx = build();
    ctx.host.assign(ctx.groceries.id, "2024-03", 20000);
    var rows = ctx.host.reportBudgetVsActual("2024-03");
    var grocRow = rows.find(function (r) { return r.categoryId === ctx.groceries.id; });
    expect(grocRow).toBeTruthy();
    expect(grocRow.assigned).toBe(20000);
    /* Spent is absolute-value outflow. */
    expect(grocRow.spent).toBe(13500);
    expect(grocRow.remaining).toBe(20000 - 13500);
  });

  it("memoization: back-to-back calls return same array reference", () => {
    var ctx = build();
    var a = ctx.host.reportSpending("2024-03", "2024-03");
    var b = ctx.host.reportSpending("2024-03", "2024-03");
    expect(a).toBe(b);
  });

  it("memoization invalidates after _bumpLists", () => {
    var ctx = build();
    var first = ctx.host.reportSpending("2024-03", "2024-03");
    ctx.host._bumpLists();
    var second = ctx.host.reportSpending("2024-03", "2024-03");
    expect(first).not.toBe(second);
    /* Same data, different reference. */
    expect(second).toEqual(first);
  });

  it("reports return safe empty values when profile is null", () => {
    var ctx = build();
    ctx.host.profile = null;
    expect(ctx.host.reportIncomeVsExpense("2024-03", 3)).toEqual([]);
    expect(ctx.host.reportSpending("2024-03", "2024-03")).toEqual([]);
    expect(ctx.host.reportSankey("2024-03", "2024-03")).toEqual({ nodes: [], links: [] });
    expect(ctx.host.reportHeatmap("2024-03", 3, 5)).toEqual({ months: [], categories: [], cells: {}, max: 0 });
  });
});
