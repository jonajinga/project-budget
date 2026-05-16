/* Profile management — every operation that creates, mutates, or removes a
   whole profile bundle lives here. The Alpine store calls these functions
   and reflects the result back into reactive state. */

import { newProfile, newId, migrate } from "./schema.js";
import {
  profileKey, profilesIndexKey, activeKey, trashKey,
  readJSON, writeJSON, writeRaw, readRaw, removeKey,
} from "./persist.js";

const TRASH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function nowISO() { return new Date().toISOString(); }
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function indexEntry(p) {
  return { id: p.id, name: p.name, lastOpenedAt: p.updatedAt || p.createdAt, schemaVersion: p.schemaVersion };
}

export function listProfiles() {
  return readJSON(profilesIndexKey()) || [];
}

function writeIndex(list) {
  writeJSON(profilesIndexKey(), list);
}

function upsertIndex(profile) {
  var list = listProfiles();
  var i = list.findIndex(function (e) { return e.id === profile.id; });
  if (i >= 0) list[i] = indexEntry(profile);
  else list.push(indexEntry(profile));
  writeIndex(list);
}

function removeIndex(id) {
  var list = listProfiles().filter(function (e) { return e.id !== id; });
  writeIndex(list);
}

export function getActiveId() {
  return readRaw(activeKey());
}

export function setActiveId(id) {
  if (id) writeRaw(activeKey(), id);
  else removeKey(activeKey());
}

export function loadProfile(id) {
  var p = readJSON(profileKey(id));
  return p ? migrate(p) : null;
}

export function createProfile(name) {
  var p = newProfile(name);
  writeJSON(profileKey(p.id), p);
  upsertIndex(p);
  return p;
}

export function renameProfile(profile, newName) {
  profile.name = newName;
  profile.updatedAt = nowISO();
  writeJSON(profileKey(profile.id), profile);
  upsertIndex(profile);
  return profile;
}

export function duplicateProfile(srcId, newName) {
  var src = loadProfile(srcId);
  if (!src) return null;
  var copy = deepClone(src);
  copy.id = newId();
  copy.name = newName || (src.name + " (copy)");
  copy.createdAt = nowISO();
  copy.updatedAt = copy.createdAt;
  writeJSON(profileKey(copy.id), copy);
  upsertIndex(copy);
  return copy;
}

/* Soft delete — moves the profile bundle to a trash key with a TTL so an
   accident is recoverable. The Settings page can list and purge trash. */
export function deleteProfile(id) {
  var p = loadProfile(id);
  if (!p) return false;
  var trashed = { profile: p, deletedAt: Date.now() };
  writeJSON(trashKey(id), trashed);
  removeKey(profileKey(id));
  removeIndex(id);
  if (getActiveId() === id) setActiveId(null);
  return true;
}

export function restoreFromTrash(id) {
  var rec = readJSON(trashKey(id));
  if (!rec || !rec.profile) return null;
  var p = rec.profile;
  writeJSON(profileKey(p.id), p);
  upsertIndex(p);
  removeKey(trashKey(id));
  return p;
}

export function pruneTrash() {
  /* Walk all trash:* keys and purge anything older than TRASH_TTL_MS. */
  try {
    var s = localStorage;
    var now = Date.now();
    var doomed = [];
    for (var i = 0; i < s.length; i++) {
      var k = s.key(i);
      if (!k || k.indexOf("projectbudget:trash:") !== 0) continue;
      try {
        var rec = JSON.parse(s.getItem(k));
        if (!rec || (now - (rec.deletedAt || 0)) > TRASH_TTL_MS) doomed.push(k);
      } catch (_e) { doomed.push(k); }
    }
    doomed.forEach(function (k) { s.removeItem(k); });
  } catch (_e) {}
}

/* Clone is the user-friendly name for duplicate. Kept as a separate export
   in case the two diverge later (e.g. clone-without-history). */
export function cloneProfile(srcId, newName) {
  return duplicateProfile(srcId, newName);
}

/* freshStart — archives the profile's current state into a new profile,
   then clears transactions and budgets in the original so the user can
   restart the year with the same accounts and categories. */
export function freshStart(profile, archiveName) {
  var archive = duplicateProfile(profile.id, archiveName || (profile.name + " — archive " + new Date().getFullYear()));
  profile.transactions = [];
  profile.budgets = {};
  profile.scheduled = [];
  profile.updatedAt = nowISO();
  writeJSON(profileKey(profile.id), profile);
  upsertIndex(profile);
  return { archive: archive, profile: profile };
}

/* trimHistory — drops every transaction dated before cutoff. Account
   opening balances are adjusted so post-cutoff running balances match
   what they were before the trim. */
export function trimHistory(profile, cutoffISO) {
  if (!cutoffISO) return profile;
  var byAccount = {};
  profile.transactions.forEach(function (t) {
    if (t.date < cutoffISO) {
      byAccount[t.accountId] = (byAccount[t.accountId] || 0) + (t.amount || 0);
    }
  });
  profile.transactions = profile.transactions.filter(function (t) { return t.date >= cutoffISO; });
  profile.accounts.forEach(function (a) {
    a.openingBalance = (a.openingBalance || 0) + (byAccount[a.id] || 0);
  });
  profile.updatedAt = nowISO();
  writeJSON(profileKey(profile.id), profile);
  upsertIndex(profile);
  return profile;
}

/* Promote a profile to active. Returns the loaded profile bundle. */
export function switchTo(id) {
  var p = loadProfile(id);
  if (!p) return null;
  setActiveId(id);
  upsertIndex(p);
  return p;
}
