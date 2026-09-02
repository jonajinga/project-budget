/* The REAL store's _memo cache (store.js), not the makeHost mirror.
 *
 * A verify pass mutated store.js _memo to never invalidate and all 186
 * unit tests still passed - invalidation was pinned only by e2e. These
 * pin it directly: same version caches, _bumpLists invalidates, and
 * the cache is NOT stored on the store object (it moved to a
 * module-scoped WeakMap after cache keys stored on the reactive store
 * registered as effect dependencies and froze the dashboard).
 */
import { describe, it, expect } from "vitest";
import { createStore } from "../src/assets/js/store/store.js";

describe("store._memo (the real one)", () => {
  it("caches within a version and recomputes after _bumpLists", () => {
    const s = createStore();
    let calls = 0;
    expect(s._memo("k", () => { calls += 1; return "v" + calls; })).toBe("v1");
    expect(s._memo("k", () => { calls += 1; return "v" + calls; })).toBe("v1");
    expect(calls).toBe(1);
    s._bumpLists();
    expect(s._memo("k", () => { calls += 1; return "v" + calls; })).toBe("v2");
    expect(calls).toBe(2);
  });

  it("keeps distinct keys distinct and stores no cache on the store itself", () => {
    const s = createStore();
    s._memo("a", () => 1);
    s._memo("b", () => 2);
    expect(s._memo("a", () => 99)).toBe(1);
    expect(s._memo("b", () => 99)).toBe(2);
    expect("_memoStore" in s, "cache must not live on the (reactive) store").toBe(false);
  });
});
