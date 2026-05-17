/* Storage-layer tests — covers the compression wrapper + the soft
   localStorage size cap + the short-ID generator. Node's vitest runs
   without a real window/localStorage/LZString, so we stub them via
   globalThis before importing the module. */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/* Real LZString library — loaded once, exposed on globalThis.window
   so persist.js's lz() helper can find it. */
var lzSrc = readFileSync(resolve("./src/assets/js/vendor/lz-string.min.js"), "utf8");
var LZString;
(function () {
  // eslint-disable-next-line no-eval
  eval(lzSrc);
  /* The IIFE assigns to a local `LZString` in this function's scope. */
})();
/* Re-eval into globalThis since the IIFE above stayed local. */
// eslint-disable-next-line no-eval
LZString = eval(lzSrc + "; LZString");

function makeFakeStorage() {
  var data = {};
  return {
    get length() { return Object.keys(data).length; },
    key(i) { return Object.keys(data)[i] || null; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) {
      /* Simulate the 5 MB quota: throw QuotaExceededError above ~5 million
         chars (rough localStorage cap). */
      var total = Object.values(data).reduce(function (n, s) { return n + s.length; }, 0);
      if (total - (data[k] ? data[k].length : 0) + v.length > 5 * 1024 * 1024) {
        var e = new Error("Quota");
        e.name = "QuotaExceededError";
        throw e;
      }
      data[k] = String(v);
    },
    removeItem(k) { delete data[k]; },
    clear() { data = {}; },
    __dump() { return data; },
  };
}

beforeEach(function () {
  globalThis.window = globalThis.window || {};
  globalThis.window.LZString = LZString;
  globalThis.localStorage = makeFakeStorage();
});

describe("persist: short IDs", () => {
  it("newId returns 12-char base-62 strings", async () => {
    var { newId } = await import("../src/assets/js/store/schema.js");
    /* crypto.getRandomValues is available in node ≥18 globally, so newId
       takes the modern path. */
    var id = newId();
    expect(id).toHaveLength(12);
    expect(/^[0-9a-zA-Z]{12}$/.test(id)).toBe(true);
  });

  it("newId is collision-free across 10K calls", async () => {
    var { newId } = await import("../src/assets/js/store/schema.js");
    var seen = new Set();
    for (var i = 0; i < 10000; i++) seen.add(newId());
    expect(seen.size).toBe(10000);
  });
});

describe("persist: compression round-trip", () => {
  it("writeJSON + readJSON round-trips a small object as raw JSON", async () => {
    var { writeJSON, readJSON, readRaw } = await import("../src/assets/js/store/persist.js");
    var payload = { id: "abc", name: "Tiny" };
    writeJSON("projectbudget:test", payload);
    var raw = readRaw("projectbudget:test");
    /* Small payloads stay uncompressed (< 2 KB threshold). */
    expect(raw && raw.indexOf("PB2:")).toBe(-1);
    expect(readJSON("projectbudget:test")).toEqual(payload);
  });

  it("writeJSON compresses large payloads with the PB2: prefix", async () => {
    var { writeJSON, readJSON, readRaw } = await import("../src/assets/js/store/persist.js");
    /* Build a fat repetitive payload — LZ will love this. */
    var fat = { rows: [] };
    for (var i = 0; i < 500; i++) {
      fat.rows.push({ id: "row-" + i, label: "The quick brown fox jumps over the lazy dog", n: i });
    }
    writeJSON("projectbudget:fat", fat);
    var raw = readRaw("projectbudget:fat");
    expect(raw.indexOf("PB2:")).toBe(0);
    /* Compressed size should be substantially smaller than raw JSON. */
    var rawJson = JSON.stringify(fat);
    expect(raw.length).toBeLessThan(rawJson.length * 0.5);
    /* Round-trip through readJSON returns the original. */
    expect(readJSON("projectbudget:fat")).toEqual(fat);
  });

  it("readJSON handles legacy raw JSON (no PB2: prefix) for back-compat", async () => {
    var { readJSON } = await import("../src/assets/js/store/persist.js");
    globalThis.localStorage.setItem("projectbudget:legacy", JSON.stringify({ hello: "world" }));
    expect(readJSON("projectbudget:legacy")).toEqual({ hello: "world" });
  });

  it("readJSON returns null for missing keys, doesn't throw", async () => {
    var { readJSON } = await import("../src/assets/js/store/persist.js");
    expect(readJSON("projectbudget:missing")).toBeNull();
  });
});

describe("persist: scheduleSave soft cap", () => {
  it("skips localStorage write when compressed payload exceeds 500 KB", async () => {
    var { scheduleSave } = await import("../src/assets/js/store/persist.js");
    /* Build a profile that compresses to >500 KB — needs lots of unique
       data that LZ can't dedupe much. Random base-62 IDs work great. */
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    function randStr(n) {
      var out = "";
      for (var j = 0; j < n; j++) out += chars[Math.floor(Math.random() * 62)];
      return out;
    }
    var profile = { id: "big", name: "Big", transactions: [] };
    /* 20K rows × ~140 chars raw = ~2.8 MB raw → ~1.4 MB compressed
       with random IDs that don't dedupe well. Well over the 500 KB
       soft cap. */
    for (var i = 0; i < 20000; i++) {
      profile.transactions.push({
        id: randStr(12),
        accountId: randStr(12),
        payeeId: randStr(12),
        categoryId: randStr(12),
        date: "2024-" + ((i % 12) + 1) + "-" + ((i % 28) + 1),
        amount: Math.round(Math.random() * 100000),
        memo: randStr(40),
      });
    }
    return new Promise(function (resolve) {
      scheduleSave(profile, function () {
        /* Soft-cap path: function calls onSaved, but localStorage stays
           empty (no key was written). */
        var stored = globalThis.localStorage.__dump();
        expect(Object.keys(stored).length).toBe(0);
        resolve();
      }, function () {
        resolve(new Error("onError should not fire when soft-cap triggers"));
      });
    });
  }, 5000);

  it("writes normally when payload is under the soft cap", async () => {
    var { scheduleSave } = await import("../src/assets/js/store/persist.js");
    var profile = { id: "small", name: "Small", transactions: [{ id: "t1", amount: 100 }] };
    return new Promise(function (resolve) {
      scheduleSave(profile, function () {
        var stored = globalThis.localStorage.__dump();
        var keys = Object.keys(stored);
        expect(keys.length).toBe(1);
        expect(keys[0]).toContain("small");
        resolve();
      });
    });
  }, 2000);
});
