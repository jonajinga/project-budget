/* Age of money (YNAB's metric, phase 6 of the budget revamp): treat
   every inflow as a queue of dollars, spend them FIFO, and report the
   amount-weighted average age in days of the dollars consumed by the
   LAST 10 outflows. Pure; O(T log T) for the sort. */

var DAY_MS = 86400000;

function dayValue(iso) { return Date.parse(iso.slice(0, 10) + "T00:00:00Z"); }

/**
 * @param {Profile} profile
 * @param {string} asOfDate YYYY-MM-DD (inclusive)
 * @returns {number|null} whole days, or null with no outflows yet
 */
export function ageOfMoney(profile, asOfDate) {
  var txns = (profile.transactions || [])
    .filter(function (t) {
      return t.date && t.date.slice(0, 10) <= asOfDate && !t.transferTxnId && !t.splits;
    })
    .slice()
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

  var queue = []; /* [{ts, remaining}] oldest first */
  var outflows = []; /* [{weighted, amount}] in date order */
  txns.forEach(function (t) {
    if (t.amount > 0) {
      queue.push({ ts: dayValue(t.date), remaining: t.amount });
      return;
    }
    if (t.amount >= 0) return;
    var need = -t.amount;
    var ts = dayValue(t.date);
    var weighted = 0;
    var consumed = 0;
    while (need > 0 && queue.length) {
      var head = queue[0];
      var take = Math.min(need, head.remaining);
      weighted += take * ((ts - head.ts) / DAY_MS);
      consumed += take;
      head.remaining -= take;
      need -= take;
      if (head.remaining <= 0) queue.shift();
    }
    if (consumed > 0) outflows.push({ weighted: weighted, amount: consumed });
  });

  var last = outflows.slice(-10);
  if (!last.length) return null;
  var w = 0;
  var amt = 0;
  last.forEach(function (o) { w += o.weighted; amt += o.amount; });
  return amt > 0 ? Math.round(w / amt) : null;
}

/**
 * Documented approximation, no re-simulation: saving S cents/month
 * against an average daily spend D pushes the age up ~S/D days.
 * @returns {number|null} days, or null when ageOfMoney is null
 */
export function projectedAgeOfMoney(profile, monthlySavedCents, asOfDate) {
  var current = ageOfMoney(profile, asOfDate);
  if (current == null) return null;
  var cutoff = new Date(dayValue(asOfDate) - 89 * DAY_MS).toISOString().slice(0, 10);
  var out = 0;
  (profile.transactions || []).forEach(function (t) {
    if (!t.date || t.transferTxnId) return;
    var d = t.date.slice(0, 10);
    if (d < cutoff || d > asOfDate) return;
    if (t.amount < 0) out += -t.amount;
  });
  var daily = out / 90;
  if (daily <= 0) return current;
  return current + Math.round((monthlySavedCents || 0) / daily);
}
