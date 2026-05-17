/* Accounts slice — groups, CRUD, derivations, and the collapsed-state
   helpers for BOTH account groups and category groups (the latter
   sandwiched in because they share the collapsedXGroups maps pattern
   and used to live next to each other before the split). Payment-
   category bookkeeping fires when a credit-card account is added,
   renamed, retyped, or removed. */

import { newAccountGroup, newAccount } from "../schema.js";
import {
  runningBalance, clearedBalance, accountsByGroup,
  onBudgetTotal as onBudgetTotalImpl,
  trackingAssetTotal as trackingAssetTotalImpl,
  trackingLiabilityTotal as trackingLiabilityTotalImpl,
  netWorth as netWorthImpl,
  findAccount as findAccountImpl,
} from "../../domain/accounts.js";
import {
  ensurePaymentCategory, syncPaymentCategoryName, removePaymentCategory,
} from "../../domain/categories.js";

export const accountsSlice = {
  addAccountGroup(name) {
    if (!this.profile) return null;
    this._recordUndo("Add account group");
    var g = newAccountGroup((name || "").trim() || "Group", this.profile.accountGroups.length);
    this.profile.accountGroups.push(g);
    this._bumpLists();
    this._save();
    return g;
  },

  toggleAccountGroupCollapsed(id) {
    if (!this.profile || !id) return;
    var next = !this.collapsedAcctGroups[id];
    /* Replace the map so the store's Proxy sees a property change at
       the top level — guarantees x-show / x-for re-evaluate. */
    var m = Object.assign({}, this.collapsedAcctGroups);
    if (next) m[id] = true; else delete m[id];
    this.collapsedAcctGroups = m;
    var g = this.profile.accountGroups.find(function (x) { return x.id === id; });
    if (g) { g.collapsed = next; this._save(); }
  },

  toggleCategoryGroupCollapsed(id) {
    if (!this.profile || !id) return;
    var next = !this.collapsedCatGroups[id];
    var m = Object.assign({}, this.collapsedCatGroups);
    if (next) m[id] = true; else delete m[id];
    this.collapsedCatGroups = m;
    var g = this.profile.categoryGroups.find(function (x) { return x.id === id; });
    if (g) { g.collapsed = next; this._save(); }
  },

  /* Bulk collapse / expand every category group in one call.
     Persists the collapsed flag on each group object so the state
     survives reload, same as toggleCategoryGroupCollapsed does. */
  setAllCatGroupsCollapsed(collapsed) {
    if (!this.profile) return;
    var groups = this.profile.categoryGroups || [];
    var m = {};
    groups.forEach(function (g) {
      g.collapsed = !!collapsed;
      if (collapsed) m[g.id] = true;
    });
    this.collapsedCatGroups = m;
    this._save();
  },

  /* True iff every group is currently collapsed. Lets the toolbar
     toggle button flip its label between "Collapse all" / "Expand all". */
  allCatGroupsCollapsed() {
    if (!this.profile) return false;
    var groups = this.profile.categoryGroups || [];
    if (!groups.length) return false;
    var self = this;
    return groups.every(function (g) { return !!self.collapsedCatGroups[g.id]; });
  },

  isAcctGroupCollapsed(id) { return !!(id && this.collapsedAcctGroups[id]); },
  isCatGroupCollapsed(id)  { return !!(id && this.collapsedCatGroups[id]); },

  renameAccountGroup(id, name) {
    if (!this.profile) return;
    var g = this.profile.accountGroups.find(function (x) { return x.id === id; });
    if (!g) return;
    this._recordUndo("Rename account group");
    g.name = (name || "").trim() || g.name;
    this._bumpLists();
    this._save();
  },

  deleteAccountGroup(id) {
    if (!this.profile) return;
    this._recordUndo("Delete account group");
    /* Detach accounts but keep them. */
    this.profile.accounts.forEach(function (a) {
      if (a.groupId === id) a.groupId = null;
    });
    this.profile.accountGroups = this.profile.accountGroups.filter(function (g) { return g.id !== id; });
    this._bumpLists();
    this._save();
  },

  addAccount(opts) {
    if (!this.profile) return null;
    this._recordUndo("Add account");
    var a = newAccount({
      groupId: opts.groupId || null,
      name: (opts.name || "").trim() || "New account",
      type: opts.type || "checking",
      openingBalance: Math.round(Number(opts.openingBalance) || 0),
      sortIndex: this.profile.accounts.length,
      excludeFromNetWorth: !!opts.excludeFromNetWorth,
    });
    this.profile.accounts.push(a);
    if (a.type === "credit") {
      ensurePaymentCategory(this.profile, a.id, a.name);
    }
    this._bumpLists();
    this._save();
    this.pushToast("Account '" + a.name + "' added.");
    return a;
  },

  renameAccount(id, name) {
    if (!this.profile) return;
    var a = findAccountImpl(this.profile, id);
    if (!a) return;
    this._recordUndo("Rename account");
    a.name = (name || "").trim() || a.name;
    this._bumpLists();
    if (a.type === "credit") {
      syncPaymentCategoryName(this.profile, a.id, a.name);
    }
    this._save();
  },

  moveAccountToGroup(id, groupId) {
    if (!this.profile) return;
    var a = findAccountImpl(this.profile, id);
    if (!a) return;
    a.groupId = groupId || null;
    this._bumpLists();
    this._save();
  },

  /* Single-call update for name / type / groupId / openingBalance.
     Handles the credit-card payment-category bookkeeping when type
     changes to or from credit. Opening balance is stored as cents. */
  updateAccount(id, patch) {
    if (!this.profile) return null;
    var a = findAccountImpl(this.profile, id);
    if (!a) return null;
    this._recordUndo("Edit account");
    var oldType = a.type;
    var oldName = a.name;
    if (patch.name !== undefined) a.name = (patch.name || "").trim() || a.name;
    if (patch.groupId !== undefined) a.groupId = patch.groupId || null;
    if (patch.openingBalance !== undefined) {
      a.openingBalance = Math.round(Number(patch.openingBalance) || 0);
    }
    if (patch.excludeFromNetWorth !== undefined) {
      a.excludeFromNetWorth = !!patch.excludeFromNetWorth;
    }
    if (patch.type !== undefined && patch.type !== oldType) {
      a.type = patch.type;
      var isTracking = patch.type === "tracking-asset" || patch.type === "tracking-liability";
      a.onBudget = !isTracking;
      if (oldType === "credit" && patch.type !== "credit") {
        removePaymentCategory(this.profile, a.id);
      } else if (oldType !== "credit" && patch.type === "credit") {
        ensurePaymentCategory(this.profile, a.id, a.name);
      }
    } else if (patch.name !== undefined && oldName !== a.name && a.type === "credit") {
      syncPaymentCategoryName(this.profile, a.id, a.name);
    }
    this._bumpLists();
    this._save();
    return a;
  },

  closeAccount(id) {
    if (!this.profile) return;
    var a = findAccountImpl(this.profile, id);
    if (!a) return;
    a.closedAt = new Date().toISOString();
    this._bumpLists();
    this._save();
    this.pushToast("Account '" + a.name + "' closed.");
  },

  reopenAccount(id) {
    if (!this.profile) return;
    var a = findAccountImpl(this.profile, id);
    if (!a) return;
    a.closedAt = null;
    this._bumpLists();
    this._save();
  },

  deleteAccount(id, confirmedName) {
    if (!this.profile) return false;
    var a = findAccountImpl(this.profile, id);
    if (!a) return false;
    if (confirmedName !== a.name) {
      this.pushToast("Delete cancelled — typed name did not match.", "warn");
      return false;
    }
    this._recordUndo("Delete account");
    if (a.type === "credit") {
      removePaymentCategory(this.profile, a.id);
    }
    /* Remove the account and all its transactions. */
    this.profile.accounts = this.profile.accounts.filter(function (x) { return x.id !== id; });
    this.profile.transactions = this.profile.transactions.filter(function (t) { return t.accountId !== id; });
    this._bumpLists();
    this._save();
    this.pushToast("Account '" + a.name + "' and its transactions deleted.");
    return true;
  },

  /* ---- Account derivations (templates call these) ---- */
  accountBalance(id) { return this.profile ? runningBalance(this.profile, id) : 0; },
  accountClearedBalance(id) { return this.profile ? clearedBalance(this.profile, id) : 0; },
  accountGroupsView() {
    /* Reactivity tripwire — every list mutation (add/remove/move
       group, add/remove/move account) calls _bumpLists() which
       increments _listVersion. Reading it here makes Alpine
       re-evaluate this getter on every change, so the sidebar
       + /app/accounts/ refresh without a manual page reload.
       Mirrors the categoryGroupsView() pattern. */
    void this._listVersion;
    return this.profile ? accountsByGroup(this.profile) : [];
  },
  onBudgetTotal() { return this.profile ? onBudgetTotalImpl(this.profile) : 0; },
  trackingAssetTotal() { return this.profile ? trackingAssetTotalImpl(this.profile) : 0; },
  trackingLiabilityTotal() { return this.profile ? trackingLiabilityTotalImpl(this.profile) : 0; },
  netWorth() { return this.profile ? netWorthImpl(this.profile) : 0; },
  findAccount(id) { return this.profile ? findAccountImpl(this.profile, id) : null; },
};
