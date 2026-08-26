/* Trash must survive a boot in a real browser.
 *
 * The unit tests for this cannot prove it. They stub window.LZString onto
 * globalThis before importing anything, so decompression is always
 * available. In the real app LZString arrives from a separate <script>
 * tag (app.njk:79) while pruneTrash() runs during store.init() on
 * alpine:init -- and if the library were not there yet, every compressed
 * record would read as unparseable at exactly the moment the app decides
 * what to delete.
 *
 * So this test writes a genuinely LZString-compressed trash record,
 * boots the app for real, and checks the record is still there. It is the
 * only place the load ORDER is actually exercised.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "./fixtures.js";
import { gotoApp } from "./helpers.js";
import { newProfile } from "../../src/assets/js/store/schema.js";

const lzSrc = readFileSync(resolve("./src/assets/js/vendor/lz-string.min.js"), "utf8");
// eslint-disable-next-line no-eval
const LZString = eval(lzSrc + "; LZString");

const TRASHED_ID = "boot-trash-fixture";
const TRASHED_NAME = "Deleted household";

/* A profile far past the 2048-char compression threshold. */
function buildTrashRecord() {
  const p = newProfile(TRASHED_NAME);
  p.id = TRASHED_ID;
  p.accounts.push({ id: "a1", name: "Joint Checking", type: "checking", groupId: null, onBudget: true });
  for (let i = 0; i < 60; i++) {
    p.transactions.push({
      id: "t" + i, accountId: "a1", categoryId: null, payeeId: null,
      date: "2026-07-" + String((i % 28) + 1).padStart(2, "0"),
      amount: -1234, memo: "Trashed transaction " + i, cleared: true,
    });
  }
  const json = JSON.stringify({ profile: p, deletedAt: Date.now() });
  const packed = "PB2:" + LZString.compressToUTF16(json);
  return { json, packed };
}

test.describe("a compressed trashed profile survives boot", () => {
  test("the record is still on disk after the app starts", async ({ empty }) => {
    const { json, packed } = buildTrashRecord();
    /* Guard the fixture itself: if this were not compressed the test
       would pass against the very bug it exists to catch. */
    expect(json.length).toBeGreaterThan(2048);
    expect(packed.startsWith("PB2:")).toBe(true);

    await empty.addInitScript(
      ([key, value]) => { try { localStorage.setItem(key, value); } catch (_e) {} },
      ["projectbudget:trash:" + TRASHED_ID, packed]
    );

    const page = await empty.newPage();
    /* store.init() -> pruneTrash() runs during this navigation. */
    await gotoApp(page, "/app/");

    const stillThere = await page.evaluate(
      (id) => localStorage.getItem("projectbudget:trash:" + id),
      TRASHED_ID
    );
    expect(stillThere).not.toBeNull();
    expect(stillThere.startsWith("PB2:")).toBe(true);
  });

  test("and the trash page lists it", async ({ empty }) => {
    const { packed } = buildTrashRecord();

    await empty.addInitScript(
      ([key, value]) => { try { localStorage.setItem(key, value); } catch (_e) {} },
      ["projectbudget:trash:" + TRASHED_ID, packed]
    );

    const page = await empty.newPage();
    await gotoApp(page, "/app/trash/");

    /* Proves listTrash() decompressed successfully with the real library
       at real boot time, not just that the key survived. */
    await expect(page.locator("#main")).toContainText(TRASHED_NAME, { timeout: 6000 });
  });

  test("LZString is available before the store initialises", async ({ empty }) => {
    const page = await empty.newPage();
    await gotoApp(page, "/app/");

    /* If this ever goes false, pruneTrash cannot read anything at boot
       and the whole class of bug returns by a different route. */
    const ready = await page.evaluate(() => ({
      lz: typeof window.LZString !== "undefined" && typeof window.LZString.decompressFromUTF16 === "function",
      storeBooted: !!(window.Alpine && window.Alpine.store("budget")),
    }));
    expect(ready.lz).toBe(true);
    expect(ready.storeBooted).toBe(true);
  });
});
