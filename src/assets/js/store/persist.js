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
export function backupNoteKey(profileId, day) { return PREFIX + "backup-note:" + profileId + ":" + day; }
export function snapshotKey(profileId, id) { return PREFIX + "snapshot:" + profileId + ":" + id; }

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

/* ---- Compression layer ----
   LZ-string compressToUTF16 packs 15 bits per char and stays
   string-safe for localStorage. Empirical compression ratio on a
   profile bundle: ~60% reduction (JSON has lots of repeated keys
   + ID strings — perfect for LZ77). We only compress payloads >2 KB
   so tiny keys (active profile id, flags) stay readable when
   browsing devtools.

   Versioning: payloads start with "PB2:" so we can detect compressed
   blobs and decompress them. Anything else parses as raw JSON
   (backward compat for users coming from the previous format and
   for keys we choose to leave uncompressed). */

var COMPRESS_PREFIX = "PB2:";
var COMPRESS_THRESHOLD = 2048;

function lz() {
  return typeof window !== "undefined" ? window.LZString : null;
}

function tryCompress(json) {
  var L = lz();
  if (!L || json.length < COMPRESS_THRESHOLD) return null;
  try {
    var packed = L.compressToUTF16(json);
    if (!packed || packed.length >= json.length) return null;
    return COMPRESS_PREFIX + packed;
  } catch (_e) { return null; }
}

function tryDecompress(raw) {
  if (!raw || raw.indexOf(COMPRESS_PREFIX) !== 0) return raw;
  var L = lz();
  if (!L) return null;
  try { return L.decompressFromUTF16(raw.slice(COMPRESS_PREFIX.length)); }
  catch (_e) { return null; }
}

export function readJSON(key) {
  var raw = readRaw(key);
  if (!raw) return null;
  var json = tryDecompress(raw);
  if (json == null) return null;
  try { return JSON.parse(json); } catch (_e) { return null; }
}

export function writeJSON(key, value) {
  var json = JSON.stringify(value);
  var packed = tryCompress(json);
  return writeRaw(key, packed || json);
}

/* Soft cap on the per-profile localStorage write. localStorage has a
   hard 5 MB quota per origin; once a compressed profile crosses
   ~500 KB it can squeeze out other apps' data + leave no headroom
   for snapshots. Above this cap we skip the localStorage write
   entirely — Dexie has the canonical copy via the store's mirror
   path, and there's nothing the user can do about a quota error
   except clear data. Silent skip > fatal toast. */
var LS_PROFILE_SOFT_CAP = 500 * 1024;

/* Debounced save for a profile bundle. Updates updatedAt before write. */
export function scheduleSave(profile, onSaved, onError) {
  if (!profile || !profile.id) return;
  var key = profileKey(profile.id);
  if (timers.has(key)) clearTimeout(timers.get(key));
  var t = setTimeout(function () {
    timers.delete(key);
    profile.updatedAt = new Date().toISOString();
    /* Pre-flight: serialize + compress to measure size BEFORE
       trying the write. If the payload won't fit comfortably,
       skip the localStorage write and let Dexie carry it. */
    var json = JSON.stringify(profile);
    var packed = tryCompress(json) || json;
    if (packed.length > LS_PROFILE_SOFT_CAP) {
      /* Best effort: still call onSaved so the UI's "Saved" status
         flips. Dexie will receive the write via the mirror path. */
      onSaved && onSaved(new Date());
      return;
    }
    var result = writeRaw(key, packed);
    if (result.ok) {
      onSaved && onSaved(new Date());
    } else if (result.error && result.error.name === "QuotaExceededError") {
      /* localStorage full but we tried — Dexie still gets the
         write. Don't fire onError; that would surface a fatal
         danger toast for a recoverable condition. */
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
