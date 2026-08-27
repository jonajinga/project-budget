/* Daily local backups — one snapshot per profile per calendar day, rolling
   14-day window. Runs once on app boot for the active profile. */

import { backupKey, backupNoteKey, snapshotKey, snapshotMetaKey, readJSON, writeJSON, removeKey, readRaw, writeRaw, profileKey } from "./persist.js";
import { migrate, newId } from "./schema.js";

const RETENTION_DAYS = 14;
const BACKUP_PREFIX = "projectbudget:backup:";
const SNAPSHOT_PREFIX = "projectbudget:snapshot:";
const SNAPSHOT_META_PREFIX = "projectbudget:snapshot-meta:";
const MAX_SNAPSHOTS = 20;

function today() { return new Date().toISOString().slice(0, 10); }

/* Returns the key used today for this profile. */
export function todaysKey(profileId) { return backupKey(profileId, today()); }

/* Write today's snapshot if one doesn't already exist for today, then
   prune anything older than RETENTION_DAYS. */
export function snapshotIfStale(profile) {
  if (!profile || !profile.id) return null;
  var key = todaysKey(profile.id);
  if (readJSON(key)) return key;
  writeJSON(key, profile);
  pruneOld(profile.id);
  return key;
}

/* List backups for a profile, newest first.
   Each item is { day, key, size, note }. */
export function listBackups(profileId) {
  var out = [];
  try {
    var s = localStorage;
    var prefix = BACKUP_PREFIX + profileId + ":";
    for (var i = 0; i < s.length; i++) {
      var k = s.key(i);
      if (!k || k.indexOf(prefix) !== 0) continue;
      var day = k.slice(prefix.length);
      var raw = s.getItem(k) || "";
      out.push({
        day: day,
        key: k,
        size: raw.length * 2,
        note: getBackupNote(profileId, day),
      });
    }
  } catch (_e) {}
  out.sort(function (a, b) { return a.day < b.day ? 1 : -1; });
  return out;
}

/* Notes are stored in a sidecar key so the backup payload itself stays a
   raw profile bundle that restoreBackup() can migrate directly. Notes are
   localStorage-only — Dexie mirror doesn't track them; surviving an LS
   wipe is a future enhancement, not a hard requirement. */
export function getBackupNote(profileId, day) {
  return readRaw(backupNoteKey(profileId, day)) || "";
}

export function setBackupNote(profileId, day, note) {
  var trimmed = (note || "").trim();
  if (!trimmed) {
    removeKey(backupNoteKey(profileId, day));
  } else {
    writeRaw(backupNoteKey(profileId, day), trimmed);
  }
  return trimmed;
}

function pruneOld(profileId) {
  var keep = new Set();
  var d = new Date();
  for (var i = 0; i < RETENTION_DAYS; i++) {
    keep.add(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  listBackups(profileId).forEach(function (b) {
    if (!keep.has(b.day)) {
      removeKey(b.key);
      removeKey(backupNoteKey(profileId, b.day));
    }
  });
}

/* Restore a backup into the live profile slot. Returns the restored
   profile object on success, null on failure. Caller is responsible for
   confirmation UI before invoking this. */
export function restoreBackup(profileId, day) {
  var key = backupKey(profileId, day);
  var snapshot = readJSON(key);
  if (!snapshot) return null;
  var restored = migrate(snapshot);
  writeJSON(profileKey(profileId), restored);
  return restored;
}

/* ---- Manual snapshots ------------------------------------------------ */
/* Stored under projectbudget:snapshot:<profileId>:<snapshotId> as
   { id, label, createdAt, profile }. Capped at MAX_SNAPSHOTS per
   profile; oldest is evicted on overflow. Independent of the daily
   backup cycle so a manual snapshot from last month survives. */

export function listSnapshots(profileId) {
  var out = [];
  try {
    var s = localStorage;
    var prefix = SNAPSHOT_PREFIX + profileId + ":";
    for (var i = 0; i < s.length; i++) {
      var k = s.key(i);
      if (!k || k.indexOf(prefix) !== 0) continue;
      /* Skip the sidecars themselves -- they share the "snapshot" stem. */
      if (k.indexOf(SNAPSHOT_META_PREFIX) === 0) continue;

      var snapId = k.slice(prefix.length);
      var raw = readRaw(k) || "";
      var meta = readJSON(snapshotMetaKey(profileId, snapId));

      if (!meta) {
        /* No sidecar: either a snapshot taken before sidecars existed, or
           one written by an older build. Pay the full read once and heal
           it, so the next listing is cheap.

           This read is why the sidecar exists. A snapshot record contains
           the entire profile bundle, so reading one to recover three
           metadata fields decompresses and parses ~512 KB. settings.njk
           calls listSnapshots() four times per render pass, and each call
           re-runs on every _listVersion bump. Measured at the 20-snapshot
           cap that was 566 ms of blocked main thread per pass. */
        var rec = readJSON(k);
        if (!rec) continue;
        meta = { id: rec.id || snapId, label: rec.label || "", createdAt: rec.createdAt };
        writeJSON(snapshotMetaKey(profileId, meta.id), meta);
      }

      out.push({ id: meta.id, label: meta.label || "", createdAt: meta.createdAt, key: k, size: raw.length * 2 });
    }
  } catch (_e) {}
  out.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  return out;
}

export function takeSnapshot(profile, label) {
  if (!profile || !profile.id) return null;
  var snapId = newId();
  var rec = {
    id: snapId,
    label: (label || "").trim(),
    createdAt: new Date().toISOString(),
    profile: profile,
  };
  writeJSON(snapshotKey(profile.id, snapId), rec);
  writeJSON(snapshotMetaKey(profile.id, snapId), { id: snapId, label: rec.label, createdAt: rec.createdAt });
  /* Evict oldest if over cap. Both halves go, or the sidecar outlives
     the snapshot it describes and the listing grows phantom rows. */
  var all = listSnapshots(profile.id);
  if (all.length > MAX_SNAPSHOTS) {
    all.slice(MAX_SNAPSHOTS).forEach(function (old) {
      removeKey(old.key);
      removeKey(snapshotMetaKey(profile.id, old.id));
    });
  }
  return rec;
}

export function deleteSnapshot(profileId, snapshotId) {
  removeKey(snapshotKey(profileId, snapshotId));
  removeKey(snapshotMetaKey(profileId, snapshotId));
}

export function renameSnapshot(profileId, snapshotId, newLabel) {
  var key = snapshotKey(profileId, snapshotId);
  var rec = readJSON(key);
  if (!rec) return null;
  rec.label = (newLabel || "").trim();
  writeJSON(key, rec);
  /* Keep the sidecar in step, or the listing shows the old label. */
  writeJSON(snapshotMetaKey(profileId, snapshotId), { id: rec.id || snapshotId, label: rec.label, createdAt: rec.createdAt });
  return rec;
}

export function restoreSnapshot(profileId, snapshotId) {
  var rec = readJSON(snapshotKey(profileId, snapshotId));
  if (!rec || !rec.profile) return null;
  var restored = migrate(rec.profile);
  writeJSON(profileKey(profileId), restored);
  return restored;
}
