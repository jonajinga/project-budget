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
  /**
   * Create a new account group at the end of the order.
   * Records an undo entry.
   * @param {string} name
   * @returns {object|null} the created group
   */
  addAccountGroup(name) {
    if (!this.profile) return null;
    this._recordUndo("Add account group");
    var g = newAccountGroup((name || "").trim() || "Group", this.profile.accountGroups.length);
    this.profile.accountGroups.push(g);
    this._bumpLists();
    this._save();
    return g;
  },

  /**
   * Flip the collapsed flag on an account group, persisting it on the
   * group and replacing the collapsedAcctGroups map by reference so
   * Alpine sees a top-level property change.
   * @param {id} id
   */
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

  /**
   * Flip the collapsed flag on a category group, mirrored to the
   * collapsedCatGroups map by replacing it for reactivity.
   * @param {id} id
   */
  toggleCategoryGroupCollapsed(id) {
    if (!this.profile || !id) return;
    var next = !this.collapsedCatGroups[id];
    var m = Object.assign({}, this.collapsedCatGroups);
    if (next) m[id] = true; else delete m[id];
    this.collapsedCatGroups = m;
    var g = this.profile.categoryGroups.find(function (x) { return x.id === id; });
    if (g) { g.collapsed = next; this._save(); }
  },

  /**
   * Bulk collapse / expand every category group in one call.
   * Persists the collapsed flag on each group object so the state
   * survives reload, same as toggleCategoryGroupCollapsed does.
   * @param {boolean} collapsed
   */
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

  /**
   * True iff every category group is currently collapsed. Lets the
   * toolbar toggle button flip its label between "Collapse all" /
   * "Expand all".
   * @returns {boolean}
   */
  allCatGroupsCollapsed() {
    if (!this.profile) return false;
    var groups = this.profile.categoryGroups || [];
    if (!groups.length) return false;
    var self = this;
    return groups.every(function (g) { return !!self.collapsedCatGroups[g.id]; });
  },

  /**
   * @param {id} id
   * @returns {boolean}
   */
  isAcctGroupCollapsed(id) { return !!(id && this.collapsedAcctGroups[id]); },
  /**
   * @param {id} id
   * @returns {boolean}
   */
  isCatGroupCollapsed(id)  { return !!(id && this.collapsedCatGroups[id]); },

  /**
   * Rename an account group; falls back to the existing name if the
   * trimmed input is empty. Records an undo entry.
   * @param {id} id
   * @param {string} name
   */
  renameAccountGroup(id, name) {
    if (!this.profile) return;
    var g = this.profile.accountGroups.find(function (x) { return x.id === id; });
    if (!g) return;
    this._recordUndo("Rename account group");
    g.name = (name || "").trim() || g.name;
    this._bumpLists();
    this._save();
  },

  /**
   * Remove a group and detach (but keep) its accounts by clearing
   * their groupId. Records an undo entry.
   * @param {id} id
   */
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

  /**
   * Create an account. For credit accounts, also ensures a paired
   * payment category exists. Opening balance is integer cents.
   * Records an undo entry.
   * @param {object} opts {groupId, name, type, openingBalance, excludeFromNetWorth}
   * @returns {object|null} the created account
   */
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

  /**
   * Rename an account and sync the paired payment category name when
   * the account is a credit card. Records an undo entry.
   * @param {id} id
   * @param {string} name
   */
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

  /**
   * Reparent an account; pass null/empty to detach.
   * @param {id} id
   * @param {id} groupId
   */
  moveAccountToGroup(id, groupId) {
    if (!this.profile) return;
    var a = findAccountImpl(this.profile, id);
    if (!a) return;
    a.groupId = groupId || null;
    this._bumpLists();
    this._save();
  },

  /**
   * Single-call update for name / type / groupId / openingBalance /
   * excludeFromNetWorth. Handles credit-card payment-category
   * bookkeeping when type changes to or from credit, and flips
   * onBudget when toggling to/from a tracking type. Opening balance
   * is stored as integer cents. Records an undo entry.
   * @param {id} id
   * @param {object} patch
   * @returns {object|null} the updated account
   */
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

  /**
   * Mark an account closed by stamping closedAt with the current ISO
   * timestamp. Does not delete data.
   * @param {id} id
   */
  closeAccount(id) {
    if (!this.profile) return;
    var a = findAccountImpl(this.profile, id);
    if (!a) return;
    a.closedAt = new Date().toISOString();
    this._bumpLists();
    this._save();
    this.pushToast("Account '" + a.name + "' closed.");
  },

  /**
   * Clear closedAt to reopen a previously-closed account.
   * @param {id} id
   */
  reopenAccount(id) {
    if (!this.profile) return;
    var a = findAccountImpl(this.profile, id);
    if (!a) return;
    a.closedAt = null;
    this._bumpLists();
    this._save();
  },

  /**
   * Permanently remove an account plus all its transactions. Requires
   * confirmedName to match the account name; returns false otherwise.
   * Removes the paired payment category for credit accounts.
   * @param {id} id
   * @param {string} confirmedName
   * @returns {boolean} false if name mismatch or account not found
   */
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
  /**
   * Current running balance (cents) summing all transactions.
   * @param {id} id
   * @returns {number} cents
   */
  accountBalance(id) { return this.profile ? runningBalance(this.profile, id) : 0; },
  /**
   * Balance (cents) counting only cleared + reconciled transactions.
   * @param {id} id
   * @returns {number} cents
   */
  accountClearedBalance(id) { return this.profile ? clearedBalance(this.profile, id) : 0; },
  /**
   * Sidebar/accounts-page view of groups with their accounts attached.
   * Reads _listVersion so Alpine re-evaluates on any list mutation.
   * @returns {object[]}
   */
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
  /** @returns {number} cents summed across all on-budget accounts */
  onBudgetTotal() { return this.profile ? onBudgetTotalImpl(this.profile) : 0; },
  /** @returns {number} cents summed across tracking-asset accounts */
  trackingAssetTotal() { return this.profile ? trackingAssetTotalImpl(this.profile) : 0; },
  /** @returns {number} cents summed across tracking-liability accounts */
  trackingLiabilityTotal() { return this.profile ? trackingLiabilityTotalImpl(this.profile) : 0; },
  /** @returns {number} cents — net worth excluding accounts flagged excludeFromNetWorth */
  netWorth() { return this.profile ? netWorthImpl(this.profile) : 0; },
  /**
   * @param {id} id
   * @returns {object|null}
   */
  findAccount(id) { return this.profile ? findAccountImpl(this.profile, id) : null; },
};
