import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { goalsSlice } from "../src/assets/js/store/slices/goals.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { budgetSlice } from "../src/assets/js/store/slices/budget.js";
import { transactionsSlice } from "../src/assets/js/store/slices/transactions.js";

function build() {
  var h = makeHost([goalsSlice, categoriesSlice, accountsSlice, budgetSlice, transactionsSlice]);
  h.currentMonth = "2024-03";
  var grp = h.addCategoryGroup("Food");
  var cat = h.addCategory({ name: "Groceries", groupId: grp.id });
  var acct = h.addAccount({ name: "Checking", type: "checking", openingBalance: 100000 });
  return { host: h, cat: cat, acct: acct };
}

describe("goalsSlice", () => {
  it("addGoal attaches to the category + links via category.goalId", () => {
    var ctx = build();
    var g = ctx.host.addGoal({ categoryId: ctx.cat.id, type: "monthlyFixed", target: 30000 });
    expect(g).toBeTruthy();
    expect(g.categoryId).toBe(ctx.cat.id);
    expect(g.target).toBe(30000);
    /* Link back via the category. */
    var found = ctx.host.findCategory(ctx.cat.id);
    expect(found.goalId).toBe(g.id);
  });

  it("addGoal twice on same category replaces, doesn't duplicate", () => {
    var ctx = build();
    ctx.host.addGoal({ categoryId: ctx.cat.id, type: "monthlyFixed", target: 30000 });
    ctx.host.addGoal({ categoryId: ctx.cat.id, type: "monthlyTopUp", target: 50000 });
    expect(ctx.host.profile.goals).toHaveLength(1);
    expect(ctx.host.profile.goals[0].type).toBe("monthlyTopUp");
    expect(ctx.host.profile.goals[0].target).toBe(50000);
  });

  it("removeGoal drops the goal + clears the category link", () => {
    var ctx = build();
    ctx.host.addGoal({ categoryId: ctx.cat.id, type: "monthlyFixed", target: 30000 });
    ctx.host.removeGoal(ctx.cat.id);
    expect(ctx.host.profile.goals).toHaveLength(0);
    expect(ctx.host.findCategory(ctx.cat.id).goalId).toBeNull();
  });

  it("findGoal returns the linked goal or null", () => {
    var ctx = build();
    expect(ctx.host.findGoal(ctx.cat.id)).toBeNull();
    var g = ctx.host.addGoal({ categoryId: ctx.cat.id, type: "monthlyFixed", target: 30000 });
    expect(ctx.host.findGoal(ctx.cat.id).id).toBe(g.id);
  });

  it("goalNeeded for monthlyFixed = target - assigned", () => {
    var ctx = build();
    ctx.host.addGoal({ categoryId: ctx.cat.id, type: "monthlyFixed", target: 30000 });
    /* Nothing assigned yet → needed = 30000. */
    expect(ctx.host.goalNeeded(ctx.cat.id, "2024-03")).toBe(30000);
    /* Assign half → needed = 15000. */
    ctx.host.assign(ctx.cat.id, "2024-03", 15000);
    expect(ctx.host.goalNeeded(ctx.cat.id, "2024-03")).toBe(15000);
    /* Assign all → needed = 0. */
    ctx.host.assign(ctx.cat.id, "2024-03", 30000);
    expect(ctx.host.goalNeeded(ctx.cat.id, "2024-03")).toBe(0);
  });

  it("goalStatus reports funded / partial / needed", () => {
    var ctx = build();
    ctx.host.addGoal({ categoryId: ctx.cat.id, type: "monthlyFixed", target: 30000 });
    expect(ctx.host.goalStatus(ctx.cat.id, "2024-03")).toBe("needed");
    ctx.host.assign(ctx.cat.id, "2024-03", 15000);
    expect(ctx.host.goalStatus(ctx.cat.id, "2024-03")).toBe("partial");
    ctx.host.assign(ctx.cat.id, "2024-03", 30000);
    expect(ctx.host.goalStatus(ctx.cat.id, "2024-03")).toBe("funded");
  });

  it("targetByDate spreads the gap evenly over remaining months", () => {
    var ctx = build();
    /* Target $1200 by 2024-08 (6 months including March). With nothing
       carried in or assigned, each month needs target/6 = 200. */
    ctx.host.addGoal({
      categoryId: ctx.cat.id,
      type: "targetByDate",
      target: 120000,
      byDate: "2024-08-01",
    });
    var n = ctx.host.goalNeeded(ctx.cat.id, "2024-03");
    expect(n).toBe(20000);
  });

  it("findGoal / goalNeeded return safe zeroes when no profile", () => {
    var ctx = build();
    ctx.host.profile = null;
    expect(ctx.host.findGoal("anything")).toBeNull();
    expect(ctx.host.goalNeeded("anything")).toBe(0);
    expect(ctx.host.goalStatus("anything")).toBeNull();
  });
});
