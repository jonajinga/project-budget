/* Reduction planning ("planned cuts") - the budget revamp's own idea.
   A cut marks a category with a monthly reduction target measured
   against a FROZEN baseline: the mean outflow of the 3 calendar months
   before the cut's startMonth. Frozen matters - a rolling baseline
   would shrink as the user succeeds, moving the goalposts against
   them. All functions are pure and read months through the month
   index (buildMonthIndex) rather than scanning transactions. */

import { prevMonth } from "./budget.js";

function spendIn(index, categoryId, month) {
  var bucket = index.act[month];
  var act = (bucket && bucket[categoryId]) || 0;
  /* A net-refund month is a 0-spend month, not negative spend. */
  return Math.max(0, -act);
}

/**
 * The frozen baseline: mean outflow of the 3 months before startMonth.
 * @returns {number} cents/month
 */
export function cutBaseline(profile, cut, index) {
  var total = 0;
  var m = cut.startMonth;
  for (var i = 0; i < 3; i++) {
    m = prevMonth(m);
    total += spendIn(index, cut.categoryId, m);
  }
  return Math.round(total / 3);
}

/**
 * The planned monthly reduction: the literal cents for "amount" cuts,
 * or basis points of the baseline for "percent" cuts (1000 = 10%).
 * @returns {number} cents/month
 */
export function cutTarget(profile, cut, index) {
  if (cut.mode === "percent") {
    return Math.round(cutBaseline(profile, cut, index) * (cut.value || 0) / 10000);
  }
  return cut.value || 0;
}

/**
 * One month's progress against a cut.
 * @returns {{baseline, target, actual, saved, pct}} cents; pct 0-100
 */
export function cutProgress(profile, cut, month, index) {
  var baseline = cutBaseline(profile, cut, index);
  var target = cutTarget(profile, cut, index);
  var actual = spendIn(index, cut.categoryId, month);
  var saved = Math.max(0, baseline - actual);
  var pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  return { baseline: baseline, target: target, actual: actual, saved: saved, pct: pct };
}

/**
 * Portfolio view over the LIVE cuts for a month.
 * pctOfAvgInflow measures the planned savings against the mean
 * inflow-to-budget of the 3 months before `month`.
 * @returns {{monthlyPlanned, monthlyRealized, annualPlanned, pctOfAvgInflow, projectedRtaDelta}}
 */
export function cutsSummary(profile, cuts, month, index) {
  var planned = 0;
  var realized = 0;
  (cuts || []).forEach(function (cut) {
    if (!cut || cut.deletedAt) return;
    planned += cutTarget(profile, cut, index);
    realized += cutProgress(profile, cut, month, index).saved;
  });
  var inflowTotal = 0;
  var m = month;
  for (var i = 0; i < 3; i++) {
    m = prevMonth(m);
    inflowTotal += index.inflow[m] || 0;
  }
  var avgInflow = Math.round(inflowTotal / 3);
  return {
    monthlyPlanned: planned,
    monthlyRealized: realized,
    annualPlanned: planned * 12,
    pctOfAvgInflow: avgInflow > 0 ? Math.round((planned / avgInflow) * 100) : 0,
    /* Every achieved month of cuts leaves this much MORE in Ready to
       Assign than the baseline trajectory would have. */
    projectedRtaDelta: planned,
  };
}
