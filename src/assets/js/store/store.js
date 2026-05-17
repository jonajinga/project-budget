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
/* loadSampleIfFirstVisit() needs to fetch the sample bundle, parse
   it, register a fresh profile, and persist the index — pulling in
   the JSON-import helpers + the persistence raw-key helpers below.
   These used to live alongside the import/export slice but are
   needed here too because sample-load happens during init() before
   slices have done anything else. */
import { parseFile as parseJSON, importAsNew as cloneAsNew } from "../io/import-json.js";
import {
  profileKey as _profileKey, profilesIndexKey as _profilesIndexKey,
  writeJSON as _writeJSON, readJSON as _readJSON,
} from "./persist.js";
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

/* Accounts methods (groups, CRUD, derivations, collapsed-state) all
   extracted to ./slices/accounts.js. ACCOUNT_TYPES is the only
   top-level constant the templates re-expose, so it stays imported
   here. The schema factory functions (newAccount, newCategoryGroup,
   etc.) are now imported by the slices that need them. */
import { ACCOUNT_TYPES } from "../domain/accounts.js";
/* Transaction mutators (single-row + bulk + trash + transfer + splits)
   all extracted to ./slices/transactions.js. purgeExpiredTrash is the
   only domain helper still used here — fires on init to clean stale
   trash entries before the user opens the trash page. */
import { purgeExpiredTrash } from "../domain/transactions.js";
/* Payee admin extracted to ./slices/payees.js. upsertPayee moved to
   the transactions slice (it's only used by add/edit/bulk-rename
   methods that live there now). */
/* Scheduled-txn mutators extracted to ./slices/scheduled.js. Only
   the constants the templates re-expose stay imported here. */
import {
  FREQUENCIES, CUSTOM_UNITS, frequencyLabel, occurrencesIn,
} from "../domain/scheduled.js";
/* Reconciliation methods extracted to ./slices/reconcile.js.
   Categories admin + lookups extracted to ./slices/categories.js.
   Payment-category helpers are now owned by ./slices/accounts.js
   (where the credit-card add/rename/retype/delete plumbing lives). */
/* Budget methods extracted to ./slices/budget.js. thisMonth is the
   only domain helper still used at the top level (to seed
   currentMonth on store init). */
import { thisMonth } from "../domain/budget.js";
/* GOAL_TYPES is the only top-level export the store re-exposes for
   templates; the per-method delegations live in ./slices/goals.js. */
import { GOAL_TYPES } from "../domain/goals.js";
/* Page-specific slices live in ./slices/. Each one is a plain object
   of methods that `this`-binds to the store at call time;
   Object.assign at the end of createStore() composes them in.

   Per-page slice imports were considered as a tree-shaking play —
   only load the slices each route uses. Rejected: the entire slice
   source is ~115 KB uncompressed (much smaller after Terser), the
   savings would be a handful of KB per page, and splitting createStore
   by route would force every cross-slice method call (e.g.
   accountsSlice.addAccount touching the categories slice's
   ensurePaymentCategory via `this`) to either bundle both sides or
   guard at call time. Net cost > benefit. Single composed store
   stays the design. */
import { reportsSlice } from "./slices/reports.js";
import { dashboardSlice } from "./slices/dashboard.js";
import { importExportSlice } from "./slices/import-export.js";
import { goalsSlice } from "./slices/goals.js";
import { reconcileSlice } from "./slices/reconcile.js";
import { scheduledSlice } from "./slices/scheduled.js";
import { payeesSlice } from "./slices/payees.js";
import { snapshotsSlice } from "./slices/snapshots.js";
import { accountsSlice } from "./slices/accounts.js";
import { categoriesSlice } from "./slices/categories.js";
import { budgetSlice } from "./slices/budget.js";
import { transactionsSlice } from "./slices/transactions.js";
import { rulesSlice } from "./slices/rules.js";

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
    _bumpLists() {
      this._listVersion += 1;
      /* Invalidate the store-level memoization cache. Callers
         pre-bumped will compute fresh values on next read. */
      this._memoStore = null;
      this._memoStoreVersion = -1;
    },

    /* Store-level memoization for expensive derivations (accountBalance,
       reportSpending, reportIncomeVsExpense, netWorth, etc.). The cache
       is keyed implicitly on _listVersion — any mutation that calls
       _bumpLists() drops the cache, so cached values are always fresh.
       Use for any pure function of `this.profile` that's called from
       multiple bindings per render (dashboard reads accountBalance for
       every account; reports walk all transactions). */
    _memoStore: null,
    _memoStoreVersion: -1,
    _memo(key, compute) {
      if (this._memoStoreVersion !== this._listVersion || !this._memoStore) {
        this._memoStore = Object.create(null);
        this._memoStoreVersion = this._listVersion;
      }
      if (key in this._memoStore) return this._memoStore[key];
      var v = compute();
      this._memoStore[key] = v;
      return v;
    },

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
      /* Safety: never let the loading overlay trap the UI. If init
         hasn't flipped loading=false in 4s (slow Dexie restore,
         large profile deserialization, etc.) force-clear it. The
         user gets to interact even if the profile is still arriving
         in the background. */
      var self = this;
      var safety = setTimeout(function () {
        if (self.loading) {
          console.warn("Store init exceeded 4s, forcing loading=false");
          self.loading = false;
        }
      }, 4000);
      this._loadingSafety = safety;
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
          if (self._loadingSafety) { clearTimeout(self._loadingSafety); self._loadingSafety = null; }
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
           isn't empty. Deferred a tick so it doesn't fight with the
           current page's initial render. */
        var self = this;
        setTimeout(function () { self.loadSampleIfFirstVisit(); }, 0);
      }
    },

    /* Fetches /assets/sample/sample.json and registers it as a profile.
       Marked as sample so the app shell can show a starter banner.
       Sets the seen flag BEFORE the async fetch so concurrent calls
       (some Alpine setups re-enter init) can't both create profiles. */
    async loadSampleIfFirstVisit() {
      /* Versioned flag key — bump the suffix whenever the bundled
         sample is meaningfully changed so previously-seeded users
         get the new dataset on next visit (they keep all their own
         profiles; we just add the new sample alongside). The v2
         bump in 2026-05 ships the 6-person 1,399-txn household. */
      var flagKey = "projectbudget:sample-loaded-v2";
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








    /* ---- Slices composed onto this object at the bottom of
       createStore() ----------------------------------------------
         · Accounts ………………………………………………… ./slices/accounts.js
         · Categories + reordering ……………… ./slices/categories.js
         · Budget math + templates ……………… ./slices/budget.js
         · Transactions + bulk + trash …… ./slices/transactions.js
         · Snapshots + daily backups …… ./slices/snapshots.js
         · Payees …………………………………………………… ./slices/payees.js
         · Scheduled txns ………………………………… ./slices/scheduled.js
         · Reconciliation ……………………………… ./slices/reconcile.js
         · Goals ……………………………………………………… ./slices/goals.js
         · Export / import ……………………………… ./slices/import-export.js
         · Reports ………………………………………………… ./slices/reports.js
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
  /* Accounts slice goes FIRST in the composition order: addTransaction
     and other transactions/categories methods that survive on `base`
     call this.findAccount(), so the slice's method must already be on
     the object before any later slice's mutator can run. (In practice
     order doesn't matter for any current method, but listing accounts
     first keeps the read order obvious.) */
  return Object.assign(
    base,
    accountsSlice,
    categoriesSlice,
    budgetSlice,
    rulesSlice,
    transactionsSlice,
    snapshotsSlice,
    payeesSlice,
    scheduledSlice,
    reconcileSlice,
    goalsSlice,
    importExportSlice,
    reportsSlice,
    dashboardSlice
  );
}
