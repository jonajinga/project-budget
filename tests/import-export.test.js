import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/* Stand up window+localStorage+LZString stubs before importing the
   slice — import/export touches persist.js for bundle writes. */
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

async function buildHost() {
  var { makeHost } = await import("./helpers.js");
  var { importExportSlice } = await import("../src/assets/js/store/slices/import-export.js");
  var { accountsSlice } = await import("../src/assets/js/store/slices/accounts.js");
  var { categoriesSlice } = await import("../src/assets/js/store/slices/categories.js");
  var { transactionsSlice } = await import("../src/assets/js/store/slices/transactions.js");
  var { payeesSlice } = await import("../src/assets/js/store/slices/payees.js");
  var { rulesSlice } = await import("../src/assets/js/store/slices/rules.js");
  var h = makeHost([importExportSlice, accountsSlice, categoriesSlice, transactionsSlice, payeesSlice, rulesSlice]);
  /* importJSONReplacing needs _load (typically the profile slice).
     Stub it so the tests don't pull in the whole profile module. */
  h._load = function (id) { /* would re-hydrate a profile by id */ };
  var grp = h.addCategoryGroup("Food");
  var groceries = h.addCategory({ name: "Groceries", groupId: grp.id });
  var acct = h.addAccount({ name: "Checking", type: "checking", openingBalance: 100000 });
  return { host: h, acct: acct, groceries: groceries };
}

describe("importExportSlice — JSON parsing", () => {
  it("parseImportJSON returns ok+profile for a valid export", async () => {
    var ctx = await buildHost();
    /* Round-trip: serialize the active profile, parse it back. */
    var json = JSON.stringify(ctx.host.profile);
    var parsed = ctx.host.parseImportJSON(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.kind).toBe("profile");
    expect(parsed.profile.id).toBe(ctx.host.profile.id);
    expect(parsed.counts.accounts).toBe(1);
  });

  it("parseImportJSON returns ok=false for garbage input", async () => {
    var ctx = await buildHost();
    var bad = ctx.host.parseImportJSON("not json at all {{");
    expect(bad.ok).toBe(false);
    expect(bad.error).toBeTruthy();
  });

  it("parseImportJSON rejects JSON missing schemaVersion", async () => {
    var ctx = await buildHost();
    var bad = ctx.host.parseImportJSON(JSON.stringify({ id: "x", name: "no schema" }));
    expect(bad.ok).toBe(false);
  });

  it("parseImportJSON accepts a bundle wrapper", async () => {
    var ctx = await buildHost();
    var bundle = { kind: "bundle", profiles: [ctx.host.profile, ctx.host.profile] };
    var parsed = ctx.host.parseImportJSON(JSON.stringify(bundle));
    expect(parsed.ok).toBe(true);
    expect(parsed.kind).toBe("bundle");
    expect(parsed.profiles).toHaveLength(2);
  });
});

describe("importExportSlice — CSV pipeline", () => {
  it("parseCSVText extracts headers + rows + a detection guess", async () => {
    var ctx = await buildHost();
    var csv = "Date,Payee,Amount,Memo\n2024-01-15,Whole Foods,-25.40,Groceries\n2024-01-16,Cafe,-4.75,Latte\n";
    var parsed = ctx.host.parseCSVText(csv);
    expect(parsed.headers).toContain("date");
    expect(parsed.headers).toContain("amount");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.detection).toBeTruthy();
  });

  it("applyCSVMapping normalizes rows into {date, payee, amount, memo, category}", async () => {
    var ctx = await buildHost();
    var rows = [
      { date: "2024-01-15", payee: "Whole Foods", amount: "-25.40", memo: "Groceries" },
      { date: "2024-01-16", payee: "Cafe", amount: "-4.75", memo: "Latte" },
    ];
    var mapped = ctx.host.applyCSVMapping(rows, {
      date: "date", payee: "payee", amount: "amount", memo: "memo",
    });
    expect(mapped).toHaveLength(2);
    expect(mapped[0].date).toBe("2024-01-15");
    expect(mapped[0].amount).toBe(-2540);
    expect(mapped[1].payee).toBe("Cafe");
  });

  it("dryRunCSV flags duplicates already in the active profile", async () => {
    var ctx = await buildHost();
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Whole Foods", amount: -2540 });
    var rows = [
      { date: "2024-01-15", payee: "Whole Foods", amount: -2540 },
      { date: "2024-01-16", payee: "Cafe", amount: -475 },
    ];
    var annotated = ctx.host.dryRunCSV(ctx.acct.id, rows);
    expect(annotated[0].duplicate).toBe(true);
    expect(annotated[1].duplicate).toBe(false);
  });

  it("commitImport adds only non-duplicate rows + returns counts", async () => {
    var ctx = await buildHost();
    /* Seed a row so we can verify dedupe at commit time. */
    ctx.host.addTransaction({ accountId: ctx.acct.id, date: "2024-01-15", payeeName: "Whole Foods", amount: -2540 });
    var rows = [
      { date: "2024-01-15", payee: "Whole Foods", amount: -2540, duplicate: true },
      { date: "2024-01-16", payee: "Cafe",        amount: -475,  duplicate: false, category: "Groceries" },
      { date: "2024-01-17", payee: "Lunch",       amount: -1200, duplicate: false },
    ];
    var result = ctx.host.commitImport(ctx.acct.id, rows);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(1);
    /* Cafe row picked up the Groceries category by name match. */
    var cafe = ctx.host.profile.transactions.find(function (t) {
      var p = ctx.host.profile.payees.find(function (p) { return p.id === t.payeeId; });
      return p && p.name === "Cafe";
    });
    expect(cafe.categoryId).toBe(ctx.groceries.id);
  });

  it("commitImport skips rows with missing date or amount", async () => {
    var ctx = await buildHost();
    var rows = [
      { payee: "No date" },
      { date: "2024-01-15", payee: "No amount" },
      { date: "2024-01-16", payee: "Has both", amount: -1000 },
    ];
    var result = ctx.host.commitImport(ctx.acct.id, rows);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(2);
  });
});

describe("importExportSlice — null-profile safety", () => {
  it("commitImport returns {added:0, skipped:0} when profile is null", async () => {
    var ctx = await buildHost();
    ctx.host.profile = null;
    var r = ctx.host.commitImport("x", [{ date: "2024-01-15", amount: -100 }]);
    expect(r).toEqual({ added: 0, skipped: 0 });
  });

  it("dryRun* helpers return rows with duplicate:false when profile is null", async () => {
    var ctx = await buildHost();
    ctx.host.profile = null;
    var rows = [{ date: "2024-01-15", payee: "X", amount: -100 }];
    expect(ctx.host.dryRunCSV("x", rows)[0].duplicate).toBe(false);
    expect(ctx.host.dryRunOFX("x", rows)[0].duplicate).toBe(false);
    expect(ctx.host.dryRunQIF("x", rows)[0].duplicate).toBe(false);
    expect(ctx.host.dryRunGoCardless("x", rows)[0].duplicate).toBe(false);
  });
});
