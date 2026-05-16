/* OFX 1.x (SGML) and OFX 2.x / QFX (XML) parser.
   Hand-written — no dependency. We extract <STMTTRN> elements and map
   their child tags into our transaction shape. QFX is OFX wrapped in
   Intuit's vendor header; the parser handles both. */

import { parseDate, parseAmount } from "./import-csv.js";

/* SGML-style OFX (pre-2.0) doesn't close tags. We normalize by inserting
   missing close tags before the next opening tag at the same depth, then
   read with a tag-state walker. */

function normalizeSGML(raw) {
  /* Strip any OFX/QFX header lines (key:value pairs before the first <). */
  var idx = raw.indexOf("<");
  if (idx > 0) raw = raw.slice(idx);
  /* Convert leaf tags: <FOO>bar -> <FOO>bar</FOO>
     Only when not followed by a closing tag already. */
  return raw.replace(/<([A-Z0-9.]+)>([^<\r\n]+?)(?=\s*<)/g, function (_m, tag, val) {
    return "<" + tag + ">" + val + "</" + tag + ">";
  });
}

function extractAll(xml, tag) {
  var re = new RegExp("<" + tag + ">([\\s\\S]*?)<\\/" + tag + ">", "g");
  var out = [];
  var m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function extractOne(xml, tag) {
  var m = new RegExp("<" + tag + ">([\\s\\S]*?)<\\/" + tag + ">").exec(xml);
  return m ? m[1].trim() : "";
}

/* OFX dates are YYYYMMDD or YYYYMMDDHHMMSS or with timezone suffix.
   We only care about the date portion. */
function parseOFXDate(s) {
  if (!s) return null;
  var clean = String(s).trim().slice(0, 8);
  if (!/^\d{8}$/.test(clean)) return parseDate(s);
  return clean.slice(0, 4) + "-" + clean.slice(4, 6) + "-" + clean.slice(6, 8);
}

export function parseOFX(raw) {
  var src = normalizeSGML(raw || "");
  var trns = extractAll(src, "STMTTRN");
  var accountFromFile = extractOne(src, "ACCTID");
  var rows = trns.map(function (block) {
    var fitid = extractOne(block, "FITID");
    var date = parseOFXDate(extractOne(block, "DTPOSTED"));
    var amount = parseAmount(extractOne(block, "TRNAMT"));
    var name = extractOne(block, "NAME");
    var memo = extractOne(block, "MEMO");
    var payee = name || memo;
    return {
      date: date,
      payee: (payee || "").trim(),
      amount: amount,
      memo: name && memo && name !== memo ? memo : "",
      fitid: fitid,
    };
  }).filter(function (r) { return r.date; });
  return { accountFromFile: accountFromFile, rows: rows };
}

/* Mirror import-csv.dedupeKey but include FITID when present — banks
   guarantee FITID uniqueness so it's the strongest signal. */
export function dedupeKey(accountId, t) {
  if (t.fitid) return [accountId, "fitid", t.fitid].join("|");
  return [accountId, t.date, String(t.amount), (t.payee || "").toLowerCase()].join("|");
}

export function dryRun(profile, accountId, rows) {
  var existing = new Set();
  /* Pull both forms — by FITID and by date+amount+payee. Stored
     transactions may not have a FITID, so we record both keys to
     maximize dedupe coverage. */
  profile.transactions.forEach(function (t) {
    if (t.accountId !== accountId) return;
    var payeeName = "";
    if (t.payeeId) {
      var p = profile.payees.find(function (p) { return p.id === t.payeeId; });
      payeeName = p ? p.name : "";
    }
    existing.add([accountId, t.date, String(t.amount), payeeName.toLowerCase()].join("|"));
    if (t.fitid) existing.add([accountId, "fitid", t.fitid].join("|"));
  });
  return rows.map(function (r) {
    var withoutFit = [accountId, r.date, String(r.amount), (r.payee || "").toLowerCase()].join("|");
    var withFit = r.fitid ? [accountId, "fitid", r.fitid].join("|") : null;
    var duplicate = existing.has(withoutFit) || (withFit && existing.has(withFit));
    return Object.assign({}, r, { duplicate: !!duplicate });
  });
}
