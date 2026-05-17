import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { budgetSlice } from "../src/assets/js/store/slices/budget.js";

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
