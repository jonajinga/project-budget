/* Daily local backups — one snapshot per profile per calendar day, rolling
   14-day window. Runs once on app boot for the active profile. */

import { backupKey, snapshotKey, readJSON, writeJSON, removeKey, profileKey } from "./persist.js";
import { migrate, newId } from "./schema.js";

const RETENTION_DAYS = 14;
const BACKUP_PREFIX = "projectbudget:backup:";
const SNAPSHOT_PREFIX = "projectbudget:snapshot:";
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

/* List backups for a profile, newest first. Each item is { day, key, size }. */
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
      out.push({ day: day, key: k, size: raw.length * 2 });
    }
  } catch (_e) {}
  out.sort(function (a, b) { return a.day < b.day ? 1 : -1; });
  return out;
}

function pruneOld(profileId) {
  var keep = new Set();
  var d = new Date();
  for (var i = 0; i < RETENTION_DAYS; i++) {
    keep.add(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  listBackups(profileId).forEach(function (b) {
    if (!keep.has(b.day)) removeKey(b.key);
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
      var raw = s.getItem(k) || "{}";
      try {
        var rec = JSON.parse(raw);
        out.push({ id: rec.id, label: rec.label || "", createdAt: rec.createdAt, key: k, size: raw.length * 2 });
      } catch (_e) {}
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
  /* Evict oldest if over cap. */
  var all = listSnapshots(profile.id);
  if (all.length > MAX_SNAPSHOTS) {
    all.slice(MAX_SNAPSHOTS).forEach(function (s) { removeKey(s.key); });
  }
  return rec;
}

export function deleteSnapshot(profileId, snapshotId) {
  removeKey(snapshotKey(profileId, snapshotId));
}

export function restoreSnapshot(profileId, snapshotId) {
  var rec = readJSON(snapshotKey(profileId, snapshotId));
  if (!rec || !rec.profile) return null;
  var restored = migrate(rec.profile);
  writeJSON(profileKey(profileId), restored);
  return restored;
}
