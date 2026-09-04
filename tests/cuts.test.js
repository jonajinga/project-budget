/* Phase 6 of the budget revamp: reduction planning ("planned cuts").
 * A cut marks a category with a $/% monthly reduction target against a
 * FROZEN baseline (the mean outflow of the 3 months before startMonth)
 * and projects the impact. All fixtures hand-computed.
 */
import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { budgetSlice } from "../src/assets/js/store/slices/budget.js";
import { cutsSlice } from "../src/assets/js/store/slices/cuts.js";
import { buildMonthIndex } from "../src/assets/js/domain/budget.js";
import { cutBaseline, cutTarget, cutProgress, cutsSummary } from "../src/assets/js/domain/cuts.js";

function build() {
  var h = makeHost([accountsSlice, categoriesSlice, budgetSlice, cutsSlice]);
  /* An on-budget account the fixture's transactions can belong to.
     The domain code counts only dollars in on-budget accounts - a
     401(k) balance is not spendable - and it builds that set from
     profile.accounts. newProfile() creates none, so transactions
     pointing at an account that does not exist were filtered out and
     every figure came back 0 or null. The fixtures said "a1" all
     along; nothing ever created it. */
  h.profile.accounts.push({ id: "a1", name: "Checking", type: "checking", onBudget: true });
  h.currentMonth = "2025-04";
  h.addCategoryGroup("Food");
  var g = h.profile.categoryGroups[0];
  var dining = h.addCategory({ name: "Dining out", groupId: g.id });
  var coffee = h.addCategory({ name: "Coffee", groupId: g.id });
  /* Dining outflow: Jan 300, Feb 200, Mar 100 -> avg3 before Apr = 200. */
  [["2025-01-10", -30000], ["2025-02-10", -20000], ["2025-03-10", -10000]].forEach(function (t, i) {
    h.profile.transactions.push({ id: "d" + i, date: t[0], amount: t[1], accountId: "a1", categoryId: dining.id, transferTxnId: null });
  });
  /* April spend so far: 150. */
  h.profile.transactions.push({ id: "d-apr", date: "2025-04-08", amount: -15000, accountId: "a1", categoryId: dining.id, transferTxnId: null });
  /* Inflow: 1000/month Jan-Mar. */
  [["2025-01-01"], ["2025-02-01"], ["2025-03-01"]].forEach(function (t, i) {
    h.profile.transactions.push({ id: "in" + i, date: t[0], amount: 100000, accountId: "a1", categoryId: null, transferTxnId: null });
  });
  h._bumpLists();
  return { h: h, dining: dining, coffee: coffee };
}

describe("domain/cuts", () => {
  it("baseline is the mean outflow of the 3 months BEFORE startMonth, frozen", () => {
    var ctx = build();
    var cut = { categoryId: ctx.dining.id, mode: "percent", value: 2500, baselineKind: "avg3", startMonth: "2025-04" };
    var idx = buildMonthIndex(ctx.h.profile);
    expect(cutBaseline(ctx.h.profile, cut, idx)).toBe(20000);
    /* A refund month counts as 0 spend, not negative spend. */
    ctx.h.profile.transactions.push({ id: "refund", date: "2025-02-20", amount: 25000, accountId: "a1", categoryId: ctx.dining.id, transferTxnId: null });
    var idx2 = buildMonthIndex(ctx.h.profile);
    /* Feb net = +5000 -> clamps to 0 spend: (300 + 0 + 100) / 3 = 133.33 -> 13333. */
    expect(cutBaseline(ctx.h.profile, cut, idx2)).toBe(13333);
  });

  it("percent cuts target basis points of the baseline; amount cuts are literal", () => {
    var ctx = build();
    var idx = buildMonthIndex(ctx.h.profile);
    var pct = { categoryId: ctx.dining.id, mode: "percent", value: 2500, baselineKind: "avg3", startMonth: "2025-04" };
    expect(cutTarget(ctx.h.profile, pct, idx)).toBe(5000);   /* 25% of 200 */
    var amt = { categoryId: ctx.dining.id, mode: "amount", value: 7500, baselineKind: "avg3", startMonth: "2025-04" };
    expect(cutTarget(ctx.h.profile, amt, idx)).toBe(7500);
  });

  it("progress: saved = baseline - actual, clamped at 0; pct against the target", () => {
    var ctx = build();
    var idx = buildMonthIndex(ctx.h.profile);
    var cut = { categoryId: ctx.dining.id, mode: "percent", value: 2500, baselineKind: "avg3", startMonth: "2025-04" };
    var p = cutProgress(ctx.h.profile, cut, "2025-04", idx);
    expect(p.baseline).toBe(20000);
    expect(p.target).toBe(5000);
    expect(p.actual).toBe(15000);
    expect(p.saved).toBe(5000);       /* 200 baseline - 150 actual */
    expect(p.pct).toBe(100);          /* saved >= target */
    /* Overspending the baseline saves nothing (clamped, not negative). */
    ctx.h.profile.transactions.push({ id: "d-apr2", date: "2025-04-20", amount: -20000, accountId: "a1", categoryId: ctx.dining.id, transferTxnId: null });
    var p2 = cutProgress(ctx.h.profile, cut, "2025-04", buildMonthIndex(ctx.h.profile));
    expect(p2.actual).toBe(35000);
    expect(p2.saved).toBe(0);
    expect(p2.pct).toBe(0);
  });

  it("summary aggregates live cuts only and annualizes", () => {
    var ctx = build();
    var cuts = [
      { id: "c1", categoryId: ctx.dining.id, mode: "percent", value: 2500, baselineKind: "avg3", startMonth: "2025-04", deletedAt: null },
      { id: "c2", categoryId: ctx.coffee.id, mode: "amount", value: 2000, baselineKind: "avg3", startMonth: "2025-04", deletedAt: null },
      { id: "c3", categoryId: ctx.dining.id, mode: "amount", value: 99999, baselineKind: "avg3", startMonth: "2025-04", deletedAt: "2025-04-02T00:00:00Z" },
    ];
    var idx = buildMonthIndex(ctx.h.profile);
    var s = cutsSummary(ctx.h.profile, cuts, "2025-04", idx);
    expect(s.monthlyPlanned).toBe(7000);      /* 5000 + 2000; deleted cut excluded */
    expect(s.annualPlanned).toBe(84000);
    /* Realized: dining saved 5000; coffee baseline 0 -> saved 0. */
    expect(s.monthlyRealized).toBe(5000);
    /* Avg inflow over the 3 months before + incl. April with data: 1000/mo. */
    expect(s.pctOfAvgInflow).toBe(7);         /* 7000 / 100000 */
  });
});

describe("cutsSlice", () => {
  it("addCut / updateCut / removeCut: one undo entry each, soft delete", () => {
    var ctx = build();
    var undos = 0;
    ctx.h._recordUndo = function () { undos += 1; };
    var cut = ctx.h.addCut({ categoryId: ctx.dining.id, mode: "percent", value: 2500 });
    expect(cut.id).toBeTruthy();
    expect(cut.startMonth).toBe("2025-04");
    expect(undos).toBe(1);
    ctx.h.updateCut(cut.id, { value: 3000 });
    expect(ctx.h.cutForCategory(ctx.dining.id).value).toBe(3000);
    expect(undos).toBe(2);
    ctx.h.removeCut(cut.id);
    expect(undos).toBe(3);
    expect(ctx.h.cutForCategory(ctx.dining.id)).toBeNull();
    expect(ctx.h.profile.reductions.length, "soft delete keeps the record").toBe(1);
    expect(ctx.h.profile.reductions[0].deletedAt).toBeTruthy();
  });

  it("one live cut per category: adding again replaces", () => {
    var ctx = build();
    ctx.h.addCut({ categoryId: ctx.dining.id, mode: "percent", value: 2500 });
    ctx.h.addCut({ categoryId: ctx.dining.id, mode: "amount", value: 1000 });
    expect(ctx.h.listCuts().length).toBe(1);
    expect(ctx.h.cutForCategory(ctx.dining.id).mode).toBe("amount");
  });

  it("cutsSummaryFor projects the RTA delta as the planned monthly savings", () => {
    var ctx = build();
    ctx.h.addCut({ categoryId: ctx.dining.id, mode: "percent", value: 2500 });
    var s = ctx.h.cutsSummaryFor("2025-04");
    expect(s.monthlyPlanned).toBe(5000);
    expect(s.projectedRtaDelta).toBe(5000);
  });
});
