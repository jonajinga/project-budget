/* Alpine store: window.Alpine.store('budget').
   Templates bind to this object's reactive state. Every mutator that
   touches the active profile calls _save() so the change debounces to
   localStorage. */

import {
  listProfiles, getActiveId, setActiveId, loadProfile,
  createProfile, renameProfile, duplicateProfile, deleteProfile,
  restoreFromTrash, permanentlyDeleteFromTrash, listTrash, pruneTrash, switchTo,
  freshStart, trimHistory,
} from "./profile.js";
import { scheduleSave, isPrivateBrowsing, estimateUsedBytes, QUOTA_BYTES } from "./persist.js";
/* Manual snapshots + backups extracted to ./slices/snapshots.js.
   snapshotIfStale still triggered from the init / profile-switch
   paths here so daily backups always fire on app open. */
import { snapshotIfStale } from "./backup.js";
import * as dexie from "./db.js";

/* JSON round-trip clone: strips Alpine reactive Proxies so the result
   is a plain object that IndexedDB's structured-clone can serialize. */
function unwrap(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

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
  restoreTxnFromTrash, purgeTxnFromTrash, emptyTrash as emptyTrashImpl, purgeExpiredTrash,
} from "../domain/transactions.js";
/* Payee admin extracted to ./slices/payees.js. upsertPayee still
   used here by the transactions methods (addTransaction, etc.). */
import { upsertPayee } from "../domain/payees.js";
/* Scheduled-txn mutators extracted to ./slices/scheduled.js. Only
   the constants the templates re-expose stay imported here. */
import {
  FREQUENCIES, CUSTOM_UNITS, frequencyLabel, occurrencesIn,
} from "../domain/scheduled.js";
/* Reconciliation methods extracted to ./slices/reconcile.js. */
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
/* GOAL_TYPES is the only top-level export the store re-exposes for
   templates; the per-method delegations live in ./slices/goals.js. */
import { GOAL_TYPES } from "../domain/goals.js";
/* Page-specific slices live in ./slices/. Each one is a plain object
   of methods that `this`-binds to the store at call time;
   Object.assign at the end of createStore() composes them in. */
import { reportsSlice } from "./slices/reports.js";
import { dashboardSlice } from "./slices/dashboard.js";
import { importExportSlice } from "./slices/import-export.js";
import { goalsSlice } from "./slices/goals.js";
import { reconcileSlice } from "./slices/reconcile.js";
import { scheduledSlice } from "./slices/scheduled.js";
import { payeesSlice } from "./slices/payees.js";
import { snapshotsSlice } from "./slices/snapshots.js";

export function createStore() {
  var base = {
    profiles: [],
    active: null,
    profile: null,
    lastSavedAt: null,
    toasts: [],
    privateBrowsing: false,
    /* True while the initial profile load is in flight. Pages can
       x-show a loading overlay until this flips false in init()'s
       finally block. */
    loading: true,
    /* Populated with the error message if init() throws — surfaces
       in the toast + lets the diagnostics page show context. */
    loadError: null,

    /* Collapsed-state maps live directly on the Alpine store (not on the
       profile schema) so reactivity is rock-solid: x-for/x-show bindings
       read $store.budget.collapsedCatGroups[id] and the store's own
       Proxy fires setters on assignment. Persisted to profile.<type>Groups
       on save so the choice survives reloads. */
    collapsedCatGroups: {},
    collapsedAcctGroups: {},

    /* Expose domain constants for templates. */
    ACCOUNT_TYPES: ACCOUNT_TYPES,
    FREQUENCIES: FREQUENCIES,
    CUSTOM_UNITS: CUSTOM_UNITS,
    GOAL_TYPES: GOAL_TYPES,
    frequencyLabel: frequencyLabel,
    occurrencesIn: occurrencesIn,

    /* Active budget month — what the budget UI is currently viewing. */
    currentMonth: thisMonth(),

    /* Reactivity bridge for list functions that read localStorage. Alpine's
       fine-grained reactivity only tracks reads of reactive store props,
       so list functions that walk localStorage need to read this counter
       to register a dependency. Mutators bump the counter so x-for / x-show
       bindings re-evaluate on next tick. */
    _listVersion: 0,
    _bumpLists() { this._listVersion += 1; },

    /* Transactional bulk-mutation wrapper. Snapshot the profile,
       run the mutator. If it throws, restore the snapshot. On
       success, _bumpLists + _save fire ONCE at the end instead of
       N times during the mutator loop. Use for CSV import, profile
       restore, bulk recategorize — anything that mutates many
       items in a row.

       Returns whatever the mutator returns (so callers can
       capture row counts, error lists, etc.). Re-throws on
       failure after rollback so callers can catch + toast.

       Note: nested batchMutate calls are no-ops — the outer call
       owns the save. Useful when a high-level operation wraps
       another batched helper. */
    _inBatch: false,
    batchMutate(fn, label) {
      if (this._inBatch) return fn();
      if (!this.profile) return;
      this._inBatch = true;
      this._recordUndo(label || "Bulk operation");
      var snapshot = JSON.parse(JSON.stringify(this.profile));
      try {
        var result = fn();
        this._bumpLists();
        this._save();
        return result;
      } catch (err) {
        /* Roll back to the snapshot — undo entry stays so the user
           can also undo manually if they want. */
        this.profile = snapshot;
        this._bumpLists();
        this._save();
        this.pushToast(
          "Bulk operation failed: " + (err && err.message ? err.message : err),
          "danger",
          true
        );
        throw err;
      } finally {
        this._inBatch = false;
      }
    },

    /* ---- Undo / redo ----
       Snapshot-based history. _recordUndo("…") deep-clones the active
       profile and pushes it onto _undoStack BEFORE the caller mutates.
       Any user-initiated mutation invalidates _redoStack (you can't
       redo past a branch). undo() and redo() swap the active profile
       with the next snapshot, bumping lists so the UI re-renders.
       Stack capped at _UNDO_LIMIT entries; older entries drop off. */
    _undoStack: [],
    _redoStack: [],
    _UNDO_LIMIT: 50,
    _suppressUndo: false,

    _snapshotProfile() {
      if (!this.profile) return null;
      /* JSON clone is safe + fast — profile is plain data. */
      try { return JSON.parse(JSON.stringify(this.profile)); }
      catch (_e) { return null; }
    },
    _recordUndo(label) {
      if (this._suppressUndo || !this.profile) return;
      var snap = this._snapshotProfile();
      if (!snap) return;
      this._undoStack.push({ label: label || "Action", profileId: this.active, snapshot: snap });
      if (this._undoStack.length > this._UNDO_LIMIT) this._undoStack.shift();
      /* New action invalidates the redo branch. */
      this._redoStack = [];
    },
    _restoreSnapshot(entry) {
      if (!entry || !entry.snapshot) return false;
      var idx = this.profiles.findIndex(function (p) { return p.id === entry.profileId; });
      if (idx < 0) return false;
      this.profiles[idx] = entry.snapshot;
      if (this.active === entry.profileId) this.profile = this.profiles[idx];
      return true;
    },
    canUndo() { return this._undoStack.length > 0; },
    canRedo() { return this._redoStack.length > 0; },
    undoLabel() {
      var top = this._undoStack[this._undoStack.length - 1];
      return top ? top.label : "";
    },
    redoLabel() {
      var top = this._redoStack[this._redoStack.length - 1];
      return top ? top.label : "";
    },
    undo() {
      if (!this._undoStack.length) return;
      var entry = this._undoStack.pop();
      /* Snapshot current state for redo BEFORE we restore. */
      var current = this._snapshotProfile();
      if (current) this._redoStack.push({ label: entry.label, profileId: this.active, snapshot: current });
      this._suppressUndo = true;
      try {
        if (this._restoreSnapshot(entry)) {
          this._bumpLists();
          this._save();
          this.pushToast("Undone: " + entry.label);
        }
      } finally { this._suppressUndo = false; }
    },
    redo() {
      if (!this._redoStack.length) return;
      var entry = this._redoStack.pop();
      var current = this._snapshotProfile();
      if (current) this._undoStack.push({ label: entry.label, profileId: this.active, snapshot: current });
      this._suppressUndo = true;
      try {
        if (this._restoreSnapshot(entry)) {
          this._bumpLists();
          this._save();
          this.pushToast("Redone: " + entry.label);
        }
      } finally { this._suppressUndo = false; }
    },
    _clearHistory() { this._undoStack = []; this._redoStack = []; },

    /* Persistence backend status. Populated during init():
       - "localStorage"  : Dexie unavailable; writes go to localStorage only
       - "mirrored"      : Both Dexie and localStorage receive every write
       Surfaced on /app/settings/ as the "Storage backend" line. */
    storageBackend: "localStorage",
    storageMigration: null,    /* result of the one-time LS -> Dexie scan */

    init() {
      this.loading = true;
      this.loadError = null;
      this.privateBrowsing = isPrivateBrowsing();
      if (this.privateBrowsing) {
        this.pushToast(
          "This browser session is private. Data will not persist when you close the window. Export before closing.",
          "warn",
          true
        );
      }
      try { pruneTrash(); } catch (e) { console.warn("pruneTrash failed:", e); }

      /* Boot order:
         1. Check whether Dexie is usable. Sets storageBackend.
         2. One-time migration from localStorage to Dexie (if user is
            upgrading from a pre-Dexie build).
         3. If localStorage has no profiles but Dexie does, restore from
            Dexie (covers users whose localStorage was wiped while
            IndexedDB persisted).
         4. Then run the normal in-memory boot from localStorage.

         Each step is wrapped — total init failure surfaces as a sticky
         danger toast so the user knows something's wrong instead of
         silently sitting with an empty UI. */
      var self = this;
      this._bootDexie().catch(function (e) {
        console.warn("Dexie boot failed (will keep using localStorage):", e);
      }).finally(function () {
        try {
          self._bootFromLocalStorage();
        } catch (err) {
          console.error("Profile load failed:", err);
          self.loadError = (err && err.message) || String(err);
          self.pushToast(
            "Couldn't load your data. " + self.loadError + " Open Diagnostics for details.",
            "danger",
            true
          );
        } finally {
          self.loading = false;
        }
      });
    },

    /* Try to open Dexie, migrate localStorage if needed, and reverse-restore
       if localStorage is empty but Dexie has data. All steps are non-fatal —
       any failure falls back to localStorage-only. */
    async _bootDexie() {
      var available = await dexie.isAvailable();
      if (!available) {
        this.storageBackend = "localStorage";
        return;
      }
      this.storageBackend = "mirrored";

      /* Forward migration: copy any localStorage data into Dexie once. */
      try {
        this.storageMigration = await dexie.migrateLocalStorageIfNeeded(
          typeof localStorage !== "undefined" ? localStorage : null
        );
      } catch (_e) { /* migration is best-effort */ }

      /* Reverse restore: if localStorage is empty but Dexie has profiles,
         copy them back so the rest of the app (which reads sync from
         localStorage) can see them. */
      try {
        if (!listProfiles().length) {
          var dexieProfiles = await dexie.listProfilesDB();
          if (dexieProfiles.length) {
            var index = dexieProfiles.map(function (p) {
              return { id: p.id, name: p.name, lastOpenedAt: p.updatedAt, schemaVersion: p.schemaVersion };
            });
            localStorage.setItem("projectbudget:profiles", JSON.stringify(index));
            dexieProfiles.forEach(function (p) {
              localStorage.setItem("projectbudget:profile:" + p.id, JSON.stringify(p));
            });
            var activeFromMeta = await dexie.getMeta("active");
            if (activeFromMeta) localStorage.setItem("projectbudget:active", activeFromMeta);
            this.pushToast("Restored " + dexieProfiles.length + " profile(s) from IndexedDB.");
          }
        }
      } catch (_e) {}
    },

    _bootFromLocalStorage() {
      this.refreshProfiles();
      var id = getActiveId();
      if (id && this.profiles.find(function (p) { return p.id === id; })) {
        this._load(id);
      } else if (!this.profiles.length && !this.privateBrowsing) {
        /* First-time visitor — auto-load the bundled sample so the app
           isn't empty. */
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
      /* Migration: older profiles don't have the trash array. Seed it
         so every consumer (delete, restore, /app/trash/) sees a
         predictable shape. Then drop anything older than 30 days so
         the bin doesn't grow without bound. */
      if (!p.trash) p.trash = [];
      purgeExpiredTrash(p, 30);
      this.profile = p;
      this.active = id;
      setActiveId(id);
      this._mirrorActive(id);
      this._hydrateCollapsed();
      var snapKey = snapshotIfStale(p);
      if (snapKey) {
        /* snapKey is the localStorage key; mirror the same backup into
           Dexie keyed by [profileId, day]. */
        var parts = snapKey.split(":"); // projectbudget : backup : profileId : day
        this._mirrorBackup(parts[2], parts[3], p);
      }
      this._bumpLists();
    },

    _hydrateCollapsed() {
      var cat = {};
      var acct = {};
      (this.profile.categoryGroups || []).forEach(function (g) { if (g.collapsed) cat[g.id] = true; });
      (this.profile.accountGroups  || []).forEach(function (g) { if (g.collapsed) acct[g.id] = true; });
      this.collapsedCatGroups = cat;
      this.collapsedAcctGroups = acct;
    },

    _save() {
      if (!this.profile) return;
      var self = this;
      scheduleSave(
        this.profile,
        function () {
          self.lastSavedAt = new Date();
          self.refreshProfiles();
          /* Mirror to Dexie. Fire-and-forget — localStorage already
             committed, Dexie failure is non-fatal. Clone via JSON
             round-trip so we hand IndexedDB a plain object instead of
             Alpine's reactive Proxy (structured-clone can't handle it). */
          if (self.storageBackend === "mirrored") {
            dexie.putProfile(unwrap(self.profile)).catch(function (e) {
              console.warn("Dexie putProfile failed:", e);
            });
          }
        },
        function (err) {
          var msg = (err && err.name === "QuotaExceededError")
            ? "Browser storage is full. Export and free some space."
            : "Could not save changes. Check browser storage settings.";
          self.pushToast(msg, "danger", true);
        }
      );
    },

    /* Mirror helpers — fire-and-forget. The store calls these alongside
       localStorage mutations so the two backends stay in lockstep without
       blocking the UI on async I/O. Every payload passed to Dexie is
       unwrap()ped to a plain object first — IndexedDB's structured-clone
       throws DataCloneError on Alpine's reactive Proxies. */
    _mirrorProfileDelete(id) {
      if (this.storageBackend !== "mirrored") return;
      dexie.deleteProfileDB(id).catch(function (e) { console.warn("Dexie deleteProfile failed:", e); });
    },
    _mirrorSnapshot(profileId, rec) {
      if (this.storageBackend !== "mirrored") return;
      dexie.putSnapshot(profileId, unwrap(rec)).catch(function (e) { console.warn("Dexie putSnapshot failed:", e); });
    },
    _mirrorSnapshotDelete(profileId, snapshotId) {
      if (this.storageBackend !== "mirrored") return;
      dexie.deleteSnapshotDB(profileId, snapshotId).catch(function (e) { console.warn("Dexie deleteSnapshot failed:", e); });
    },
    _mirrorBackup(profileId, day, profile) {
      if (this.storageBackend !== "mirrored") return;
      dexie.putBackup(profileId, day, unwrap(profile)).catch(function (e) { console.warn("Dexie putBackup failed:", e); });
    },
    _mirrorActive(id) {
      if (this.storageBackend !== "mirrored") return;
      dexie.setMeta("active", id || "").catch(function () {});
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
      this._mirrorProfileDelete(id);
      if (this.active === id) {
        this.active = null;
        this.profile = null;
        this._mirrorActive(null);
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
      this._hydrateCollapsed();
      this.refreshProfiles();
      snapshotIfStale(p);
    },

    /* ---- Trash ---- */
    listTrashedProfiles() {
      void this._listVersion;
      return listTrash();
    },

    restoreTrashedProfile(id) {
      var p = restoreFromTrash(id);
      if (!p) {
        this.pushToast("Could not restore profile.", "danger");
        return null;
      }
      /* Re-mirror to Dexie so the two backends match again. */
      if (this.storageBackend === "mirrored") {
        dexie.putProfile(unwrap(p)).catch(function (e) { console.warn("Dexie putProfile failed:", e); });
      }
      this.refreshProfiles();
      this._bumpLists();
      this.pushToast("Profile '" + p.name + "' restored.");
      return p;
    },

    permanentlyDeleteTrashed(id, confirmedName) {
      var entry = listTrash().find(function (e) { return e.id === id; });
      if (!entry) return false;
      if (confirmedName !== entry.name) {
        this.pushToast("Permanent delete cancelled — typed name did not match.", "warn");
        return false;
      }
      permanentlyDeleteFromTrash(id);
      this._bumpLists();
      this.pushToast("Profile '" + entry.name + "' permanently deleted.");
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
      var a = findAccount(this.profile, id);
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
      var a = findAccount(this.profile, id);
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
      var a = findAccount(this.profile, id);
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
      var a = findAccount(this.profile, id);
      if (!a) return;
      a.closedAt = new Date().toISOString();
      this._bumpLists();
      this._save();
      this.pushToast("Account '" + a.name + "' closed.");
    },

    reopenAccount(id) {
      if (!this.profile) return;
      var a = findAccount(this.profile, id);
      if (!a) return;
      a.closedAt = null;
      this._bumpLists();
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
    onBudgetTotal() { return this.profile ? onBudgetTotal(this.profile) : 0; },
    trackingAssetTotal() { return this.profile ? trackingAssetTotal(this.profile) : 0; },
    trackingLiabilityTotal() { return this.profile ? trackingLiabilityTotal(this.profile) : 0; },
    netWorth() { return this.profile ? netWorth(this.profile) : 0; },
    findAccount(id) { return this.profile ? findAccount(this.profile, id) : null; },

    /* ---- Transactions ---- */
    addTransaction(opts) {
      if (!this.profile) return null;
      this._recordUndo("Add transaction");
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
      this._recordUndo("Edit transaction");
      if (patch.payeeName !== undefined) {
        var p = upsertPayee(this.profile, patch.payeeName, patch.categoryId || null);
        patch.payeeId = p ? p.id : null;
        delete patch.payeeName;
      }
      if (patch.amount !== undefined) patch.amount = Math.round(Number(patch.amount) || 0);
      var result = editTxnImpl(this.profile, id, patch);
      /* If it's part of a transfer pair, mirror the change. */
      if (result && result.transferTxnId) syncTransferPair(this.profile, id);
      this._bumpLists();
      this._save();
      return result;
    },

    deleteTransaction(id) {
      if (!this.profile) return false;
      this._recordUndo("Delete transaction");
      var ok = deleteTxnImpl(this.profile, id);
      if (ok) {
        this._bumpLists();
        this._save();
        this.pushToast("Transaction moved to Trash. Restore from /app/trash/ within 30 days.");
      }
      return ok;
    },

    /* ---- Bulk operations on transactions ----
       All three are wrapped in batchMutate so the entire set commits
       atomically — if any single row fails, the whole batch rolls
       back to the pre-batch snapshot. Reconciled rows are silently
       skipped (they're locked from edit by design). Returns the
       number of rows actually mutated. */

    /** Reassign every transaction in `ids` to `categoryId` (or null
     *  for uncategorized). Skips splits (split txns derive their
     *  category from the splits themselves) and reconciled rows. */
    bulkRecategorize(ids, categoryId) {
      if (!this.profile || !Array.isArray(ids) || !ids.length) return 0;
      var self = this;
      var catId = categoryId || null;
      return this.batchMutate(function () {
        var n = 0;
        ids.forEach(function (id) {
          var t = self.profile.transactions.find(function (x) { return x.id === id; });
          if (!t || t.reconciled || (t.splits && t.splits.length)) return;
          editTxnImpl(self.profile, id, { categoryId: catId });
          n += 1;
        });
        return n;
      }, "Bulk recategorize");
    },

    /** Rename the payee on every transaction in `ids`. Upserts the
     *  payee record (creates if missing). Skips reconciled and
     *  transfer rows. */
    bulkRenamePayee(ids, payeeName) {
      if (!this.profile || !Array.isArray(ids) || !ids.length) return 0;
      var name = (payeeName || "").trim();
      if (!name) return 0;
      var self = this;
      return this.batchMutate(function () {
        var p = upsertPayee(self.profile, name, null);
        var pid = p ? p.id : null;
        var n = 0;
        ids.forEach(function (id) {
          var t = self.profile.transactions.find(function (x) { return x.id === id; });
          if (!t || t.reconciled || t.transferTxnId) return;
          editTxnImpl(self.profile, id, { payeeId: pid });
          n += 1;
        });
        return n;
      }, "Bulk rename payee");
    },

    /** Move every transaction in `ids` to the trash. Skips reconciled
     *  rows. Transfers cascade via the existing deleteTxnImpl logic. */
    bulkDeleteTransactions(ids) {
      if (!this.profile || !Array.isArray(ids) || !ids.length) return 0;
      var self = this;
      return this.batchMutate(function () {
        var n = 0;
        ids.forEach(function (id) {
          var t = self.profile.transactions.find(function (x) { return x.id === id; });
          if (!t || t.reconciled) return;
          if (deleteTxnImpl(self.profile, id)) n += 1;
        });
        return n;
      }, "Bulk delete");
    },

    /* ---- Trash management ---- */
    listTrashedTransactions() {
      void this._listVersion;
      if (!this.profile || !this.profile.trash) return [];
      return this.profile.trash.slice().sort(function (a, b) {
        return (b.deletedAt || "").localeCompare(a.deletedAt || "");
      });
    },
    restoreTransactionFromTrash(id) {
      if (!this.profile) return null;
      this._recordUndo("Restore transaction");
      var rec = restoreTxnFromTrash(this.profile, id);
      this._bumpLists();
      this._save();
      if (rec) this.pushToast("Restored.");
      return rec;
    },
    purgeTransactionFromTrash(id) {
      if (!this.profile) return false;
      this._recordUndo("Purge transaction");
      var ok = purgeTxnFromTrash(this.profile, id);
      this._bumpLists();
      this._save();
      if (ok) this.pushToast("Purged.");
      return ok;
    },
    emptyTransactionTrash() {
      if (!this.profile) return 0;
      this._recordUndo("Empty transaction trash");
      var n = emptyTrashImpl(this.profile);
      this._bumpLists();
      this._save();
      if (n) this.pushToast("Emptied " + n + " trashed item" + (n === 1 ? "" : "s") + ".");
      return n;
    },

    setSplits(id, splits) {
      if (!this.profile) return null;
      this._recordUndo(splits ? "Edit splits" : "Clear splits");
      var t = splitTxnImpl(this.profile, id, splits);
      this._save();
      return t;
    },

    transfer(opts) {
      if (!this.profile) return null;
      this._recordUndo("Transfer");
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




    /* ---- Categories ----
       Every mutator bumps _listVersion so categoryGroupsView()'s
       reactivity tripwire fires and the budget grid re-renders
       without a manual refresh. */
    addCategoryGroup(name) {
      if (!this.profile) return null;
      this._recordUndo("Add group");
      var g = addCategoryGroupImpl(this.profile, name);
      this._bumpLists();
      this._save();
      return g;
    },
    renameCategoryGroup(id, name) {
      if (!this.profile) return;
      this._recordUndo("Rename group");
      renameCategoryGroupImpl(this.profile, id, name);
      this._bumpLists();
      this._save();
    },
    deleteCategoryGroup(id) {
      if (!this.profile) return;
      this._recordUndo("Delete group");
      deleteCategoryGroupImpl(this.profile, id);
      this._bumpLists();
      this._save();
    },
    addCategory(opts) {
      if (!this.profile) return null;
      this._recordUndo("Add category");
      var c = addCategoryImpl(this.profile, opts);
      this._bumpLists();
      this._save();
      return c;
    },
    renameCategory(id, name) {
      if (!this.profile) return;
      this._recordUndo("Rename category");
      renameCategoryImpl(this.profile, id, name);
      this._bumpLists();
      this._save();
    },
    deleteCategory(id) {
      if (!this.profile) return;
      this._recordUndo("Delete category");
      deleteCategoryImpl(this.profile, id);
      this._bumpLists();
      this._save();
    },
    moveCategoryToGroup(id, groupId) {
      if (!this.profile) return;
      moveCategoryToGroupImpl(this.profile, id, groupId);
      this._bumpLists();
      this._save();
    },

    /* ---- Reordering (drag & drop) ----------------------------------
       All four helpers update sortIndex on the affected siblings so
       categoryGroupsView / accountGroupsView render the new order on
       next read. _bumpLists nudges any consumer that walked
       categoryGroupsView in a prior tick. */
    moveCategoryGroup(id, toIndex) {
      if (!this.profile) return;
      var arr = this.profile.categoryGroups
        .slice()
        .sort(function (a, b) { return a.sortIndex - b.sortIndex; });
      var from = arr.findIndex(function (g) { return g.id === id; });
      if (from < 0) return;
      var moved = arr.splice(from, 1)[0];
      var dest = Math.max(0, Math.min(toIndex, arr.length));
      arr.splice(dest, 0, moved);
      arr.forEach(function (g, i) { g.sortIndex = i; });
      this._bumpLists();
      this._save();
    },

    moveCategory(catId, toGroupId, toIndex) {
      if (!this.profile) return;
      var cat = this.profile.categories.find(function (c) { return c.id === catId; });
      if (!cat) return;
      cat.groupId = toGroupId || null;
      var target = this.profile.categories
        .filter(function (c) { return c.groupId === toGroupId && c.id !== catId; })
        .sort(function (a, b) { return a.sortIndex - b.sortIndex; });
      var dest = Math.max(0, Math.min(toIndex, target.length));
      target.splice(dest, 0, cat);
      target.forEach(function (c, i) { c.sortIndex = i; });
      this._bumpLists();
      this._save();
    },

    moveAccountGroup(id, toIndex) {
      if (!this.profile) return;
      var arr = this.profile.accountGroups
        .slice()
        .sort(function (a, b) { return a.sortIndex - b.sortIndex; });
      var from = arr.findIndex(function (g) { return g.id === id; });
      if (from < 0) return;
      var moved = arr.splice(from, 1)[0];
      var dest = Math.max(0, Math.min(toIndex, arr.length));
      arr.splice(dest, 0, moved);
      arr.forEach(function (g, i) { g.sortIndex = i; });
      this._bumpLists();
      this._save();
    },

    moveAccount(acctId, toGroupId, toIndex) {
      if (!this.profile) return;
      var a = this.profile.accounts.find(function (x) { return x.id === acctId; });
      if (!a) return;
      a.groupId = toGroupId || null;
      var target = this.profile.accounts
        .filter(function (x) { return x.groupId === toGroupId && x.id !== acctId; })
        .sort(function (x, y) { return x.sortIndex - y.sortIndex; });
      var dest = Math.max(0, Math.min(toIndex, target.length));
      target.splice(dest, 0, a);
      target.forEach(function (x, i) { x.sortIndex = i; });
      this._bumpLists();
      this._save();
    },
    findCategory(id) { return this.profile ? findCategory(this.profile, id) : null; },
    findCategoryGroup(id) { return this.profile ? findCategoryGroup(this.profile, id) : null; },
    categoryGroupsView() {
      /* Reactivity tripwire — bumpLists triggers re-render even when
         the profile object reference doesn't change. */
      void this._listVersion;
      return this.profile ? categoryGroupsView(this.profile) : [];
    },
    isPaymentCategory(id) { return this.profile ? isPaymentCategory(this.profile, id) : false; },
    paymentCardId(id) { return this.profile ? paymentCardId(this.profile, id) : null; },
    categoryName(id) {
      var c = this.findCategory(id);
      return c ? c.name : "";
    },

    /* All categories flat — used by dropdowns. Skips hidden by default. */
    categoriesFlat() {
      void this._listVersion;
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

    /* Assign a value (in cents) to a category for a month.
       Replaces the budgets[month] object (and the inner .assigned map)
       with fresh references so every consumer that reads through the
       Alpine proxy sees a top-level property change and re-evaluates.
       Mutating a nested property in place is technically reactive in
       Alpine v3, but downstream re-reads sometimes hold stale values
       when the dependency chain crosses a function boundary
       (categoryRow -> assigned). The fresh-reference assignment is
       bulletproof. */
    assign(categoryId, month, cents) {
      if (!this.profile) return;
      var m = month || this.currentMonth;
      var catName = this.categoryName(categoryId) || "category";
      this._recordUndo("Assign to " + catName);
      var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
      var nextAssigned = Object.assign({}, existing.assigned || {});
      nextAssigned[categoryId] = Math.round(Number(cents) || 0);
      this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
      this._bumpLists();
      this._save();
    },

    /* ---- Bulk-clear helpers ---------------------------------------
       Wipe many assigned values (or push them so available == 0) in
       a single undo entry. Used by the budget page's multi-select
       toolbar + the per-group/per-row "Clear" actions.

       clearAssignedForCategories: sets assigned to 0 for every catId
       in `categoryIds` in `month`. Empty list = no-op.

       clearAvailableForCategories: walks each catId, computes the
       assignment needed so categoryRow(cat).available == 0, and writes
       it. For categories whose available is already 0, no-op. */
    clearAssignedForCategories(categoryIds, month, label) {
      if (!this.profile || !categoryIds || !categoryIds.length) return 0;
      var m = month || this.currentMonth;
      this._recordUndo(label || ("Clear assigned (" + categoryIds.length + ")"));
      var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
      var nextAssigned = Object.assign({}, existing.assigned || {});
      var n = 0;
      categoryIds.forEach(function (id) {
        if (nextAssigned[id]) { nextAssigned[id] = 0; n++; }
      });
      this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
      this._bumpLists();
      this._save();
      return n;
    },
    clearAvailableForCategories(categoryIds, month, label) {
      if (!this.profile || !categoryIds || !categoryIds.length) return 0;
      var m = month || this.currentMonth;
      this._recordUndo(label || ("Clear available (" + categoryIds.length + ")"));
      var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
      var nextAssigned = Object.assign({}, existing.assigned || {});
      var self = this;
      var n = 0;
      categoryIds.forEach(function (id) {
        var row = categoryRow(self.profile, id, m);
        if (row.available === 0) return;
        /* available = carryIn + assigned + activity, so set
           assigned = -carryIn - activity to land on 0. */
        nextAssigned[id] = -row.carryIn - row.activity;
        n++;
      });
      this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
      this._bumpLists();
      this._save();
      return n;
    },
    /* Convenience: every on-budget category id for the active profile
       (skips payment categories — those are derived from card spending
       and don't accept direct assignment safely). */
    allBudgetableCategoryIds() {
      if (!this.profile) return [];
      var self = this;
      return (this.profile.categories || [])
        .filter(function (c) { return !c.hidden && !self.isPaymentCategory(c.id); })
        .map(function (c) { return c.id; });
    },
    /* All category ids belonging to a single group (skips payment +
       hidden). Useful for "select entire group" / "clear assigned for
       this group". */
    categoryIdsInGroup(groupId) {
      if (!this.profile) return [];
      var self = this;
      return (this.profile.categories || [])
        .filter(function (c) { return c.groupId === groupId && !c.hidden && !self.isPaymentCategory(c.id); })
        .map(function (c) { return c.id; });
    },

    /* Move money from one category to another in a single transaction:
       decrement source.assigned by cents, increment target.assigned by
       cents. The net change to "Total assigned" is zero — the user is
       just reallocating. Records ONE undo entry covering both legs. */
    moveMoney(fromCategoryId, toCategoryId, cents, month) {
      if (!this.profile) return false;
      var amt = Math.round(Number(cents) || 0);
      if (!fromCategoryId || !toCategoryId || amt <= 0) return false;
      if (fromCategoryId === toCategoryId) return false;
      var m = month || this.currentMonth;
      var fromName = this.categoryName(fromCategoryId) || "category";
      var toName = this.categoryName(toCategoryId) || "category";
      this._recordUndo("Move money: " + fromName + " → " + toName);
      var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
      var nextAssigned = Object.assign({}, existing.assigned || {});
      nextAssigned[fromCategoryId] = (nextAssigned[fromCategoryId] || 0) - amt;
      nextAssigned[toCategoryId]   = (nextAssigned[toCategoryId]   || 0) + amt;
      this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
      this._bumpLists();
      this._save();
      return true;
    },

    /* ---- Budget templates -----------------------------------------
       A template is a named snapshot of a single month's `assigned`
       map. Save once ("Standard month"), apply to any future month to
       re-create the same allocation. Stored on the profile under
       `budgetTemplates`. Categories that no longer exist when the
       template is applied are silently dropped. */

    listBudgetTemplates() {
      void this._listVersion;
      if (!this.profile) return [];
      return (this.profile.budgetTemplates || []).slice().sort(function (a, b) {
        return (a.name || "").localeCompare(b.name || "");
      });
    },

    saveBudgetTemplate(name, month) {
      if (!this.profile) return null;
      var clean = (name || "").trim();
      if (!clean) return null;
      var m = month || this.currentMonth;
      var src = this.profile.budgets[m] || { assigned: {} };
      var assigned = {};
      Object.keys(src.assigned || {}).forEach(function (catId) {
        var cents = src.assigned[catId];
        if (cents) assigned[catId] = cents;
      });
      this._recordUndo("Save budget template");
      if (!this.profile.budgetTemplates) this.profile.budgetTemplates = [];
      var existing = this.profile.budgetTemplates.find(function (t) { return t.name === clean; });
      var tpl;
      if (existing) {
        existing.assigned = assigned;
        existing.updatedAt = new Date().toISOString();
        tpl = existing;
      } else {
        tpl = {
          id: (typeof crypto !== "undefined" && crypto.randomUUID)
            ? crypto.randomUUID()
            : ("tpl-" + Date.now().toString(36)),
          name: clean,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          assigned: assigned,
        };
        this.profile.budgetTemplates.push(tpl);
      }
      this._bumpLists();
      this._save();
      this.pushToast("Saved budget template \"" + clean + "\".", "ok");
      return tpl;
    },

    applyBudgetTemplate(templateId, month) {
      if (!this.profile) return 0;
      var tpl = (this.profile.budgetTemplates || []).find(function (t) { return t.id === templateId; });
      if (!tpl) return 0;
      var m = month || this.currentMonth;
      var validIds = new Set((this.profile.categories || []).map(function (c) { return c.id; }));
      this._recordUndo("Apply template: " + (tpl.name || "template"));
      var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
      var nextAssigned = Object.assign({}, existing.assigned || {});
      var n = 0;
      Object.keys(tpl.assigned || {}).forEach(function (catId) {
        if (!validIds.has(catId)) return;
        nextAssigned[catId] = tpl.assigned[catId];
        n += 1;
      });
      this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
      this._bumpLists();
      this._save();
      this.pushToast(
        "Applied template — " + n + " categor" + (n === 1 ? "y" : "ies") + " assigned in " + m + ".",
        "ok"
      );
      return n;
    },

    deleteBudgetTemplate(templateId) {
      if (!this.profile || !this.profile.budgetTemplates) return false;
      var i = this.profile.budgetTemplates.findIndex(function (t) { return t.id === templateId; });
      if (i === -1) return false;
      var name = this.profile.budgetTemplates[i].name;
      this._recordUndo("Delete template");
      this.profile.budgetTemplates.splice(i, 1);
      this._bumpLists();
      this._save();
      this.pushToast("Deleted budget template \"" + name + "\".", "ok");
      return true;
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



    /* ---- Slices composed onto this object at the bottom of
       createStore() ----------------------------------------------
         · Snapshots + daily backups …… ./slices/snapshots.js
         · Payees ………………………………………………… ./slices/payees.js
         · Scheduled txns ………………………… ./slices/scheduled.js
         · Reconciliation …………………………… ./slices/reconcile.js
         · Goals ………………………………………………… ./slices/goals.js
         · Export / import …………………………… ./slices/import-export.js
         · Reports …………………………………………… ./slices/reports.js
         · Dashboard widgets ……………………… ./slices/dashboard.js
       The composed slice methods all `this`-bind to this store. */


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
  /* Compose extracted slices onto the base. Each slice is a plain
     object of methods that `this`-binds to the store at call time —
     Object.assign preserves that binding because it copies the
     methods themselves, not bound copies. Order matters only when
     two slices define the same method (later wins). */
  return Object.assign(base, snapshotsSlice, payeesSlice, scheduledSlice, reconcileSlice, goalsSlice, importExportSlice, reportsSlice, dashboardSlice);
}
