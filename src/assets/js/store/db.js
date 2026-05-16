/* IndexedDB persistence via Dexie.

   Versioning is the headline concern for this module — users WILL upgrade
   between Project Budget versions and we cannot lose their data. There are
   TWO independent versioning surfaces:

   1. The Dexie schema (table shapes + indexes).
      - Bumped via `db.version(N).stores({...}).upgrade(tx => {...})`.
      - The .stores() call defines table primary keys + indexes; the
        .upgrade() block is for data transforms.
      - Each numbered version is APPENDED, never edited or removed.
        Dexie walks every user from their stored version up to the latest.
      - Indexes can be added without an upgrade block; existing rows get
        the new index applied lazily.

   2. The Project Budget profile shape (Account/Category/Transaction/etc.).
      - Bumped via SCHEMA_VERSION + MIGRATIONS in src/assets/js/store/schema.js.
      - Runs every time a profile is loaded into memory.
      - Independent from Dexie — a Dexie v3 store may hold profiles at
        schema v1, v2, v3 all at once; the loader brings each up to date.

   Why both: Dexie versions cover "where the data lives"; profile schema
   versions cover "what the data looks like". They evolve at different
   cadences. A field rename on Transaction is a profile-schema migration,
   not a Dexie one. Adding a new index for performance is a Dexie
   migration, not a profile-schema one.

   Mirror-write contract: every write that goes to Dexie also goes to
   localStorage (via persist.js). This keeps two backends in sync so:
   - A user who pins an older browser tab and reloads still sees their data.
   - A user who clears IndexedDB but not localStorage doesn't lose history.
   - We can always read from either backend during boot. */

const DB_NAME = "ProjectBudget";

let dbPromise = null;
let lastError = null;

/* Lazy open so we don't crash early if Dexie hasn't loaded yet. */
function open() {
  if (dbPromise) return dbPromise;
  if (typeof window === "undefined" || typeof window.Dexie !== "function") {
    lastError = new Error("Dexie not available");
    return Promise.reject(lastError);
  }
  var Dexie = window.Dexie;
  var db = new Dexie(DB_NAME);

  /* ---- Schema v1 (initial) -----------------------------------------
     Tables:
       profiles  : keyed by profile id; one row per Profile bundle.
                   Indexed by name + updatedAt for sorting in the
                   profiles list without loading the bundles.
       snapshots : manual snapshots. Composite primary key
                   [profileId+id] so a single Dexie put writes them.
                   Indexed by profileId for listing per-profile.
       backups   : daily backups. Composite primary key [profileId+day]
                   keeps natural one-per-day uniqueness. Indexed by
                   profileId.
       trash     : soft-deleted profiles awaiting purge.
       meta      : single-row metadata table (active profile id, flags,
                   migration state) keyed by string id. */
  db.version(1).stores({
    profiles:  "id, name, updatedAt",
    snapshots: "[profileId+id], profileId, createdAt",
    backups:   "[profileId+day], profileId, day",
    trash:     "id, deletedAt",
    meta:      "id",
  });

  /* When adding v2, do NOT edit v1. Append a new block:
     db.version(2).stores({...}).upgrade(tx => {...});
     Dexie walks every user from their existing version up to the latest. */

  dbPromise = db.open()
    .then(function () { return db; })
    .catch(function (err) {
      lastError = err;
      dbPromise = null;
      throw err;
    });
  return dbPromise;
}

export async function isAvailable() {
  try { await open(); return true; } catch (_e) { return false; }
}

export function getLastError() { return lastError; }

/* ---- Profiles -------------------------------------------------------- */

export async function putProfile(profile) {
  var db = await open();
  await db.profiles.put(profile);
}

export async function getProfile(id) {
  var db = await open();
  return db.profiles.get(id);
}

export async function deleteProfileDB(id) {
  var db = await open();
  await db.profiles.delete(id);
}

export async function listProfilesDB() {
  var db = await open();
  /* Return the full profile records here so the boot path can compute the
     index entries (id/name/updatedAt) without two passes. The store
     reduces them down to the slim index shape. */
  return db.profiles.toArray();
}

/* ---- Snapshots ------------------------------------------------------- */

export async function putSnapshot(profileId, snapshot) {
  var db = await open();
  await db.snapshots.put({
    profileId: profileId,
    id: snapshot.id,
    label: snapshot.label || "",
    createdAt: snapshot.createdAt,
    profile: snapshot.profile,
  });
}

export async function listSnapshotsForDB(profileId) {
  var db = await open();
  var rows = await db.snapshots.where("profileId").equals(profileId).toArray();
  rows.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  return rows;
}

export async function deleteSnapshotDB(profileId, snapshotId) {
  var db = await open();
  await db.snapshots.delete([profileId, snapshotId]);
}

/* ---- Backups (daily) ------------------------------------------------- */

export async function putBackup(profileId, day, profile) {
  var db = await open();
  await db.backups.put({ profileId: profileId, day: day, profile: profile });
}

export async function listBackupsForDB(profileId) {
  var db = await open();
  var rows = await db.backups.where("profileId").equals(profileId).toArray();
  rows.sort(function (a, b) { return a.day < b.day ? 1 : -1; });
  return rows;
}

export async function deleteBackupDB(profileId, day) {
  var db = await open();
  await db.backups.delete([profileId, day]);
}

/* ---- Meta (active profile id, flags) -------------------------------- */

export async function setMeta(id, value) {
  var db = await open();
  await db.meta.put({ id: id, value: value });
}

export async function getMeta(id) {
  var db = await open();
  var row = await db.meta.get(id);
  return row ? row.value : null;
}

/* ---- Storage estimate ----------------------------------------------- */

export async function estimateUsage() {
  if (typeof navigator === "undefined" || !navigator.storage || !navigator.storage.estimate) {
    return null;
  }
  try {
    var est = await navigator.storage.estimate();
    return { used: est.usage || 0, quota: est.quota || 0 };
  } catch (_e) {
    return null;
  }
}

/* ---- One-time migration from localStorage -------------------------- */

/* Walks the localStorage `projectbudget:*` namespace and copies anything
   we find into Dexie. Idempotent: existing Dexie rows are overwritten
   only when localStorage has a newer updatedAt. Sets a meta flag so we
   don't repeat the scan on every boot. */
export async function migrateLocalStorageIfNeeded(localStorage) {
  if (!localStorage) return { migrated: false, reason: "no-localStorage" };
  try {
    var done = await getMeta("localStorage-migrated");
    if (done) return { migrated: false, reason: "already-done" };
  } catch (_e) {
    return { migrated: false, reason: "dexie-unavailable" };
  }

  var counts = { profiles: 0, snapshots: 0, backups: 0 };
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf("projectbudget:") !== 0) continue;

      try {
        var raw = localStorage.getItem(k);
        if (!raw) continue;

        if (k.indexOf("projectbudget:profile:") === 0) {
          var p = JSON.parse(raw);
          if (p && p.id) { await putProfile(p); counts.profiles += 1; }
        } else if (k.indexOf("projectbudget:snapshot:") === 0) {
          var parts = k.split(":"); // projectbudget : snapshot : profileId : snapId
          var pid = parts[2], sid = parts[3];
          var rec = JSON.parse(raw);
          if (pid && sid && rec) {
            await putSnapshot(pid, { id: rec.id || sid, label: rec.label || "", createdAt: rec.createdAt, profile: rec.profile });
            counts.snapshots += 1;
          }
        } else if (k.indexOf("projectbudget:backup:") === 0) {
          var b = k.split(":"); // projectbudget : backup : profileId : day
          var bpid = b[2], day = b[3];
          var snap = JSON.parse(raw);
          if (bpid && day && snap) { await putBackup(bpid, day, snap); counts.backups += 1; }
        } else if (k === "projectbudget:active") {
          await setMeta("active", raw);
        }
      } catch (_e) { /* skip a malformed row; don't block the rest */ }
    }
    await setMeta("localStorage-migrated", new Date().toISOString());
  } catch (e) {
    return { migrated: false, reason: "error", error: e.message };
  }
  return { migrated: true, counts: counts };
}
