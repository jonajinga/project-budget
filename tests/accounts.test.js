import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";

function build() {
  return makeHost([accountsSlice, categoriesSlice]);
}

describe("accountsSlice", () => {
  it("addAccountGroup appends and bumps lists", () => {
    var h = build();
    var g = h.addAccountGroup("Daily");
    expect(g).toBeTruthy();
    expect(g.name).toBe("Daily");
    expect(h.profile.accountGroups).toHaveLength(1);
    expect(h._listVersion).toBeGreaterThan(0);
  });

  it("addAccount creates with the requested type + rounds opening balance to integer cents", () => {
    var h = build();
    var g = h.addAccountGroup("Daily");
    var a = h.addAccount({ name: "Checking", type: "checking", openingBalance: 1234.56, groupId: g.id });
    expect(a.type).toBe("checking");
    /* Math.round(1234.56) — the store treats opening balance as
       integer cents, so any decimal input is silently rounded
       (callers should pass already-multiplied cents). */
    expect(a.openingBalance).toBe(1235);
  });

  it("credit-card accounts get a paired payment category on add", () => {
    var h = build();
    h.addAccountGroup("Cards");
    h.addCategoryGroup("Credit cards"); // ensure a place for payment cat
    var card = h.addAccount({ name: "Visa", type: "credit" });
    var payCat = (h.profile.categories || []).find(function (c) { return c.name.indexOf("Visa") !== -1; });
    expect(payCat).toBeTruthy();
  });

  it("renameAccount updates the matching credit-card payment category name", () => {
    var h = build();
    h.addAccountGroup("Cards");
    h.addCategoryGroup("Credit cards");
    var card = h.addAccount({ name: "Visa", type: "credit" });
    h.renameAccount(card.id, "Chase Visa");
    var payCat = (h.profile.categories || []).find(function (c) { return c.name.indexOf("Chase Visa") !== -1; });
    expect(payCat).toBeTruthy();
  });

  it("deleteAccount refuses without typed name match", () => {
    var h = build();
    var a = h.addAccount({ name: "Checking", type: "checking" });
    expect(h.deleteAccount(a.id, "WRONG NAME")).toBe(false);
    expect(h.profile.accounts).toHaveLength(1);
  });

  it("deleteAccount removes the account AND its transactions when name matches", () => {
    var h = build();
    var a = h.addAccount({ name: "Checking", type: "checking" });
    h.profile.transactions.push({
      id: "t1", accountId: a.id, date: "2024-01-15", amount: -1000, categoryId: null,
      payeeId: null, memo: "", cleared: false, reconciled: false,
    });
    expect(h.deleteAccount(a.id, "Checking")).toBe(true);
    expect(h.profile.accounts).toHaveLength(0);
    expect(h.profile.transactions).toHaveLength(0);
  });

  it("setAllAcctGroupsCollapsed flips every group", () => {
    var h = build();
    h.addAccountGroup("Daily");
    h.addAccountGroup("Reserves");
    h.setAllAcctGroupsCollapsed(true);
    expect(h.allAcctGroupsCollapsed()).toBe(true);
    h.setAllAcctGroupsCollapsed(false);
    expect(h.allAcctGroupsCollapsed()).toBe(false);
  });
});
