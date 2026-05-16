/* Money + date formatting helpers. All money is integer cents in the store. */

export function dollars(cents) {
  var n = Number(cents) || 0;
  return (n / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function signedDollars(cents) {
  var n = Number(cents) || 0;
  return dollars(n);
}

export function parseDollarInput(str) {
  if (str == null) return 0;
  var clean = String(str).replace(/[$,\s]/g, "").trim();
  if (/^\(.*\)$/.test(clean)) clean = "-" + clean.slice(1, -1);
  var n = Number(clean);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function readableDate(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
