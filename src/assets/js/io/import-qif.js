/* QIF parser. QIF is one-letter-prefix line oriented:
     D = date
     T or U = amount (T preferred; U is identical in modern files)
     P = payee
     M = memo
     L = category
     N = number / check number
     C = cleared flag (* or X = cleared)
     ^ = end of record
   Section headers like !Type:Bank or !Type:CCard indicate sign convention
   for older files; we always treat T as a signed number. */

import { parseDate, parseAmount } from "./import-csv.js";

export function parseQIF(raw) {
  var lines = (raw || "").replace(/\r/g, "").split("\n");
  var rows = [];
  var current = {};
  var type = "Bank";
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line.length) continue;
    if (line.charAt(0) === "!") {
      var t = line.slice(1);
      if (t.indexOf("Type:") === 0) type = t.slice(5);
      continue;
    }
    var code = line.charAt(0);
    var val = line.slice(1).trim();
    switch (code) {
      case "D": current.date = parseDate(val); break;
      case "T":
      case "U": current.amount = parseAmount(val); break;
      case "P": current.payee = val; break;
      case "M": current.memo = val; break;
      case "L": current.category = val; break;
      case "N": current.number = val; break;
      case "C": current.cleared = (val === "X" || val === "*"); break;
      case "^":
        if (current.date) {
          rows.push({
            date: current.date,
            payee: (current.payee || "").trim(),
            amount: current.amount || 0,
            memo: (current.memo || "").trim(),
            category: (current.category || "").trim(),
            cleared: !!current.cleared,
          });
        }
        current = {};
        break;
      default: break;
    }
  }
  return { type: type, rows: rows };
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
  });
  return rows.map(function (r) {
    var key = [accountId, r.date, String(r.amount), (r.payee || "").toLowerCase()].join("|");
    return Object.assign({}, r, { duplicate: existing.has(key) });
  });
}
