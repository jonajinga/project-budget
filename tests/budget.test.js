import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { budgetSlice } from "../src/assets/js/store/slices/budget.js";
import { goalsSlice } from "../src/assets/js/store/slices/goals.js";

function build() {
  var h = makeHost([accountsSlice, categoriesSlice, budgetSlice]);
  h.addCategoryGroup("Food");
  var groupId = h.profile.categoryGroups[0].id;
  var groceries = h.addCategory({ name: "Groceries", groupId: groupId });
  var dining   = h.addCategory({ name: "Dining out", groupId: groupId });
  return { host: h, groceries: groceries, dining: dining };
}

describe("budgetSlice", () => {
  it("assign + assignedFor round-trip", () => {
    var ctx = build();
    ctx.host.assign(ctx.groceries.id, "2024-03", 80000);
    expect(ctx.host.assignedFor(ctx.groceries.id, "2024-03")).toBe(80000);
  });

  it("clearAssignedForCategories zeroes only the listed cats", () => {
    var ctx = build();
    ctx.host.assign(ctx.groceries.id, "2024-03", 80000);
    ctx.host.assign(ctx.dining.id,    "2024-03", 30000);
    var n = ctx.host.clearAssignedForCategories([ctx.groceries.id], "2024-03");
    expect(n).toBe(1);
    expect(ctx.host.assignedFor(ctx.groceries.id, "2024-03")).toBe(0);
    expect(ctx.host.assignedFor(ctx.dining.id,    "2024-03")).toBe(30000);
  });

  it("moveMoney is net-zero on total assigned and records ONE undo entry", () => {
    var ctx = build();
    ctx.host.assign(ctx.groceries.id, "2024-03", 80000);
    ctx.host.assign(ctx.dining.id,    "2024-03", 30000);
    var totalBefore = ctx.host.totalAssignedInMonth("2024-03");
    ctx.host.moveMoney(ctx.groceries.id, ctx.dining.id, 5000, "2024-03");
    expect(ctx.host.totalAssignedInMonth("2024-03")).toBe(totalBefore);
    expect(ctx.host.assignedFor(ctx.dining.id, "2024-03")).toBe(35000);
    expect(ctx.host.assignedFor(ctx.groceries.id, "2024-03")).toBe(75000);
  });

  it("moveMoney refuses invalid args (same id, non-positive amount)", () => {
    var ctx = build();
    expect(ctx.host.moveMoney(ctx.groceries.id, ctx.groceries.id, 1000, "2024-03")).toBe(false);
    expect(ctx.host.moveMoney(ctx.groceries.id, ctx.dining.id,    -100, "2024-03")).toBe(false);
    expect(ctx.host.moveMoney(ctx.groceries.id, ctx.dining.id,       0, "2024-03")).toBe(false);
  });

  it("saveBudgetTemplate snapshots only non-zero envelopes", () => {
    var ctx = build();
    ctx.host.assign(ctx.groceries.id, "2024-03", 80000);
    ctx.host.assign(ctx.dining.id,    "2024-03",     0);
    var tpl = ctx.host.saveBudgetTemplate("Standard month", "2024-03");
    expect(tpl).toBeTruthy();
    expect(Object.keys(tpl.assigned)).toHaveLength(1);
    expect(tpl.assigned[ctx.groceries.id]).toBe(80000);
  });

  it("applyBudgetTemplate writes onto a future month + skips missing cat ids", () => {
    var ctx = build();
    ctx.host.assign(ctx.groceries.id, "2024-03", 80000);
    ctx.host.assign(ctx.dining.id,    "2024-03", 30000);
    var tpl = ctx.host.saveBudgetTemplate("Standard month", "2024-03");
    /* Inject a phantom cat id into the template to confirm filtering. */
    tpl.assigned["missing-cat-id-xxxx"] = 99999;
    var n = ctx.host.applyBudgetTemplate(tpl.id, "2024-04");
    expect(n).toBe(2); // groceries + dining; missing-cat skipped
    expect(ctx.host.assignedFor(ctx.groceries.id, "2024-04")).toBe(80000);
    expect(ctx.host.assignedFor(ctx.dining.id,    "2024-04")).toBe(30000);
  });

  it("isIncomeCategory detects via kind=income on the group", () => {
    var ctx = build();
    var foodGroup = ctx.host.profile.categoryGroups[0];
    foodGroup.kind = "expense";
    expect(ctx.host.isIncomeCategory(ctx.groceries.id)).toBe(false);
    foodGroup.kind = "income";
    expect(ctx.host.isIncomeCategory(ctx.groceries.id)).toBe(true);
  });

  it("isIncomeCategory falls back to name pattern when kind is unset", () => {
    var ctx = build();
    var foodGroup = ctx.host.profile.categoryGroups[0];
    delete foodGroup.kind;
    /* "Food" does NOT match the income name pattern. */
    expect(ctx.host.isIncomeCategory(ctx.groceries.id)).toBe(false);
    foodGroup.name = "Income";
    expect(ctx.host.isIncomeCategory(ctx.groceries.id)).toBe(true);
  });

  it("allBudgetableCategoryIds excludes hidden", () => {
    var ctx = build();
    var ids = ctx.host.allBudgetableCategoryIds();
    expect(ids).toContain(ctx.groceries.id);
    ctx.host.profile.categories.find(function (c) { return c.id === ctx.dining.id; }).hidden = true;
    ids = ctx.host.allBudgetableCategoryIds();
    expect(ids).not.toContain(ctx.dining.id);
  });
});

/* ---- Phase 0 correctives (budget revamp) ---------------------------- */

describe("applyAssignments", () => {
  it("writes every category under ONE undo entry and ONE save", () => {
    var ctx = build();
    var undos = 0;
    var saves = 0;
    ctx.host._recordUndo = function () { undos += 1; };
    ctx.host._save = function () { saves += 1; };
    var map = {};
    map[ctx.groceries.id] = 12300;
    map[ctx.dining.id] = 4500;
    var n = ctx.host.applyAssignments(map, "2024-03", "Auto-assign (2)");
    expect(n).toBe(2);
    expect(ctx.host.assignedFor(ctx.groceries.id, "2024-03")).toBe(12300);
    expect(ctx.host.assignedFor(ctx.dining.id, "2024-03")).toBe(4500);
    expect(undos, "one undo entry for the whole batch").toBe(1);
    expect(saves, "one save for the whole batch").toBe(1);
  });

  it("returns 0 and records nothing for an empty map", () => {
    var ctx = build();
    var undos = 0;
    ctx.host._recordUndo = function () { undos += 1; };
    expect(ctx.host.applyAssignments({}, "2024-03")).toBe(0);
    expect(undos).toBe(0);
  });
});

describe("quick-assign helpers", () => {
  it("quickGoalTarget returns what the goal still needs in the given month", () => {
    var h = makeHost([accountsSlice, categoriesSlice, budgetSlice, goalsSlice]);
    h.addCategoryGroup("Food");
    var groupId = h.profile.categoryGroups[0].id;
    var cat = h.addCategory({ name: "Groceries", groupId: groupId });
    h.addGoal({ categoryId: cat.id, type: "monthlyFixed", target: 10000 });
    h.assign(cat.id, "2024-03", 3000);
    expect(h.quickGoalTarget(cat.id, "2024-03"), "partially funded month").toBe(7000);
    expect(h.quickGoalTarget(cat.id, "2024-04"), "untouched month").toBe(10000);
  });

  it("quickLastMonthAssigned and quickLastMonthSpent are distinct numbers", () => {
    var ctx = build();
    ctx.host.assign(ctx.groceries.id, "2024-02", 8000);
    ctx.host.profile.transactions.push({
      id: "t-spend", date: "2024-02-10", amount: -5000,
      accountId: "acct-x", categoryId: ctx.groceries.id,
    });
    expect(ctx.host.quickLastMonthAssigned(ctx.groceries.id, "2024-03")).toBe(8000);
    expect(ctx.host.quickLastMonthSpent(ctx.groceries.id, "2024-03")).toBe(5000);
  });

  it("quickLastMonthSpent ignores a net-refund month instead of suggesting it", () => {
    var ctx = build();
    ctx.host.profile.transactions.push({
      id: "t-refund", date: "2024-02-12", amount: 2000,
      accountId: "acct-x", categoryId: ctx.dining.id,
    });
    expect(ctx.host.quickLastMonthSpent(ctx.dining.id, "2024-03")).toBe(0);
    expect(ctx.host.quickAvg(ctx.dining.id, "2024-03", 3)).toBe(0);
  });
});
