/* Debounced localStorage adapter. All keys are namespaced under PREFIX so
   Project Budget can coexist with other apps on the same origin and the user can
   purge a clean range with a single prefix-scan. */

const DEBOUNCE_MS = 400;
const PREFIX = "projectbudget:";

const timers = new Map();

export function profileKey(id)            { return PREFIX + "profile:" + id; }
export function profilesIndexKey()        { return PREFIX + "profiles"; }
export function activeKey()               { return PREFIX + "active"; }
export function trashKey(id)              { return PREFIX + "trash:" + id; }
export function backupKey(profileId, day) { return PREFIX + "backup:" + profileId + ":" + day; }

function safeStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch (_e) {
    return null;
  }
}

export function readRaw(key) {
  var s = safeStorage();
  if (!s) return null;
  try { return s.getItem(key); } catch (_e) { return null; }
}

export function writeRaw(key, value) {
  var s = safeStorage();
  if (!s) return { ok: false, error: new Error("no storage") };
  try {
    s.setItem(key, value);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

export function removeKey(key) {
  var s = safeStorage();
  if (!s) return false;
  try { s.removeItem(key); return true; } catch (_e) { return false; }
}

export function readJSON(key) {
  var raw = readRaw(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_e) { return null; }
}

export function writeJSON(key, value) {
  return writeRaw(key, JSON.stringify(value));
}

/* Debounced save for a profile bundle. Updates updatedAt before write. */
export function scheduleSave(profile, onSaved, onError) {
  if (!profile || !profile.id) return;
  var key = profileKey(profile.id);
  if (timers.has(key)) clearTimeout(timers.get(key));
  var t = setTimeout(function () {
    timers.delete(key);
    profile.updatedAt = new Date().toISOString();
    var result = writeJSON(key, profile);
    if (result.ok) {
      onSaved && onSaved(new Date());
    } else {
      onError && onError(result.error);
    }
  }, DEBOUNCE_MS);
  timers.set(key, t);
}

/* Immediate (non-debounced) save. Used for profile create, switch, and
   anything that must hit disk before the next paint. */
export function saveProfileNow(profile) {
  if (!profile || !profile.id) return { ok: false };
  profile.updatedAt = new Date().toISOString();
  return writeJSON(profileKey(profile.id), profile);
}

/* All localStorage keys owned by Project Budget. */
export function listOwnedKeys() {
  var s = safeStorage();
  if (!s) return [];
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var k = s.key(i);
    if (k && k.indexOf(PREFIX) === 0) out.push(k);
  }
  return out;
}

/* Rough byte estimate. Each char in localStorage is stored as UTF-16, so
   true byte usage is roughly 2x string length, but quota is measured in
   characters on every major engine — we report characters and convert. */
export function estimateUsedBytes() {
  var s = safeStorage();
  if (!s) return 0;
  var total = 0;
  for (var i = 0; i < s.length; i++) {
    var k = s.key(i);
    if (!k || k.indexOf(PREFIX) !== 0) continue;
    total += (s.getItem(k) || "").length + k.length;
  }
  return total * 2;
}

/* Conservative budget cap — most browsers give 5 MB; some give 10 MB. */
export const QUOTA_BYTES = 5 * 1024 * 1024;

/* Detects private / incognito mode by attempting a write. Some engines
   raise QuotaExceededError on the first byte; others return successfully
   but never persist. We can only catch the former here. */
export function isPrivateBrowsing() {
  var probe = PREFIX + "__probe__";
  try {
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return false;
  } catch (_e) {
    return true;
  }
}
