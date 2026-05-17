/* Shared test helpers. Build a minimal in-memory "store host" that
   satisfies the slice methods' `this` contract — profile, undo/redo
   no-ops, _save no-op, _bumpLists counter, pushToast no-op. Slices
   work by `this`-binding to whatever object Object.assign composes
   them onto; this helper builds the smallest such host so we can
   call the methods directly without booting Alpine. */

import { newProfile } from "../src/assets/js/store/schema.js";

export function makeHost(slices) {
  var profile = newProfile("Test profile");
  /* Tests want deterministic dates. */
  profile.createdAt = "2024-01-01T00:00:00.000Z";
  profile.updatedAt = "2024-01-01T00:00:00.000Z";
  var host = {
    profile: profile,
    profiles: [],
    active: null,
    toasts: [],
    currentMonth: "2024-01",
    collapsedAcctGroups: {},
    collapsedCatGroups: {},
    _listVersion: 0,
    _bumpLists() {
      this._listVersion += 1;
      this._memoStore = null;
      this._memoStoreVersion = -1;
    },
    /* Store-level memoize — mirrors the real store.js helper so slice
       methods that call this._memo() work in tests. */
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
    _save() { /* no-op for tests */ },
    _recordUndo() { /* no-op for tests */ },
    _hydrateCollapsed() { /* no-op */ },
    _mirrorSnapshot() {},
    _mirrorSnapshotDelete() {},
    _mirrorBackup() {},
    _mirrorActive() {},
    _mirrorProfileDelete() {},
    refreshProfiles() {},
    pushToast() { /* swallow toasts in tests */ },
    /* batchMutate — minimal implementation so transactions.bulk*
       tests cover the wrapped + rollback paths. */
    _inBatch: false,
    batchMutate(fn) {
      if (this._inBatch) return fn();
      this._inBatch = true;
      var snapshot = JSON.parse(JSON.stringify(this.profile));
      try {
        var result = fn();
        this._bumpLists();
        this._save();
        return result;
      } catch (err) {
        this.profile = snapshot;
        this._bumpLists();
        this._save();
        throw err;
      } finally {
        this._inBatch = false;
      }
    },
  };
  if (slices) {
    slices.forEach(function (slice) { Object.assign(host, slice); });
  }
  return host;
}
