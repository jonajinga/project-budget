import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { payeesSlice } from "../src/assets/js/store/slices/payees.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { transactionsSlice } from "../src/assets/js/store/slices/transactions.js";
import { rulesSlice } from "../src/assets/js/store/slices/rules.js";

function build() {
  var h = makeHost([payeesSlice, accountsSlice, categoriesSlice, transactionsSlice, rulesSlice]);
  var acct = h.addAccount({ name: "Checking", type: "checking" });
  return { host: h, acct: acct };
}

describe("payeesSlice", () => {
  it("addTransaction with payeeName creates a payee row", () => {
    var ctx = build();
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Whole Foods", amount: -1000 });
    var list = ctx.host.allPayees();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("Whole Foods");
  });

  it("allPayees returns alphabetical order", () => {
    var ctx = build();
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Zebra", amount: -100 });
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Apple", amount: -100 });
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Mango", amount: -100 });
    var names = ctx.host.allPayees().map(function (p) { return p.name; });
    expect(names).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("renamePayee updates the name in place", () => {
    var ctx = build();
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "OldName", amount: -100 });
    var p = ctx.host.allPayees()[0];
    ctx.host.renamePayee(p.id, "NewName");
    expect(ctx.host.allPayees()[0].name).toBe("NewName");
  });

  it("payeeUsageCounts returns transaction counts per payee id", () => {
    var ctx = build();
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Cafe", amount: -500 });
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-16", payeeName: "Cafe", amount: -700 });
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-17", payeeName: "Cinema", amount: -1500 });
    var counts = ctx.host.payeeUsageCounts();
    var cafePayee = ctx.host.allPayees().find(function (p) { return p.name === "Cafe"; });
    var cinemaPayee = ctx.host.allPayees().find(function (p) { return p.name === "Cinema"; });
    expect(counts[cafePayee.id]).toBe(2);
    expect(counts[cinemaPayee.id]).toBe(1);
  });

  it("mergePayees re-points every transaction from source to target + deletes source", () => {
    var ctx = build();
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "WHOLEFDS MKT", amount: -1000 });
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-16", payeeName: "WHOLEFDS MKT", amount: -2000 });
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-17", payeeName: "Whole Foods", amount: -3000 });
    var src = ctx.host.allPayees().find(function (p) { return p.name === "WHOLEFDS MKT"; });
    var tgt = ctx.host.allPayees().find(function (p) { return p.name === "Whole Foods"; });
    ctx.host.mergePayees(src.id, tgt.id);
    /* Source payee gone. */
    expect(ctx.host.allPayees().find(function (p) { return p.id === src.id; })).toBeUndefined();
    /* All 3 transactions now point at target. */
    var allOnTarget = ctx.host.profile.transactions.every(function (t) { return t.payeeId === tgt.id; });
    expect(allOnTarget).toBe(true);
  });

  it("deletePayee returns true on hit, false on miss", () => {
    var ctx = build();
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Doomed", amount: -100 });
    var p = ctx.host.allPayees()[0];
    expect(ctx.host.deletePayee(p.id)).toBe(true);
    expect(ctx.host.deletePayee("nonexistent")).toBe(false);
  });
});
