/* GoCardless Bank Account Data CSV export (European market). The export
   includes both debtor and creditor names — we use whichever is non-empty
   as the payee. transactionId is the dedupe anchor. */

import { parseCSV, parseDate, parseAmount } from "./import-csv.js";

export function parseGoCardless(text) {
  var parsed = parseCSV(text);
  var h = parsed.headers;
  /* GoCardless headers (case-insensitive after normalize). */
  var expected = ["bookingdate", "valuedate", "debtorname", "creditorname",
                  "remittanceinformation", "amount", "currency", "transactionid"];
  var matched = expected.filter(function (e) { return h.indexOf(e) !== -1; }).length;
  if (matched < 4) return { ok: false, error: "Does not look like a GoCardless export.", rows: [] };

  var rows = parsed.rows.map(function (r) {
    var amount = parseAmount(r["amount"]);
    var payee = r["creditorname"] || r["debtorname"] || "";
    return {
      date: parseDate(r["bookingdate"] || r["valuedate"]),
      payee: payee.trim(),
      amount: amount,
      memo: (r["remittanceinformation"] || "").trim(),
      transactionId: r["transactionid"] || "",
    };
  }).filter(function (r) { return r.date; });

  return { ok: true, rows: rows };
}

export function dryRun(profile, accountId, rows) {
  var existing = new Set();
  profile.transactions.forEach(function (t) {
    if (t.accountId !== accountId) return;
    var payeeName = "";
    if (t.payeeId) {
      var p = profile.payees.find(function (p) { return p.id === t.payeeId; });
      payeeName = p ? p.name : "";
    }
    existing.add([accountId, t.date, String(t.amount), payeeName.toLowerCase()].join("|"));
    if (t.transactionId) existing.add([accountId, "txid", t.transactionId].join("|"));
  });
  return rows.map(function (r) {
    var noTxId = [accountId, r.date, String(r.amount), (r.payee || "").toLowerCase()].join("|");
    var withTxId = r.transactionId ? [accountId, "txid", r.transactionId].join("|") : null;
    var duplicate = existing.has(noTxId) || (withTxId && existing.has(withTxId));
    return Object.assign({}, r, { duplicate: !!duplicate });
  });
}
