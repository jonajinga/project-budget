/* Snapshots + backups slice — automatic daily backups plus
   user-initiated manual snapshots. The store still owns the mirror
   helpers (_mirrorSnapshot / _mirrorSnapshotDelete) because those
   write through to IndexedDB and are also used by the init path. */

import {
  listBackups as listBackupsImpl,
  restoreBackup as restoreBackupImpl,
  listSnapshots as listSnapshotsImpl,
  takeSnapshot as takeSnapshotImpl,
  deleteSnapshot as deleteSnapshotImpl,
  restoreSnapshot as restoreSnapshotImpl,
  renameSnapshot as renameSnapshotImpl,
  getBackupNote as getBackupNoteImpl,
  setBackupNote as setBackupNoteImpl,
} from "../backup.js";

export const snapshotsSlice = {
  /* ---- Daily backups ---- */
  /** @returns {object[]} backup records for the active profile */
  listBackups() {
    void this._listVersion;
    if (!this.profile) return [];
    return listBackupsImpl(this.profile.id);
  },

  /**
   * Attach a user note to a specific daily backup.
   * @param {string} day YYYY-MM-DD
   * @param {string} note
   */
  setBackupNote(day, note) {
    if (!this.profile) return;
    setBackupNoteImpl(this.profile.id, day, note);
    this._bumpLists();
  },

  /**
   * @param {string} day YYYY-MM-DD
   * @returns {string} the saved note, or ""
   */
  getBackupNote(day) {
    if (!this.profile) return "";
    return getBackupNoteImpl(this.profile.id, day);
  },

  /**
   * Replace the active profile with a daily backup. Requires
   * confirmedName to match.
   * @param {string} day YYYY-MM-DD
   * @param {string} confirmedName
   * @returns {boolean} false on name mismatch or restore failure
   */
  restoreBackup(day, confirmedName) {
    if (!this.profile) return false;
    if (confirmedName !== this.profile.name) {
      this.pushToast("Restore cancelled — typed name did not match.", "warn");
      return false;
    }
    var restored = restoreBackupImpl(this.profile.id, day);
    if (!restored) {
      this.pushToast("Could not restore snapshot.", "danger");
      return false;
    }
    this.profile = restored;
    this._hydrateCollapsed();
    this.refreshProfiles();
    this._bumpLists();
    this.pushToast("Restored snapshot from " + day + ".");
    return true;
  },

  /* ---- Manual snapshots ---- */
  /** @returns {object[]} manual snapshot records for the active profile */
  listSnapshots() {
    void this._listVersion;
    if (!this.profile) return [];
    return listSnapshotsImpl(this.profile.id);
  },

  /**
   * Create a labelled snapshot of the active profile and mirror it
   * to IndexedDB.
   * @param {string} [label]
   * @returns {object|null} the snapshot record
   */
  takeSnapshot(label) {
    if (!this.profile) return null;
    var rec = takeSnapshotImpl(this.profile, label);
    if (rec) {
      this._mirrorSnapshot(this.profile.id, rec);
      this._bumpLists();
      this.pushToast("Snapshot saved" + (rec.label ? ": '" + rec.label + "'" : "") + ".");
    }
    return rec;
  },

  /**
   * Delete a snapshot from localStorage and the IndexedDB mirror.
   * @param {id} id
   */
  deleteSnapshot(id) {
    if (!this.profile) return;
    var pid = this.profile.id;
    deleteSnapshotImpl(pid, id);
    this._mirrorSnapshotDelete(pid, id);
    this._bumpLists();
    this.pushToast("Snapshot removed.");
  },

  /**
   * Rename a snapshot and re-mirror it to IndexedDB.
   * @param {id} id
   * @param {string} label
   * @returns {object|null}
   */
  renameSnapshot(id, label) {
    if (!this.profile) return null;
    var rec = renameSnapshotImpl(this.profile.id, id, label);
    if (!rec) return null;
    this._mirrorSnapshot(this.profile.id, rec);
    this._bumpLists();
    return rec;
  },

  /**
   * Replace the active profile with a manual snapshot. Requires
   * confirmedName to match.
   * @param {id} id
   * @param {string} confirmedName
   * @returns {boolean} false on name mismatch or restore failure
   */
  restoreSnapshot(id, confirmedName) {
    if (!this.profile) return false;
    if (confirmedName !== this.profile.name) {
      this.pushToast("Restore cancelled — typed name did not match.", "warn");
      return false;
    }
    var restored = restoreSnapshotImpl(this.profile.id, id);
    if (!restored) {
      this.pushToast("Could not restore snapshot.", "danger");
      return false;
    }
    this.profile = restored;
    this._hydrateCollapsed();
    this.refreshProfiles();
    this._bumpLists();
    this.pushToast("Snapshot restored.");
    return true;
  },
};
