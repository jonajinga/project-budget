import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/* Stand up a fake window+localStorage+LZString BEFORE importing any
   slice that touches persist.js (backup.js → persist.js reads window). */
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

/* Dynamic imports happen INSIDE each test so the per-test localStorage
   stub is in place when the modules first hydrate. */
async function buildSnapshotHost() {
  var { makeHost } = await import("./helpers.js");
  var { snapshotsSlice } = await import("../src/assets/js/store/slices/snapshots.js");
  var { accountsSlice } = await import("../src/assets/js/store/slices/accounts.js");
  var { transactionsSlice } = await import("../src/assets/js/store/slices/transactions.js");
  var h = makeHost([snapshotsSlice, accountsSlice, transactionsSlice]);
  var acct = h.addAccount({ name: "Checking", type: "checking", openingBalance: 50000 });
  return { host: h, acct: acct };
}

describe("snapshotsSlice", () => {
  it("takeSnapshot creates a snapshot record listed by listSnapshots", async () => {
    var ctx = await buildSnapshotHost();
    var rec = ctx.host.takeSnapshot("Before vacation");
    expect(rec).toBeTruthy();
    expect(rec.label).toBe("Before vacation");
    var list = ctx.host.listSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(rec.id);
    expect(list[0].label).toBe("Before vacation");
  });

  it("listSnapshots returns newest first", async () => {
    var ctx = await buildSnapshotHost();
    var first = ctx.host.takeSnapshot("Alpha");
    /* Bump createdAt forward so order is deterministic. */
    first.createdAt = "2024-01-01T00:00:00.000Z";
    var second = ctx.host.takeSnapshot("Bravo");
    second.createdAt = "2024-06-01T00:00:00.000Z";
    /* Re-persist with patched timestamps. */
    var { writeJSON, snapshotKey } = await import("../src/assets/js/store/persist.js");
    writeJSON(snapshotKey(ctx.host.profile.id, first.id), { id: first.id, label: "Alpha", createdAt: first.createdAt, profile: ctx.host.profile });
    writeJSON(snapshotKey(ctx.host.profile.id, second.id), { id: second.id, label: "Bravo", createdAt: second.createdAt, profile: ctx.host.profile });
    var list = ctx.host.listSnapshots();
    expect(list[0].label).toBe("Bravo");
    expect(list[1].label).toBe("Alpha");
  });

  it("renameSnapshot updates the stored label", async () => {
    var ctx = await buildSnapshotHost();
    var rec = ctx.host.takeSnapshot("Old name");
    var renamed = ctx.host.renameSnapshot(rec.id, "New name");
    expect(renamed.label).toBe("New name");
    var list = ctx.host.listSnapshots();
    expect(list[0].label).toBe("New name");
  });

  it("deleteSnapshot removes it from the listing", async () => {
    var ctx = await buildSnapshotHost();
    var rec = ctx.host.takeSnapshot("Doomed");
    expect(ctx.host.listSnapshots()).toHaveLength(1);
    ctx.host.deleteSnapshot(rec.id);
    expect(ctx.host.listSnapshots()).toHaveLength(0);
  });

  it("restoreSnapshot requires matching profile name + replaces profile data", async () => {
    var ctx = await buildSnapshotHost();
    var originalName = ctx.host.profile.name;
    var originalTxnCount = ctx.host.profile.transactions.length;
    var rec = ctx.host.takeSnapshot("Backup");
    /* Mutate after snapshot so we can detect rollback. */
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-03-15", payeeName: "Test", amount: -1000 });
    expect(ctx.host.profile.transactions.length).toBe(originalTxnCount + 1);
    /* Name mismatch — should fail. */
    var bad = ctx.host.restoreSnapshot(rec.id, "wrong name");
    expect(bad).toBe(false);
    /* Correct name → restore drops the post-snapshot transaction. */
    var good = ctx.host.restoreSnapshot(rec.id, originalName);
    expect(good).toBe(true);
    expect(ctx.host.profile.transactions.length).toBe(originalTxnCount);
  });

  it("setBackupNote / getBackupNote round-trip + empty string clears", async () => {
    var ctx = await buildSnapshotHost();
    ctx.host.setBackupNote("2024-03-15", "Tax day");
    expect(ctx.host.getBackupNote("2024-03-15")).toBe("Tax day");
    ctx.host.setBackupNote("2024-03-15", "");
    expect(ctx.host.getBackupNote("2024-03-15")).toBe("");
  });

  it("listBackups / listSnapshots safely return [] when profile is null", async () => {
    var ctx = await buildSnapshotHost();
    ctx.host.profile = null;
    expect(ctx.host.listBackups()).toEqual([]);
    expect(ctx.host.listSnapshots()).toEqual([]);
  });
});
