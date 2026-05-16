/* CSV import pipeline.

   parseCSV(text) -> { headers, rows } using PapaParse when available, or
   a tiny built-in parser as a fallback (covers the smoke tests in node
   where PapaParse isn't loaded as a global). */

import { detect } from "./csv-shapes.js";

function stripBOM(s) {
  if (s && s.charCodeAt(0) === 0xFEFF) return s.slice(1);
  return s;
}

function fallbackParse(text) {
  /* Simple RFC-4180-ish parser. Handles quoted fields with embedded
     commas/newlines and "" escapes. Sufficient for the smoke tests; in
     the browser PapaParse handles edge cases. */
  text = stripBOM(text || "");
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;
  var i = 0;
  while (i < text.length) {
    var ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { inQuotes = false; i += 1; continue; }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ",") { row.push(field); field = ""; i += 1; continue; }
    if (ch === "\r") { i += 1; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i += 1; continue; }
    field += ch; i += 1;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(function (r) { return r.length > 1 || (r.length === 1 && r[0].length); });
}

export function parseCSV(text) {
  text = stripBOM(text || "");
  var rows;
  if (typeof window !== "undefined" && window.Papa) {
    var result = window.Papa.parse(text, { skipEmptyLines: true });
    rows = result.data;
  } else {
    rows = fallbackParse(text);
  }
  if (!rows.length) return { headers: [], rows: [] };
  var headers = rows[0].map(function (h) { return (h || "").trim().toLowerCase(); });
  var body = rows.slice(1).map(function (r) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = (r[i] !== undefined ? String(r[i]).trim() : ""); });
    return obj;
  });
  return { headers: headers, rows: body };
}

/* Parse a date string in any of the common bank shapes. Tries:
     YYYY-MM-DD
     M/D/YYYY  or MM/DD/YYYY
     D/M/YYYY  or DD/MM/YYYY (only if first part > 12)
     YYYYMMDD
     Mon DD, YYYY
*/
export function parseDate(str) {
  if (!str) return null;
  var s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var m;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
    var month = Number(m[1]);
    var day = Number(m[2]);
    var year = Number(m[3]);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) { var t = month; month = day; day = t; }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }
  if (/^\d{8}$/.test(s)) {
    return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
  }
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  return null;
}

/* Parse a dollar string to integer cents. Accepts negatives, parens,
   thousands separators, currency symbols. */
export function parseAmount(str) {
  if (!str && str !== 0) return 0;
  var s = String(str).trim();
  if (!s) return 0;
  var neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[\$£€¥,\s]/g, "");
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  if (s.startsWith("+")) { s = s.slice(1); }
  var n = Number(s);
  if (!isFinite(n)) return 0;
  return (neg ? -1 : 1) * Math.round(n * 100);
}

/* Build the candidate transaction rows from a parsed CSV using a column
   map. Returns rows with: { date, payee, amount, memo, category }.
   Amount logic:
     - If columnMap.amount: use that as a signed number.
     - Else if columnMap.debit/credit: amount = credit - debit.
     - For Mint shape with typeColumn === "transaction type": "debit"
       flips the sign to negative; "credit" stays positive. */
export function applyMapping(rows, columnMap) {
  return rows.map(function (r) {
    var date = parseDate(r[columnMap.date]);
    var payee = r[columnMap.payee] || "";
    var memo = r[columnMap.memo] || "";
    var amount = 0;
    if (columnMap.amount) {
      amount = parseAmount(r[columnMap.amount]);
      if (columnMap.typeColumn && r[columnMap.typeColumn]) {
        var typ = String(r[columnMap.typeColumn]).toLowerCase();
        /* Mint: "debit" should be negative even when the Amount column is
           unsigned. "credit" stays positive. */
        if (typ.indexOf("debit") !== -1 && amount > 0) amount = -amount;
      }
    } else if (columnMap.debit || columnMap.credit) {
      var debit = parseAmount(r[columnMap.debit]);
      var credit = parseAmount(r[columnMap.credit]);
      amount = Math.abs(credit) - Math.abs(debit);
    }
    return {
      date: date,
      payee: payee.trim(),
      amount: amount,
      memo: memo.trim(),
      category: r[columnMap.category] ? r[columnMap.category].trim() : "",
    };
  }).filter(function (r) { return r.date; });
}

/* Dedupe key — used to skip rows already in the profile. */
export function dedupeKey(accountId, t) {
  return [accountId, t.date, String(t.amount), (t.payee || "").toLowerCase()].join("|");
}

/* Run a dry-run preview against a profile: classify each row as new or
   duplicate. Doesn't mutate the profile. */
export function dryRun(profile, accountId, rows) {
  var existing = new Set();
  profile.transactions.forEach(function (t) {
    if (t.accountId !== accountId) return;
    var payeeName = "";
    if (t.payeeId) {
      var p = profile.payees.find(function (p) { return p.id === t.payeeId; });
      payeeName = p ? p.name : "";
    }
    existing.add(dedupeKey(accountId, { date: t.date, amount: t.amount, payee: payeeName }));
  });
  return rows.map(function (r) {
    var key = dedupeKey(accountId, r);
    return Object.assign({}, r, { duplicate: existing.has(key) });
  });
}

export { detect };
