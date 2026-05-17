import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { budgetSlice } from "../src/assets/js/store/slices/budget.js";
import { transactionsSlice } from "../src/assets/js/store/slices/transactions.js";
import { scheduledSlice } from "../src/assets/js/store/slices/scheduled.js";
import { goalsSlice } from "../src/assets/js/store/slices/goals.js";
import { dashboardSlice } from "../src/assets/js/store/slices/dashboard.js";
import { reportsSlice } from "../src/assets/js/store/slices/reports.js";
import { rulesSlice } from "../src/assets/js/store/slices/rules.js";

function build() {
  var h = makeHost([
    accountsSlice, categoriesSlice, budgetSlice, transactionsSlice,
    scheduledSlice, goalsSlice, dashboardSlice, reportsSlice, rulesSlice,
  ]);
  h.currentMonth = "2024-03";
  /* A small but realistic profile: one account, three categories,
     a handful of transactions, one scheduled template. */
  h.addAccountGroup("Daily");
  h.addCategoryGroup("Food");
  var foodGroup = h.profile.categoryGroups[0];
  var groceries = h.addCategory({ name: "Groceries", groupId: foodGroup.id });
  var dining    = h.addCategory({ name: "Dining out", groupId: foodGroup.id });
  var acct = h.addAccount({ name: "Checking", type: "checking", openingBalance: 100000 });
  /* March transactions. */
  h.addTransaction({ accountId: acct.id, date: "2024-03-05", payeeName: "Whole Foods", amount: -8000, categoryId: groceries.id });
  h.addTransaction({ accountId: acct.id, date: "2024-03-12", payeeName: "Whole Foods", amount: -5500, categoryId: groceries.id });
  h.addTransaction({ accountId: acct.id, date: "2024-03-15", payeeName: "Restaurant", amount: -3200, categoryId: dining.id });
  /* Assign a budget envelope to groceries this month. */
  h.assign(groceries.id, "2024-03", 12000);
  return { host: h, groceries: groceries, dining: dining, acct: acct };
}

describe("dashboardSlice", () => {
  it("overspentCount detects categories whose available < 0", () => {
    var ctx = build();
    /* Groceries: 12000 assigned, -13500 activity → -1500 (overspent)
       Dining:    0 assigned,    -3200 activity → -3200 (overspent)
       Total: 2 categories, 4700 cents deficit. */
    var res = ctx.host.overspentCount("2024-03");
    expect(res.count).toBe(2);
    expect(res.totalDeficit).toBe(4700);
  });

  it("overspentCount returns zero when nothing's overspent", () => {
    var ctx = build();
    /* Bump groceries assigned high enough that nothing is overspent. */
    ctx.host.assign(ctx.groceries.id, "2024-03", 50000);
    /* Dining had no envelope — but it has activity, so it overspends.
       Give it an envelope too. */
    ctx.host.assign(ctx.dining.id, "2024-03", 5000);
    var res = ctx.host.overspentCount("2024-03");
    expect(res.count).toBe(0);
    expect(res.totalDeficit).toBe(0);
  });

  it("upcomingBills aggregates scheduled occurrences in the window", () => {
    var ctx = build();
    /* Add a scheduled monthly rent that hits today + 5 days. */
    var soon = new Date();
    soon.setDate(soon.getDate() + 5);
    var iso = soon.toISOString().slice(0, 10);
    ctx.host.addSchedule({
      template: { accountId: ctx.acct.id, payeeName: "Rent", amount: -150000, categoryId: null },
      frequency: "monthly",
      nextDate: iso,
    });
    var bills = ctx.host.upcomingBills(14);
    expect(bills.items.length).toBeGreaterThan(0);
    expect(bills.totalOut).toBeLessThan(0);
    expect(bills.totalNet).toBeLessThan(0);
  });

  it("upcomingBills returns empty struct when no scheduled templates", () => {
    var ctx = build();
    var b = ctx.host.upcomingBills(7);
    expect(b.items).toEqual([]);
    expect(b.totalNet).toBe(0);
  });

  it("goalsNeedingAttention only surfaces under-funded goals", () => {
    var ctx = build();
    /* Add a goal of 50k on groceries; assigned was 12k → 24% funded. */
    ctx.host.addGoal({ categoryId: ctx.groceries.id, type: "monthlyFixed", target: 50000 });
    var rows = ctx.host.goalsNeedingAttention(5, "2024-03");
    expect(rows.length).toBe(1);
    expect(rows[0].deficit).toBe(38000);
    expect(rows[0].pct).toBeCloseTo(0.24, 2);
  });

  it("dashboardAlerts fires the overspent alert when categories are over", () => {
    var ctx = build();
    ctx.host.currentMonth = "2024-03";
    var alerts = ctx.host.dashboardAlerts();
    var overspent = alerts.find(function (a) { return a.id === "overspent"; });
    expect(overspent).toBeTruthy();
    expect(overspent.severity).toBe("warn");
  });

  it("dashboardAlerts caches the result — same array reference on consecutive calls", () => {
    var ctx = build();
    var a1 = ctx.host.dashboardAlerts();
    var a2 = ctx.host.dashboardAlerts();
    expect(a1).toBe(a2);
  });

  it("overspentCount cache invalidates on _bumpLists (next read recomputes)", () => {
    var ctx = build();
    /* Budget both cats up-front so the starting state is clean (0). */
    ctx.host.assign(ctx.groceries.id, "2024-03", 50000);
    ctx.host.assign(ctx.dining.id,    "2024-03", 50000);
    var first = ctx.host.overspentCount("2024-03");
    expect(first.count).toBe(0);
    /* Now blow past the groceries envelope with a fresh transaction. */
    ctx.host.addTransaction({
      accountId: ctx.acct.id, date: "2024-03-25", payeeName: "X",
      amount: -100000, categoryId: ctx.groceries.id,
    });
    var second = ctx.host.overspentCount("2024-03");
    expect(first).not.toBe(second);
    expect(second.count).toBe(1);
  });
});
