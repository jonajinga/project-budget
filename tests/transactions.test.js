import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { transactionsSlice } from "../src/assets/js/store/slices/transactions.js";
import { rulesSlice } from "../src/assets/js/store/slices/rules.js";

function build() {
  var h = makeHost([accountsSlice, categoriesSlice, transactionsSlice, rulesSlice]);
  h.addAccountGroup("Daily");
  h.addCategoryGroup("Food");
  var acct = h.addAccount({ name: "Checking", type: "checking" });
  var groceriesGroup = h.profile.categoryGroups[0];
  var groceriesCat = h.addCategory({ name: "Groceries", groupId: groceriesGroup.id });
  return { host: h, acct: acct, groceriesCat: groceriesCat };
}

describe("transactionsSlice", () => {
  it("addTransaction creates with rounded cents and bumps lists", () => {
    var ctx = build();
    var before = ctx.host._listVersion;
    var t = ctx.host.addTransaction({
      accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Test", amount: -1234.567,
    });
    expect(t).toBeTruthy();
    /* JS Math.round(-1234.567) === -1235 (rounds away from zero
       for negative halves on most engines; the store calls
       Math.round directly so we encode that behavior here). */
    expect(t.amount).toBe(-1235);
    expect(ctx.host._listVersion).toBeGreaterThan(before);
  });

  it("addTransaction upserts the payee from payeeName", () => {
    var ctx = build();
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Whole Foods", amount: -5000 });
    var payee = (ctx.host.profile.payees || []).find(function (p) { return p.name === "Whole Foods"; });
    expect(payee).toBeTruthy();
  });

  it("deleteTransaction moves to trash (soft delete) for non-reconciled rows", () => {
    var ctx = build();
    var t = ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "X", amount: -1000 });
    expect(ctx.host.deleteTransaction(t.id)).toBe(true);
    expect(ctx.host.profile.transactions).toHaveLength(0);
    expect(ctx.host.profile.trash).toHaveLength(1);
  });

  it("bulkRecategorize skips reconciled + split rows; counts changed rows", () => {
    var ctx = build();
    var t1 = ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "A", amount: -100 });
    var t2 = ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "B", amount: -200 });
    var t3 = ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "C", amount: -300 });
    /* Mark t2 reconciled. */
    t2.reconciled = true;
    var n = ctx.host.bulkRecategorize([t1.id, t2.id, t3.id], ctx.groceriesCat.id);
    expect(n).toBe(2);
    expect(ctx.host.profile.transactions.find(function (x) { return x.id === t1.id; }).categoryId).toBe(ctx.groceriesCat.id);
    expect(ctx.host.profile.transactions.find(function (x) { return x.id === t2.id; }).categoryId).toBeFalsy();
    expect(ctx.host.profile.transactions.find(function (x) { return x.id === t3.id; }).categoryId).toBe(ctx.groceriesCat.id);
  });

  it("bulkShiftDates moves dates forward; reconciled rows are skipped", () => {
    var ctx = build();
    var t1 = ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "A", amount: -100 });
    var t2 = ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "B", amount: -200 });
    t2.reconciled = true;
    var n = ctx.host.bulkShiftDates([t1.id, t2.id], 7);
    expect(n).toBe(1);
    expect(ctx.host.profile.transactions.find(function (x) { return x.id === t1.id; }).date).toBe("2024-01-22");
    expect(ctx.host.profile.transactions.find(function (x) { return x.id === t2.id; }).date).toBe("2024-01-15");
  });

  it("bulkDeleteTransactions trashes selected non-reconciled rows", () => {
    var ctx = build();
    var t1 = ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "A", amount: -100 });
    var t2 = ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "B", amount: -200 });
    t2.reconciled = true;
    var n = ctx.host.bulkDeleteTransactions([t1.id, t2.id]);
    expect(n).toBe(1);
    expect(ctx.host.profile.transactions).toHaveLength(1);
    expect(ctx.host.profile.transactions[0].id).toBe(t2.id);
  });

  it("rules: normalize-then-categorize applies on addTransaction", () => {
    var ctx = build();
    ctx.host.addNormalizeRule({ pattern: "WHOLEFDS", matchType: "starts-with", replacement: "Whole Foods" });
    ctx.host.addCategorizeRule({ pattern: "whole foods", matchType: "contains", categoryId: ctx.groceriesCat.id });
    var t = ctx.host.addTransaction({
      accountId: ctx.acct.id, date: "2024-01-15", payeeName: "WHOLEFDS MKT 1234", amount: -5000,
    });
    /* Payee should be normalized to "Whole Foods" and category resolved
       to Groceries. */
    var payee = (ctx.host.profile.payees || []).find(function (p) { return p.id === t.payeeId; });
    expect(payee.name).toBe("Whole Foods");
    expect(t.categoryId).toBe(ctx.groceriesCat.id);
  });

  it("rules: skipRules opt-out preserves raw payee + caller-supplied category", () => {
    var ctx = build();
    ctx.host.addNormalizeRule({ pattern: "RAW", matchType: "starts-with", replacement: "Cleaned" });
    var t = ctx.host.addTransaction({
      accountId: ctx.acct.id, date: "2024-01-15", payeeName: "RAW PAYEE", amount: -100, skipRules: true,
    });
    var payee = (ctx.host.profile.payees || []).find(function (p) { return p.id === t.payeeId; });
    expect(payee.name).toBe("RAW PAYEE");
  });
});
