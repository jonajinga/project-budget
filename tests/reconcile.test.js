import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { transactionsSlice } from "../src/assets/js/store/slices/transactions.js";
import { reconcileSlice } from "../src/assets/js/store/slices/reconcile.js";
import { rulesSlice } from "../src/assets/js/store/slices/rules.js";

function build() {
  var h = makeHost([accountsSlice, categoriesSlice, transactionsSlice, reconcileSlice, rulesSlice]);
  var acct = h.addAccount({ name: "Checking", type: "checking" });
  return { host: h, acct: acct };
}

describe("reconcileSlice", () => {
  it("reconcileStatus reports a zero diff when statement matches cleared balance", () => {
    var ctx = build();
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", amount: -2500, payeeName: "X", cleared: true });
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-16", amount: -1000, payeeName: "Y", cleared: true });
    var status = ctx.host.reconcileStatus(ctx.acct.id, -3500);
    expect(status.diff).toBe(0);
  });

  it("applyReconcile marks every cleared txn as reconciled + bumps lists", () => {
    var ctx = build();
    var before = ctx.host._listVersion;
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", amount: -2500, payeeName: "X", cleared: true });
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-16", amount: -1000, payeeName: "Y", cleared: false });
    var n = ctx.host.applyReconcile(ctx.acct.id);
    expect(n).toBe(1);
    expect(ctx.host._listVersion).toBeGreaterThan(before);
    var cleared = ctx.host.profile.transactions.find(function (t) { return t.cleared; });
    expect(cleared.reconciled).toBe(true);
  });

  it("applyReconcile with zero matching txns: suppresses the toast", () => {
    var ctx = build();
    var toasts = [];
    ctx.host.pushToast = function (msg) { toasts.push(msg); };
    var n = ctx.host.applyReconcile(ctx.acct.id);
    expect(n).toBe(0);
    expect(toasts).toHaveLength(0);
  });

  it("addAdjustment writes a plug transaction with the requested amount + bumps lists", () => {
    var ctx = build();
    var before = ctx.host._listVersion;
    var t = ctx.host.addAdjustment(ctx.acct.id, -250, "2024-01-31", "Bank fee plug");
    expect(t).toBeTruthy();
    expect(t.amount).toBe(-250);
    expect(t.memo).toBe("Bank fee plug");
    expect(ctx.host._listVersion).toBeGreaterThan(before);
  });

  it("unlockReconciled flips the reconciled flag back off + bumps lists", () => {
    var ctx = build();
    var t = ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", amount: -100, payeeName: "X", cleared: true });
    ctx.host.applyReconcile(ctx.acct.id);
    expect(ctx.host.profile.transactions[0].reconciled).toBe(true);
    var before = ctx.host._listVersion;
    var ok = ctx.host.unlockReconciled(t.id);
    expect(ok).toBe(true);
    expect(ctx.host.profile.transactions[0].reconciled).toBe(false);
    expect(ctx.host._listVersion).toBeGreaterThan(before);
  });
});
