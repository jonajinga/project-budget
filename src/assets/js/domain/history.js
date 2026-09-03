/* Per-category, per-group and per-cut history. Pure functions over the
   month index and budget table, so a page can ask for five years of
   one category without walking the transactions five years' worth of
   times. */

import { buildMonthIndex, buildBudgetTable, tableCategoryRow, prevMonth } from "./budget.js";
import { cutProgress, cutTarget, cutBaseline } from "./cuts.js";

/** Ascending list of `n` months ending at `through` (YYYY-MM). */
export function monthsBack(through, n) {
  var out = [];
  var m = through;
  for (var i = 0; i < n; i++) { out.unshift(m); m = prevMonth(m); }
  return out;
}

/**
 * One row per month for a category.
 * @returns {Array<{month, carryIn, assigned, activity, available, outflow, inflow}>}
 */
export function categorySeries(profile, catId, through, n, index) {
  var idx = index || buildMonthIndex(profile);
  var months = monthsBack(through, n);
  var table = buildBudgetTable(profile, through, idx);
  return months.map(function (m) {
    var row = tableCategoryRow(table, catId, m) || { carryIn: 0, assigned: 0, activity: 0, available: 0 };
    return {
      month: m,
      carryIn: row.carryIn, assigned: row.assigned, activity: row.activity, available: row.available,
      outflow: Math.max(0, -row.activity), inflow: Math.max(0, row.activity),
    };
  });
}

/** Same shape, summed over the group's member categories. */
export function groupSeries(profile, categoryIds, through, n, index) {
  var idx = index || buildMonthIndex(profile);
  var months = monthsBack(through, n);
  var table = buildBudgetTable(profile, through, idx);
  return months.map(function (m) {
    var sum = { month: m, carryIn: 0, assigned: 0, activity: 0, available: 0, outflow: 0, inflow: 0 };
    categoryIds.forEach(function (id) {
      var row = tableCategoryRow(table, id, m) || { carryIn: 0, assigned: 0, activity: 0, available: 0 };
      sum.carryIn += row.carryIn; sum.assigned += row.assigned; sum.activity += row.activity; sum.available += row.available;
      sum.outflow += Math.max(0, -row.activity); sum.inflow += Math.max(0, row.activity);
    });
    return sum;
  });
}

function avgOf(rows, key, k) {
  var tail = rows.slice(-k);
  if (!tail.length) return 0;
  return Math.round(tail.reduce(function (a, r) { return a + (r[key] || 0); }, 0) / tail.length);
}

/**
 * Summary numbers over a series (outflow-centric).
 * trendPct compares the mean of the last 3 months with the 3 before.
 */
export function seriesStats(rows) {
  var n = rows.length;
  var total = rows.reduce(function (a, r) { return a + r.outflow; }, 0);
  var assignedTotal = rows.reduce(function (a, r) { return a + r.assigned; }, 0);
  var last3 = rows.slice(-3), prior3 = rows.slice(-6, -3);
  var mean = function (arr) { return arr.length ? arr.reduce(function (a, r) { return a + r.outflow; }, 0) / arr.length : 0; };
  var m1 = mean(last3), m0 = mean(prior3);
  var trendPct = m0 > 0 ? Math.round(((m1 - m0) / m0) * 100) : null;
  var maxRow = rows.reduce(function (best, r) { return (!best || r.outflow > best.outflow) ? r : best; }, null);
  var overspent = rows.filter(function (r) { return r.available < 0; }).length;
  var withActivity = rows.filter(function (r) { return r.outflow > 0; }).length;
  return {
    months: n, total: total, assignedTotal: assignedTotal,
    avg3: avgOf(rows, "outflow", 3), avg6: avgOf(rows, "outflow", 6), avg12: avgOf(rows, "outflow", 12),
    avgAll: n ? Math.round(total / n) : 0,
    trendPct: trendPct,
    maxMonth: maxRow && maxRow.outflow > 0 ? maxRow.month : null, maxOutflow: maxRow ? maxRow.outflow : 0,
    overspentMonths: overspent, activeMonths: withActivity,
    assignedVsSpent: assignedTotal - total,
  };
}

/**
 * Month-by-month record of a planned cut from its start month through
 * `through`: what the baseline was, what was planned, what was spent,
 * what that saved, and the running totals.
 */
export function cutSeries(profile, cut, through, index) {
  var idx = index || buildMonthIndex(profile);
  var out = [];
  var m = cut.startMonth;
  var cumSaved = 0, cumPlanned = 0, streak = 0, met = 0;
  var guard = 0;
  while (m <= through && guard++ < 240) {
    var pr = cutProgress(profile, cut, m, idx);
    var hit = pr.target > 0 ? pr.saved >= pr.target : false;
    cumSaved += pr.saved; cumPlanned += pr.target;
    if (hit) { streak += 1; met += 1; } else streak = 0;
    out.push({ month: m, baseline: pr.baseline, target: pr.target, actual: pr.actual, saved: pr.saved, pct: pr.pct, met: hit, cumSaved: cumSaved, cumPlanned: cumPlanned });
    m = nextMonthOf(m);
  }
  var baseline = cutBaseline(profile, cut, idx);
  var target = cutTarget(profile, cut, idx);
  var remaining = cut.targetMonth && cut.targetMonth > through ? monthsBetween(through, cut.targetMonth) : 0;
  return {
    rows: out, baseline: baseline, target: target, cumSaved: cumSaved, cumPlanned: cumPlanned,
    monthsActive: out.length, monthsMet: met, streak: streak,
    monthsRemaining: remaining,
    projectedByTarget: cumSaved + target * remaining,
    plannedByTarget: cumPlanned + target * remaining,
  };
}

function nextMonthOf(m) {
  var p = m.split("-").map(Number);
  var d = new Date(p[0], p[1], 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function monthsBetween(a, b) {
  var x = a.split("-").map(Number), y = b.split("-").map(Number);
  return Math.max(0, (y[0] - x[0]) * 12 + (y[1] - x[1]));
}
