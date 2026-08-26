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

beforeEach(function () {
  globalThis.window = globalThis.window || {};
  globalThis.window.LZString = LZString;
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
