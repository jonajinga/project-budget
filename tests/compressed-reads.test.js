/* Compressed-payload read paths.
 *
 * persist.js compresses any stored value over 2048 chars behind a "PB2:"
 * prefix, and readJSON() unwraps it again. Several key-walking functions
 * bypassed readJSON and ran JSON.parse over the raw string, so they saw
 * nothing at all once a profile grew past that threshold -- and pruneTrash
 * went further, treating "cannot parse" as "is garbage" and deleting it.
 *
 * Built through the store's own slices rather than hand-rolled records:
 * addTransaction also upserts a payee, so a synthetic transaction is much
 * smaller than a real one and crosses the threshold far later. Measured
 * here, a profile with one account passes 2048 chars at its sixth
 * transaction -- so this is not an edge case, it is every real user.
 *
 * Every case is paired with a deliberately small control profile. Without
 * the controls a green run would prove nothing: the bug is invisible below
 * the threshold, so a test that never crosses it passes either way.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { makeHost } from "./helpers.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { transactionsSlice } from "../src/assets/js/store/slices/transactions.js";

var lzSrc = readFileSync(resolve("./src/assets/js/vendor/lz-string.min.js"), "utf8");
// eslint-disable-next-line no-eval
var LZString = eval(lzSrc + "; LZString");

function makeFakeStorage() {
  var data = {};
  return {
    get length() { return Object.keys(data).length; },
    key(i) { return Object.keys(data)[i] || null; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    clear() { data = {}; },
  };
}

/* Counts real decompressions so a test can assert on cost, not just on
   output. listSnapshots() returning the right rows tells you nothing
   about whether it read 3 fields or 512 KB to get them. */
var decompressions = 0;
function countingLZ() {
  return {
    compressToUTF16: LZString.compressToUTF16.bind(LZString),
    decompressFromUTF16: function (v) {
      decompressions += 1;
      return LZString.decompressFromUTF16(v);
    },
  };
}

beforeEach(function () {
  decompressions = 0;
  globalThis.window = globalThis.window || {};
  globalThis.window.LZString = countingLZ();
  globalThis.localStorage = makeFakeStorage();
});

/* Builds a profile through the real slice methods, so its shape matches
   what the app actually writes. n transactions => n payees as well. */
function realProfile(name, n) {
  var host = makeHost([accountsSlice, transactionsSlice]);
  host.profile.name = name;
  var acct = host.addAccount({ name: "Joint Checking", type: "checking" });
  for (var i = 1; i <= n; i++) {
    host.addTransaction({
      accountId: acct.id,
      date: "2026-08-" + String((i % 28) + 1).padStart(2, "0"),
      payeeName: "Payee " + i,
      amount: -1234,
      memo: "",
    });
  }
  return host.profile;
}

async function mods() {
  return {
    profile: await import("../src/assets/js/store/profile.js"),
    backup: await import("../src/assets/js/store/backup.js"),
    persist: await import("../src/assets/js/store/persist.js"),
  };
}

/* Persists a ready-made profile under its own key and indexes it, the way
   createProfile would, so the trash/snapshot APIs can find it. */
async function store(p) {
  var { persist } = await mods();
  persist.writeJSON(persist.profileKey(p.id), p);
  var idx = persist.readJSON(persist.profilesIndexKey()) || [];
  idx.push({ id: p.id, name: p.name, lastOpenedAt: p.updatedAt, schemaVersion: p.schemaVersion });
  persist.writeJSON(persist.profilesIndexKey(), idx);
  return p;
}

function countKeys(prefix) {
  var n = 0;
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.indexOf(prefix) === 0) n += 1;
  }
  return n;
}

describe("the compression threshold is trivial to cross", () => {
  it("a profile with a handful of transactions compresses", async () => {
    var { persist } = await mods();
    var p = await store(realProfile("Realistic", 10));
    expect(persist.readRaw(persist.profileKey(p.id)).startsWith("PB2:")).toBe(true);
  });

  it("an untouched profile does not -- the control", async () => {
    var { persist } = await mods();
    var p = await store(realProfile("Bare", 0));
    expect(persist.readRaw(persist.profileKey(p.id)).startsWith("PB2:")).toBe(false);
  });
});

describe("trash survives compression", () => {
  it("listTrash sees a compressed trashed profile", async () => {
    var { profile } = await mods();
    var big = await store(realProfile("Big household", 40));
    profile.deleteProfile(big.id);

    expect(profile.listTrash().map((t) => t.name)).toContain("Big household");
  });

  it("listTrash reports its real transaction count, not zero", async () => {
    var { profile } = await mods();
    var big = await store(realProfile("Counted", 40));
    profile.deleteProfile(big.id);

    var rec = profile.listTrash().find((t) => t.name === "Counted");
    expect(rec.transactions).toBe(40);
  });

  it("pruneTrash does NOT destroy a compressed profile that is still in date", async () => {
    var { profile, persist } = await mods();
    var big = await store(realProfile("Precious", 40));
    profile.deleteProfile(big.id);

    /* pruneTrash() runs on every boot -- see store.js init. */
    profile.pruneTrash();

    expect(persist.readRaw(persist.trashKey(big.id))).not.toBeNull();
  });

  it("and it can still be restored after that boot", async () => {
    var { profile } = await mods();
    var big = await store(realProfile("Recoverable", 40));
    profile.deleteProfile(big.id);

    profile.pruneTrash();
    var back = profile.restoreFromTrash(big.id);

    expect(back).not.toBeNull();
    expect(back.name).toBe("Recoverable");
    expect(back.transactions).toHaveLength(40);
  });

  it("a small profile behaves identically -- the control", async () => {
    var { profile } = await mods();
    var small = await store(realProfile("Small", 0));
    profile.deleteProfile(small.id);
    profile.pruneTrash();

    expect(profile.listTrash().map((t) => t.name)).toContain("Small");
    expect(profile.restoreFromTrash(small.id)).not.toBeNull();
  });

  it("genuinely expired trash is still purged", async () => {
    var { profile, persist } = await mods();
    var old = await store(realProfile("Ancient", 40));
    profile.deleteProfile(old.id);

    var rec = persist.readJSON(persist.trashKey(old.id));
    rec.deletedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    persist.writeJSON(persist.trashKey(old.id), rec);

    profile.pruneTrash();
    expect(persist.readRaw(persist.trashKey(old.id))).toBeNull();
  });

  it("an unreadable trash record is left alone, not deleted", async () => {
    var { profile, persist } = await mods();
    var key = persist.trashKey("corrupt-id");
    persist.writeRaw(key, "PB2:not-actually-valid-compressed-data");

    profile.pruneTrash();

    /* Deleting what we cannot read is exactly how a recoverable profile
       became unrecoverable. Leave it for the health check to report. */
    expect(persist.readRaw(key)).not.toBeNull();
  });
});

describe("snapshots survive compression", () => {
  it("listSnapshots sees a snapshot of a compressed profile", async () => {
    var { backup } = await mods();
    var big = await store(realProfile("Snapshotted", 40));

    backup.takeSnapshot(big, "before the import");

    var snaps = backup.listSnapshots(big.id);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].label).toBe("before the import");
  });

  it("the 20-snapshot cap evicts on disk, not just in the listing", async () => {
    var { backup, persist } = await mods();
    var big = await store(realProfile("Capped", 40));

    for (var i = 0; i < 25; i++) backup.takeSnapshot(big, "snap " + i);

    /* Counted from storage directly. Asserting on listSnapshots().length
       here would pass while broken -- it returned [] for a compressed
       profile, and 0 <= 20. */
    expect(countKeys("projectbudget:snapshot:" + big.id + ":")).toBeLessThanOrEqual(20);
  });

  it("a small profile's snapshots evict too -- the control", async () => {
    var { backup } = await mods();
    var small = await store(realProfile("SmallCap", 0));

    for (var i = 0; i < 25; i++) backup.takeSnapshot(small, "snap " + i);

    expect(countKeys("projectbudget:snapshot:" + small.id + ":")).toBeLessThanOrEqual(20);
  });

  it("a snapshot can still be restored", async () => {
    var { backup } = await mods();
    var big = await store(realProfile("Restorable", 40));

    var rec = backup.takeSnapshot(big, "keep me");
    var back = backup.restoreSnapshot(big.id, rec.id);

    expect(back).not.toBeNull();
    expect(back.transactions).toHaveLength(40);
  });
});

describe("listing snapshots does not read the profile bundles", () => {
  it("lists 20 snapshots without decompressing a single one", async () => {
    var { backup } = await mods();
    var big = await store(realProfile("Cheap", 40));
    for (var i = 0; i < 20; i++) backup.takeSnapshot(big, "snap " + i);

    decompressions = 0;
    var snaps = backup.listSnapshots(big.id);

    expect(snaps).toHaveLength(20);
    /* The whole point of the sidecar. Before it, this was 20 full
       decompress+parse cycles over ~512 KB each, four times per settings
       render. */
    expect(decompressions).toBe(0);
  });

  it("labels and ordering still come out right", async () => {
    var { backup } = await mods();
    var big = await store(realProfile("Ordered", 40));
    backup.takeSnapshot(big, "first");
    backup.takeSnapshot(big, "second");

    var labels = backup.listSnapshots(big.id).map((s) => s.label).sort();
    expect(labels).toEqual(["first", "second"]);
  });

  it("a snapshot written without a sidecar still lists, and heals itself", async () => {
    var { backup, persist } = await mods();
    var big = await store(realProfile("Legacy", 40));

    /* Exactly what an existing user's storage looks like today. */
    persist.writeJSON(persist.snapshotKey(big.id, "legacy-1"), {
      id: "legacy-1", label: "from an older build",
      createdAt: "2026-08-01T00:00:00.000Z", profile: big,
    });

    decompressions = 0;
    var first = backup.listSnapshots(big.id);
    expect(first).toHaveLength(1);
    expect(first[0].label).toBe("from an older build");
    expect(decompressions).toBe(1);

    /* Healed on that first read, so it never costs again. */
    decompressions = 0;
    expect(backup.listSnapshots(big.id)).toHaveLength(1);
    expect(decompressions).toBe(0);
  });

  it("eviction removes the sidecar too, so no phantom rows appear", async () => {
    var { backup, persist } = await mods();
    var big = await store(realProfile("Evicting", 40));
    for (var i = 0; i < 25; i++) backup.takeSnapshot(big, "snap " + i);

    /* Equality, not "<= 20". A "<=" assertion here passes when there are
       no sidecars at all, which is exactly the state this test exists to
       rule out -- it would have gone green against the old code. */
    expect(countKeys("projectbudget:snapshot:" + big.id + ":")).toBe(20);
    expect(countKeys("projectbudget:snapshot-meta:" + big.id + ":")).toBe(20);
    expect(backup.listSnapshots(big.id)).toHaveLength(20);
  });

  it("deleting a snapshot removes both halves", async () => {
    var { backup, persist } = await mods();
    var big = await store(realProfile("Deletable", 40));
    var rec = backup.takeSnapshot(big, "goodbye");

    /* Assert the sidecar existed first. Without this the "it is gone"
       assertions below pass against a build that never wrote one. */
    expect(persist.readRaw(persist.snapshotMetaKey(big.id, rec.id))).not.toBeNull();

    backup.deleteSnapshot(big.id, rec.id);

    expect(persist.readRaw(persist.snapshotKey(big.id, rec.id))).toBeNull();
    expect(persist.readRaw(persist.snapshotMetaKey(big.id, rec.id))).toBeNull();
    expect(backup.listSnapshots(big.id)).toHaveLength(0);
  });

  it("renaming updates what the listing shows", async () => {
    var { backup } = await mods();
    var big = await store(realProfile("Renamable", 40));
    var rec = backup.takeSnapshot(big, "old name");

    backup.renameSnapshot(big.id, rec.id, "new name");

    expect(backup.listSnapshots(big.id)[0].label).toBe("new name");
  });

  it("restoring still returns the whole profile", async () => {
    var { backup } = await mods();
    var big = await store(realProfile("Whole", 40));
    var rec = backup.takeSnapshot(big, "full");

    var back = backup.restoreSnapshot(big.id, rec.id);
    expect(back.transactions).toHaveLength(40);
  });
});
