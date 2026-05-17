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
  listBackups() {
    void this._listVersion;
    if (!this.profile) return [];
    return listBackupsImpl(this.profile.id);
  },

  setBackupNote(day, note) {
    if (!this.profile) return;
    setBackupNoteImpl(this.profile.id, day, note);
    this._bumpLists();
  },

  getBackupNote(day) {
    if (!this.profile) return "";
    return getBackupNoteImpl(this.profile.id, day);
  },

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
  listSnapshots() {
    void this._listVersion;
    if (!this.profile) return [];
    return listSnapshotsImpl(this.profile.id);
  },

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

  deleteSnapshot(id) {
    if (!this.profile) return;
    var pid = this.profile.id;
    deleteSnapshotImpl(pid, id);
    this._mirrorSnapshotDelete(pid, id);
    this._bumpLists();
    this.pushToast("Snapshot removed.");
  },

  renameSnapshot(id, label) {
    if (!this.profile) return null;
    var rec = renameSnapshotImpl(this.profile.id, id, label);
    if (!rec) return null;
    this._mirrorSnapshot(this.profile.id, rec);
    this._bumpLists();
    return rec;
  },

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
