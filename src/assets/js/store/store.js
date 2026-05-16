/* Alpine store: window.Alpine.store('budget').
   Templates bind to this object's reactive state. Every mutator that
   touches the active profile calls _save() so the change debounces to
   localStorage. */

import {
  listProfiles, getActiveId, setActiveId, loadProfile,
  createProfile, renameProfile, duplicateProfile, deleteProfile,
  restoreFromTrash, pruneTrash, switchTo,
  freshStart, trimHistory,
} from "./profile.js";
import { scheduleSave, isPrivateBrowsing, estimateUsedBytes, QUOTA_BYTES } from "./persist.js";
import { snapshotIfStale, listBackups, restoreBackup, listSnapshots, takeSnapshot, deleteSnapshot, restoreSnapshot } from "./backup.js";

import {
  newAccountGroup, newAccount, newCategoryGroup, newCategory,
} from "./schema.js";
import {
  runningBalance, clearedBalance, accountsByGroup,
  onBudgetTotal, trackingAssetTotal, trackingLiabilityTotal, netWorth,
  findAccount, ACCOUNT_TYPES,
} from "../domain/accounts.js";
import {
  addTxn as addTxnImpl, editTxn as editTxnImpl, deleteTxn as deleteTxnImpl,
  splitTxn as splitTxnImpl, transfer as transferImpl, syncTransferPair,
} from "../domain/transactions.js";
import { upsertPayee, suggestPayees, findPayee, findPayeeByName } from "../domain/payees.js";
import {
  addSchedule, removeSchedule, dueTransactions, postScheduled, skipScheduled, FREQUENCIES,
} from "../domain/scheduled.js";
import {
  reconciliationStatus, applyReconcile, addAdjustment, unlockReconciled,
} from "../domain/reconcile.js";
import {
  findCategory, findCategoryGroup, categoryGroupsView,
  addCategory as addCategoryImpl, addCategoryGroup as addCategoryGroupImpl,
  renameCategory as renameCategoryImpl, renameCategoryGroup as renameCategoryGroupImpl,
  deleteCategory as deleteCategoryImpl, deleteCategoryGroup as deleteCategoryGroupImpl,
  moveCategoryToGroup as moveCategoryToGroupImpl,
  ensurePaymentCategory, syncPaymentCategoryName, removePaymentCategory,
  paymentMap, paymentCardId, isPaymentCategory,
} from "../domain/categories.js";
import {
  thisMonth, monthStart, monthEnd, prevMonth, nextMonth, relevantMonths,
  activity as budgetActivity, assigned as budgetAssigned,
  totalAssignedInMonth, categoryRow, totalInflowToBudget, readyToAssign,
  quickAssignLastMonth, quickAssignAverageSpending,
} from "../domain/budget.js";
import {
  GOAL_TYPES, addGoal as addGoalImpl, removeGoalFor, findGoalForCategory,
  needed as goalNeeded, statusFor as goalStatusFor,
} from "../domain/goals.js";
import {
  incomeVsExpense, netWorthByMonth, spendingByCategory,
  monthlyTrendsByCategory, debtOverview, assignmentHistory, projection,
} from "../domain/reports.js";

import { download as downloadJSON, suggestedFilename, downloadBundle, suggestedBundleFilename } from "../io/export-json.js";
import { parseFile as parseJSON, importAsNew as cloneAsNew, importReplacing } from "../io/import-json.js";
import { parseCSV, applyMapping, dryRun as csvDryRun, detect as csvDetect } from "../io/import-csv.js";
import { parseOFX, dryRun as ofxDryRun } from "../io/import-ofx.js";
import { parseQIF, dryRun as qifDryRun } from "../io/import-qif.js";
import { parseGoCardless, dryRun as gcDryRun } from "../io/import-gocardless.js";
import {
  profileKey as _profileKey, profilesIndexKey as _profilesIndexKey,
  writeJSON as _writeJSON, readJSON as _readJSON,
} from "./persist.js";

export function createStore() {
  return {
    profiles: [],
    active: null,
    profile: null,
    lastSavedAt: null,
    toasts: [],
    privateBrowsing: false,

    /* Expose domain constants for templates. */
    ACCOUNT_TYPES: ACCOUNT_TYPES,
    FREQUENCIES: FREQUENCIES,
    GOAL_TYPES: GOAL_TYPES,

    /* Active budget month — what the budget UI is currently viewing. */
    currentMonth: thisMonth(),

    /* Reactivity bridge for list functions that read localStorage. Alpine's
       fine-grained reactivity only tracks reads of reactive store props,
       so list functions that walk localStorage need to read this counter
       to register a dependency. Mutators bump the counter so x-for / x-show
       bindings re-evaluate on next tick. */
    _listVersion: 0,
    _bumpLists() { this._listVersion += 1; },

    init() {
      this.privateBrowsing = isPrivateBrowsing();
      if (this.privateBrowsing) {
        this.pushToast(
          "This browser session is private. Data will not persist when you close the window. Export before closing.",
          "warn",
          true
        );
      }
      pruneTrash();
      this.refreshProfiles();
      var id = getActiveId();
      if (id && this.profiles.find(function (p) { return p.id === id; })) {
        this._load(id);
      } else if (!this.profiles.length && !this.privateBrowsing) {
        /* First-time visitor — auto-load the bundled sample so the app
           isn't empty. The sample is a regular profile they can edit or
           delete; we just bootstrap it once. The "sample-loaded" flag
           prevents re-fetching if they delete it later. */
        this.loadSampleIfFirstVisit();
      }
    },

    /* Fetches /assets/sample/sample.json and registers it as a profile.
       Marked as sample so the app shell can show a starter banner.
       Sets the seen flag BEFORE the async fetch so concurrent calls
       (some Alpine setups re-enter init) can't both create profiles. */
    async loadSampleIfFirstVisit() {
      var flagKey = "projectbudget:sample-loaded";
      try {
        if (localStorage.getItem(flagKey)) return;
        localStorage.setItem(flagKey, "1");
      } catch (_e) { return; }
      try {
        var res = await fetch("/assets/sample/sample.json", { cache: "no-store" });
        if (!res.ok) return;
        var data = await res.json();
        var parsed = parseJSON(JSON.stringify(data));
        if (!parsed.ok) return;
        var fresh = cloneAsNew(parsed);
        fresh.name = "Sample household";
        fresh.settings = fresh.settings || {};
        fresh.settings.isSample = true;
        _writeJSON(_profileKey(fresh.id), fresh);
        var index = _readJSON(_profilesIndexKey()) || [];
        index.push({ id: fresh.id, name: fresh.name, lastOpenedAt: fresh.updatedAt, schemaVersion: fresh.schemaVersion });
        _writeJSON(_profilesIndexKey(), index);
        this.refreshProfiles();
        this._load(fresh.id);
      } catch (_e) {
        /* Offline or sample not deployed — quietly skip. */
      }
    },

    /* Convenience for the sample banner CTA. */
    startFreshProfile(name) {
      var p = this.createProfile(name || "My budget");
      return p;
    },

    refreshProfiles() {
      this.profiles = listProfiles();
    },

    _load(id) {
      var p = loadProfile(id);
      if (!p) return;
      this.profile = p;
      this.active = id;
      setActiveId(id);
      snapshotIfStale(p);
      this._bumpLists();
    },

    _save() {
      if (!this.profile) return;
      var self = this;
      /* Pass the underlying object — Alpine proxies serialize fine via
         JSON.stringify but we read the raw object here for clarity. */
      scheduleSave(
        this.profile,
        function () {
          self.lastSavedAt = new Date();
          self.refreshProfiles();
        },
        function (err) {
          var msg = (err && err.name === "QuotaExceededError")
            ? "Browser storage is full. Export and free some space."
            : "Could not save changes. Check browser storage settings.";
          self.pushToast(msg, "danger", true);
        }
      );
    },

    get lastSavedLabel() {
      if (!this.lastSavedAt) return this.profile ? "Ready" : "No profile";
      return "Saved " + this.lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    },

    /* ---- Profile actions ---- */
    createProfile(name) {
      var p = createProfile((name || "").trim() || "My Budget");
      this.refreshProfiles();
      this._load(p.id);
      this.pushToast("Profile '" + p.name + "' created.");
      return p;
    },

    renameActive(newName) {
      if (!this.profile) return;
      renameProfile(this.profile, (newName || "").trim() || this.profile.name);
      this.refreshProfiles();
      this.pushToast("Renamed to '" + this.profile.name + "'.");
    },

    renameProfile(id, newName) {
      var p = (id === (this.profile && this.profile.id)) ? this.profile : loadProfile(id);
      if (!p) return;
      renameProfile(p, (newName || "").trim() || p.name);
      if (this.profile && this.profile.id === id) this.profile = p;
      this.refreshProfiles();
    },

    duplicateProfile(id, newName) {
      var copy = duplicateProfile(id, newName);
      if (!copy) return null;
      this.refreshProfiles();
      this.pushToast("Duplicated as '" + copy.name + "'.");
      return copy;
    },

    deleteProfile(id, confirmedName) {
      var entry = this.profiles.find(function (e) { return e.id === id; });
      if (!entry) return false;
      if (confirmedName !== entry.name) {
        this.pushToast("Delete cancelled — typed name did not match.", "warn");
        return false;
      }
      deleteProfile(id);
      if (this.active === id) {
        this.active = null;
        this.profile = null;
      }
      this.refreshProfiles();
      this.pushToast("Profile deleted. It can be restored from Settings within 7 days.");
      return true;
    },

    switchTo(id) {
      var p = switchTo(id);
      if (!p) return;
      this.profile = p;
      this.active = id;
      this.refreshProfiles();
      snapshotIfStale(p);
    },

    /* ---- Backups ---- */
    listBackups() {
      /* Touch the version counter so Alpine re-runs this when bumped. */
      void this._listVersion;
      if (!this.profile) return [];
      return listBackups(this.profile.id);
    },

    restoreBackup(day, confirmedName) {
      if (!this.profile) return false;
      if (confirmedName !== this.profile.name) {
        this.pushToast("Restore cancelled — typed name did not match.", "warn");
        return false;
      }
      var restored = restoreBackup(this.profile.id, day);
      if (!restored) {
        this.pushToast("Could not restore snapshot.", "danger");
        return false;
      }
      this.profile = restored;
      this.refreshProfiles();
      this._bumpLists();
      this.pushToast("Restored snapshot from " + day + ".");
      return true;
    },

    /* ---- Manual snapshots ---- */
    listSnapshots() {
      void this._listVersion;
      if (!this.profile) return [];
      return listSnapshots(this.profile.id);
    },

    takeSnapshot(label) {
      if (!this.profile) return null;
      var rec = takeSnapshot(this.profile, label);
      if (rec) {
        this._bumpLists();
        this.pushToast("Snapshot saved" + (rec.label ? ": '" + rec.label + "'" : "") + ".");
      }
      return rec;
    },

    deleteSnapshot(id) {
      if (!this.profile) return;
      deleteSnapshot(this.profile.id, id);
      this._bumpLists();
      this.pushToast("Snapshot removed.");
    },

    restoreSnapshot(id, confirmedName) {
      if (!this.profile) return false;
      if (confirmedName !== this.profile.name) {
        this.pushToast("Restore cancelled — typed name did not match.", "warn");
        return false;
      }
      var restored = restoreSnapshot(this.profile.id, id);
      if (!restored) {
        this.pushToast("Could not restore snapshot.", "danger");
        return false;
      }
      this.profile = restored;
      this.refreshProfiles();
      this._bumpLists();
      this.pushToast("Snapshot restored.");
      return true;
    },

    /* ---- Storage telemetry ---- */
    storageStats() {
      var used = estimateUsedBytes();
      return {
        used: used,
        quota: QUOTA_BYTES,
        pct: Math.min(100, Math.round((used / QUOTA_BYTES) * 100)),
      };
    },

    /* ---- Accounts ---- */
    addAccountGroup(name) {
      if (!this.profile) return null;
      var g = newAccountGroup((name || "").trim() || "Group", this.profile.accountGroups.length);
      this.profile.accountGroups.push(g);
      this._save();
      return g;
    },

    toggleAccountGroupCollapsed(id) {
      if (!this.profile) return;
      var g = this.profile.accountGroups.find(function (x) { return x.id === id; });
      if (!g) return;
      g.collapsed = !g.collapsed;
      this._save();
    },

    toggleCategoryGroupCollapsed(id) {
      if (!this.profile) return;
      var g = this.profile.categoryGroups.find(function (x) { return x.id === id; });
      if (!g) return;
      g.collapsed = !g.collapsed;
      this._save();
    },

    renameAccountGroup(id, name) {
      if (!this.profile) return;
      var g = this.profile.accountGroups.find(function (x) { return x.id === id; });
      if (!g) return;
      g.name = (name || "").trim() || g.name;
      this._save();
    },

    deleteAccountGroup(id) {
      if (!this.profile) return;
      /* Detach accounts but keep them. */
      this.profile.accounts.forEach(function (a) {
        if (a.groupId === id) a.groupId = null;
      });
      this.profile.accountGroups = this.profile.accountGroups.filter(function (g) { return g.id !== id; });
      this._save();
    },

    addAccount(opts) {
      if (!this.profile) return null;
      var a = newAccount({
        groupId: opts.groupId || null,
        name: (opts.name || "").trim() || "New account",
        type: opts.type || "checking",
        openingBalance: Math.round(Number(opts.openingBalance) || 0),
        sortIndex: this.profile.accounts.length,
      });
      this.profile.accounts.push(a);
      if (a.type === "credit") {
        ensurePaymentCategory(this.profile, a.id, a.name);
      }
      this._save();
      this.pushToast("Account '" + a.name + "' added.");
      return a;
    },

    renameAccount(id, name) {
      if (!this.profile) return;
      var a = findAccount(this.profile, id);
      if (!a) return;
      a.name = (name || "").trim() || a.name;
      if (a.type === "credit") {
        syncPaymentCategoryName(this.profile, a.id, a.name);
      }
      this._save();
    },

    moveAccountToGroup(id, groupId) {
      if (!this.profile) return;
      var a = findAccount(this.profile, id);
      if (!a) return;
      a.groupId = groupId || null;
      this._save();
    },

    /* Single-call update for name / type / groupId. Handles the credit-card
       payment-category bookkeeping when type changes to or from credit. */
    updateAccount(id, patch) {
      if (!this.profile) return null;
      var a = findAccount(this.profile, id);
      if (!a) return null;
      var oldType = a.type;
      var oldName = a.name;
      if (patch.name !== undefined) a.name = (patch.name || "").trim() || a.name;
      if (patch.groupId !== undefined) a.groupId = patch.groupId || null;
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
      this._save();
      return a;
    },

    closeAccount(id) {
      if (!this.profile) return;
      var a = findAccount(this.profile, id);
      if (!a) return;
      a.closedAt = new Date().toISOString();
      this._save();
      this.pushToast("Account '" + a.name + "' closed.");
    },

    reopenAccount(id) {
      if (!this.profile) return;
      var a = findAccount(this.profile, id);
      if (!a) return;
      a.closedAt = null;
      this._save();
    },

    deleteAccount(id, confirmedName) {
      if (!this.profile) return false;
      var a = findAccount(this.profile, id);
      if (!a) return false;
      if (confirmedName !== a.name) {
        this.pushToast("Delete cancelled — typed name did not match.", "warn");
        return false;
      }
      if (a.type === "credit") {
        removePaymentCategory(this.profile, a.id);
      }
      /* Remove the account and all its transactions. */
      this.profile.accounts = this.profile.accounts.filter(function (x) { return x.id !== id; });
      this.profile.transactions = this.profile.transactions.filter(function (t) { return t.accountId !== id; });
      this._save();
      this.pushToast("Account '" + a.name + "' and its transactions deleted.");
      return true;
    },

    /* ---- Account derivations (templates call these) ---- */
    accountBalance(id) { return this.profile ? runningBalance(this.profile, id) : 0; },
    accountClearedBalance(id) { return this.profile ? clearedBalance(this.profile, id) : 0; },
    accountGroupsView() { return this.profile ? accountsByGroup(this.profile) : []; },
    onBudgetTotal() { return this.profile ? onBudgetTotal(this.profile) : 0; },
    trackingAssetTotal() { return this.profile ? trackingAssetTotal(this.profile) : 0; },
    trackingLiabilityTotal() { return this.profile ? trackingLiabilityTotal(this.profile) : 0; },
    netWorth() { return this.profile ? netWorth(this.profile) : 0; },
    findAccount(id) { return this.profile ? findAccount(this.profile, id) : null; },

    /* ---- Transactions ---- */
    addTransaction(opts) {
      if (!this.profile) return null;
      var amount = Math.round(Number(opts.amount) || 0);
      var payeeId = null;
      if (opts.payeeName) {
        var p = upsertPayee(this.profile, opts.payeeName, opts.categoryId || null);
        if (p) payeeId = p.id;
      } else if (opts.payeeId) {
        payeeId = opts.payeeId;
      }
      var t = addTxnImpl(this.profile, {
        accountId: opts.accountId,
        date: opts.date || new Date().toISOString().slice(0, 10),
        payeeId: payeeId,
        categoryId: opts.categoryId || null,
        amount: amount,
        memo: opts.memo || "",
        cleared: !!opts.cleared,
      });
      this._save();
      return t;
    },

    updateTransaction(id, patch) {
      if (!this.profile) return null;
      if (patch.payeeName !== undefined) {
        var p = upsertPayee(this.profile, patch.payeeName, patch.categoryId || null);
        patch.payeeId = p ? p.id : null;
        delete patch.payeeName;
      }
      if (patch.amount !== undefined) patch.amount = Math.round(Number(patch.amount) || 0);
      var result = editTxnImpl(this.profile, id, patch);
      /* If it's part of a transfer pair, mirror the change. */
      if (result && result.transferTxnId) syncTransferPair(this.profile, id);
      this._save();
      return result;
    },

    deleteTransaction(id) {
      if (!this.profile) return false;
      var ok = deleteTxnImpl(this.profile, id);
      if (ok) this._save();
      return ok;
    },

    setSplits(id, splits) {
      if (!this.profile) return null;
      var t = splitTxnImpl(this.profile, id, splits);
      this._save();
      return t;
    },

    transfer(opts) {
      if (!this.profile) return null;
      var pair = transferImpl(this.profile, {
        fromAccountId: opts.fromAccountId,
        toAccountId: opts.toAccountId,
        amount: Math.round(Number(opts.amount) || 0),
        date: opts.date,
        memo: opts.memo,
      });
      if (!pair) return null;
      this._save();
      return pair;
    },

    /* ---- Transaction queries ---- */
    transactionsForAccount(accountId) {
      if (!this.profile) return [];
      return this.profile.transactions
        .filter(function (t) { return t.accountId === accountId; })
        .sort(function (a, b) {
          if (a.date !== b.date) return a.date < b.date ? 1 : -1;
          return 0;
        });
    },

    allTransactions() {
      if (!this.profile) return [];
      return this.profile.transactions.slice().sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return 0;
      });
    },

    /* ---- Payees ---- */
    suggestPayees(q, limit) {
      if (!this.profile) return [];
      return suggestPayees(this.profile, q, limit);
    },
    findPayee(id) { return this.profile ? findPayee(this.profile, id) : null; },
    payeeName(id) { var p = this.findPayee(id); return p ? p.name : ""; },

    /* ---- Scheduled ---- */
    addSchedule(opts) {
      if (!this.profile) return null;
      var s = addSchedule(this.profile, opts);
      this._save();
      return s;
    },
    removeSchedule(id) {
      if (!this.profile) return;
      removeSchedule(this.profile, id);
      this._save();
    },
    dueScheduled() {
      if (!this.profile) return [];
      return dueTransactions(this.profile);
    },
    postScheduled(id, overrides) {
      if (!this.profile) return null;
      /* If the template carries a payeeName (set when the user authored the
         schedule before that payee existed), upsert it on post so the
         resulting transaction has a real payeeId. */
      var sched = this.profile.scheduled.find(function (s) { return s.id === id; });
      if (sched && sched.template && sched.template.payeeName && !sched.template.payeeId) {
        var p = upsertPayee(this.profile, sched.template.payeeName, sched.template.categoryId || null);
        if (p) sched.template.payeeId = p.id;
      }
      var t = postScheduled(this.profile, id, overrides);
      this._save();
      return t;
    },
    skipScheduled(id) {
      if (!this.profile) return null;
      var s = skipScheduled(this.profile, id);
      this._save();
      return s;
    },

    /* ---- Reconciliation ---- */
    reconcileStatus(accountId, statementCents) {
      if (!this.profile) return { clearedBalance: 0, statementBalance: 0, diff: 0 };
      return reconciliationStatus(this.profile, accountId, statementCents);
    },

    applyReconcile(accountId) {
      if (!this.profile) return 0;
      var count = applyReconcile(this.profile, accountId);
      this._save();
      this.pushToast("Reconciled " + count + " transaction" + (count === 1 ? "" : "s") + ".");
      return count;
    },

    addAdjustment(accountId, amountCents, dateISO, memo) {
      if (!this.profile) return null;
      var t = addAdjustment(this.profile, accountId, amountCents, dateISO, memo);
      this._save();
      return t;
    },

    unlockReconciled(txnId) {
      if (!this.profile) return false;
      var ok = unlockReconciled(this.profile, txnId);
      if (ok) this._save();
      return ok;
    },

    /* ---- Categories ---- */
    addCategoryGroup(name) {
      if (!this.profile) return null;
      var g = addCategoryGroupImpl(this.profile, name);
      this._save();
      return g;
    },
    renameCategoryGroup(id, name) {
      if (!this.profile) return;
      renameCategoryGroupImpl(this.profile, id, name);
      this._save();
    },
    deleteCategoryGroup(id) {
      if (!this.profile) return;
      deleteCategoryGroupImpl(this.profile, id);
      this._save();
    },
    addCategory(opts) {
      if (!this.profile) return null;
      var c = addCategoryImpl(this.profile, opts);
      this._save();
      return c;
    },
    renameCategory(id, name) {
      if (!this.profile) return;
      renameCategoryImpl(this.profile, id, name);
      this._save();
    },
    deleteCategory(id) {
      if (!this.profile) return;
      deleteCategoryImpl(this.profile, id);
      this._save();
    },
    moveCategoryToGroup(id, groupId) {
      if (!this.profile) return;
      moveCategoryToGroupImpl(this.profile, id, groupId);
      this._save();
    },
    findCategory(id) { return this.profile ? findCategory(this.profile, id) : null; },
    findCategoryGroup(id) { return this.profile ? findCategoryGroup(this.profile, id) : null; },
    categoryGroupsView() { return this.profile ? categoryGroupsView(this.profile) : []; },
    isPaymentCategory(id) { return this.profile ? isPaymentCategory(this.profile, id) : false; },
    paymentCardId(id) { return this.profile ? paymentCardId(this.profile, id) : null; },
    categoryName(id) {
      var c = this.findCategory(id);
      return c ? c.name : "";
    },

    /* All categories flat — used by dropdowns. Skips hidden by default. */
    categoriesFlat() {
      if (!this.profile) return [];
      var view = categoryGroupsView(this.profile);
      var out = [];
      view.forEach(function (b) {
        b.categories.forEach(function (c) {
          out.push({ id: c.id, name: (b.group ? b.group.name + " / " : "") + c.name, groupName: b.group ? b.group.name : "" });
        });
      });
      return out;
    },

    /* ---- Budget month + math ---- */
    setMonth(m) { this.currentMonth = m; },
    goPrevMonth() { this.currentMonth = prevMonth(this.currentMonth); },
    goNextMonth() { this.currentMonth = nextMonth(this.currentMonth); },
    jumpToThisMonth() { this.currentMonth = thisMonth(); },

    readyToAssign(month) {
      if (!this.profile) return 0;
      return readyToAssign(this.profile, month || this.currentMonth);
    },
    categoryRow(categoryId, month) {
      if (!this.profile) return { carryIn: 0, assigned: 0, activity: 0, available: 0 };
      return categoryRow(this.profile, categoryId, month || this.currentMonth);
    },
    totalAssignedInMonth(month) {
      if (!this.profile) return 0;
      return totalAssignedInMonth(this.profile, month || this.currentMonth);
    },
    totalInflowToBudget(month) {
      if (!this.profile) return 0;
      return totalInflowToBudget(this.profile, month || this.currentMonth);
    },
    assignedFor(categoryId, month) {
      if (!this.profile) return 0;
      return budgetAssigned(this.profile, categoryId, month || this.currentMonth);
    },
    activityFor(categoryId, month) {
      if (!this.profile) return 0;
      return budgetActivity(this.profile, categoryId, month || this.currentMonth);
    },

    /* Assign a value (in cents) to a category for a month. */
    assign(categoryId, month, cents) {
      if (!this.profile) return;
      var m = month || this.currentMonth;
      if (!this.profile.budgets[m]) this.profile.budgets[m] = { month: m, assigned: {}, notes: {} };
      if (!this.profile.budgets[m].assigned) this.profile.budgets[m].assigned = {};
      this.profile.budgets[m].assigned[categoryId] = Math.round(Number(cents) || 0);
      this._save();
    },

    /* Quick-assign helpers — they return cents; UI calls assign(). */
    quickLastMonth(categoryId, month) {
      if (!this.profile) return 0;
      return quickAssignLastMonth(this.profile, categoryId, month || this.currentMonth);
    },
    quickAvg(categoryId, month, n) {
      if (!this.profile) return 0;
      return quickAssignAverageSpending(this.profile, categoryId, month || this.currentMonth, n);
    },
    quickGoalTarget(categoryId, month) {
      var goal = this.findGoal(categoryId);
      if (!goal) return 0;
      return goal.target || 0;
    },

    /* ---- Goals ---- */
    addGoal(opts) {
      if (!this.profile) return null;
      var g = addGoalImpl(this.profile, opts);
      this._save();
      return g;
    },
    removeGoal(categoryId) {
      if (!this.profile) return;
      removeGoalFor(this.profile, categoryId);
      this._save();
    },
    findGoal(categoryId) {
      return this.profile ? findGoalForCategory(this.profile, categoryId) : null;
    },
    goalNeeded(categoryId, month) {
      if (!this.profile) return 0;
      var g = findGoalForCategory(this.profile, categoryId);
      return goalNeeded(this.profile, g, month || this.currentMonth);
    },
    goalStatus(categoryId, month) {
      if (!this.profile) return null;
      var g = findGoalForCategory(this.profile, categoryId);
      return goalStatusFor(this.profile, g, month || this.currentMonth);
    },

    /* ---- Export ---- */
    exportActiveJSON() {
      if (!this.profile) return;
      downloadJSON(this.profile);
      this.pushToast("Profile downloaded.");
    },
    exportFilename() {
      return this.profile ? suggestedFilename(this.profile) : "";
    },
    exportAllProfilesJSON() {
      var index = this.profiles || [];
      if (!index.length) return;
      var profiles = index
        .map(function (entry) { return loadProfile(entry.id); })
        .filter(Boolean);
      if (!profiles.length) {
        this.pushToast("No profiles available to export.", "warn");
        return;
      }
      downloadBundle(profiles);
      this.pushToast("Exported " + profiles.length + " profile" + (profiles.length === 1 ? "" : "s") + " as one bundle.");
    },
    exportBundleFilename() { return suggestedBundleFilename(); },

    /* ---- JSON import ---- */
    parseImportJSON(text) { return parseJSON(text); },

    importJSONAsNew(parsed) {
      if (!parsed || !parsed.ok) return null;
      /* Bundle: import every profile as new. */
      if (parsed.kind === "bundle") {
        var self = this;
        var index = _readJSON(_profilesIndexKey()) || [];
        var imported = [];
        parsed.profiles.forEach(function (p) {
          var fresh = cloneAsNew({ ok: true, profile: p });
          _writeJSON(_profileKey(fresh.id), fresh);
          index.push({ id: fresh.id, name: fresh.name, lastOpenedAt: fresh.updatedAt, schemaVersion: fresh.schemaVersion });
          imported.push(fresh);
        });
        _writeJSON(_profilesIndexKey(), index);
        this.refreshProfiles();
        if (imported.length) this._load(imported[0].id);
        this.pushToast("Imported " + imported.length + " profile" + (imported.length === 1 ? "" : "s") + " from bundle.");
        return imported;
      }
      var fresh = cloneAsNew(parsed);
      var index = _readJSON(_profilesIndexKey()) || [];
      _writeJSON(_profileKey(fresh.id), fresh);
      index.push({ id: fresh.id, name: fresh.name, lastOpenedAt: fresh.updatedAt, schemaVersion: fresh.schemaVersion });
      _writeJSON(_profilesIndexKey(), index);
      this.refreshProfiles();
      this._load(fresh.id);
      this.pushToast("Imported '" + fresh.name + "' as a new profile.");
      return fresh;
    },

    importJSONReplacing(parsed, confirmedName) {
      if (!parsed || !parsed.ok || !this.profile) return false;
      if (confirmedName !== this.profile.name) {
        this.pushToast("Replace cancelled — typed name did not match.", "warn");
        return false;
      }
      var replaced = importReplacing(parsed, this.profile.id);
      _writeJSON(_profileKey(replaced.id), replaced);
      this.profile = replaced;
      this.refreshProfiles();
      this.pushToast("Active profile replaced with imported data.");
      return true;
    },

    /* ---- CSV / OFX / QIF / GoCardless import ---- */
    parseCSVText(text) {
      var parsed = parseCSV(text);
      var detection = csvDetect(parsed.headers);
      return { headers: parsed.headers, rows: parsed.rows, detection: detection };
    },

    applyCSVMapping(rows, columnMap) { return applyMapping(rows, columnMap); },

    dryRunCSV(accountId, rows) {
      if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
      return csvDryRun(this.profile, accountId, rows);
    },

    parseOFXText(text) { return parseOFX(text); },
    dryRunOFX(accountId, rows) {
      if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
      return ofxDryRun(this.profile, accountId, rows);
    },

    parseQIFText(text) { return parseQIF(text); },
    dryRunQIF(accountId, rows) {
      if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
      return qifDryRun(this.profile, accountId, rows);
    },

    parseGoCardlessText(text) { return parseGoCardless(text); },
    dryRunGoCardless(accountId, rows) {
      if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
      return gcDryRun(this.profile, accountId, rows);
    },

    /* Commit non-duplicate rows as real transactions. Categories are
       matched by name (case-insensitive); unmatched categories become
       null. Returns { added, skipped } counts. */
    commitImport(accountId, rows) {
      if (!this.profile) return { added: 0, skipped: 0 };
      var self = this;
      var added = 0;
      var skipped = 0;
      rows.forEach(function (r) {
        if (r.duplicate) { skipped += 1; return; }
        if (!r.date || !r.amount) { skipped += 1; return; }
        var catId = null;
        if (r.category) {
          var match = self.profile.categories.find(function (c) {
            return c.name.toLowerCase() === r.category.toLowerCase();
          });
          if (match) catId = match.id;
        }
        self.addTransaction({
          accountId: accountId,
          date: r.date,
          payeeName: r.payee,
          categoryId: catId,
          amount: r.amount,
          memo: r.memo,
          cleared: !!r.cleared,
        });
        added += 1;
      });
      this.pushToast("Imported " + added + " transaction" + (added === 1 ? "" : "s") + (skipped ? " (" + skipped + " skipped)" : "") + ".");
      return { added: added, skipped: skipped };
    },

    /* ---- Reports ---- */
    reportIncomeVsExpense(endMonth, count) {
      return this.profile ? incomeVsExpense(this.profile, endMonth || this.currentMonth, count) : [];
    },
    reportNetWorth(endMonth, count) {
      return this.profile ? netWorthByMonth(this.profile, endMonth || this.currentMonth, count) : [];
    },
    reportSpending(fromMonth, toMonth) {
      if (!this.profile) return [];
      var to = toMonth || this.currentMonth;
      var from = fromMonth || to;
      return spendingByCategory(this.profile, from, to);
    },
    reportTrends(endMonth, count, topN) {
      return this.profile ? monthlyTrendsByCategory(this.profile, endMonth || this.currentMonth, count, topN) : [];
    },
    reportDebt() {
      return this.profile ? debtOverview(this.profile) : [];
    },
    reportAssignmentHistory(endMonth, count, topN) {
      return this.profile ? assignmentHistory(this.profile, endMonth || this.currentMonth, count, topN) : [];
    },
    reportProjection(count) {
      return this.profile ? projection(this.profile, count) : [];
    },

    /* ---- Toast helpers ---- */
    pushToast(message, kind, sticky) {
      var id = Math.random().toString(36).slice(2);
      var t = { id: id, message: message, kind: kind || "info", sticky: !!sticky };
      this.toasts.push(t);
      if (!sticky) {
        var self = this;
        setTimeout(function () { self.dismissToast(id); }, 4500);
      }
    },

    dismissToast(id) {
      this.toasts = this.toasts.filter(function (t) { return t.id !== id; });
    },
  };
}
