/* Reports slice — pure delegation to ../../domain/reports.js. Every
   method `this`-binds to the store and returns the domain function's
   result (or a safe empty value when there's no active profile).

   Lives separately so the report pages can reason about the surface
   without scanning the full Alpine store; long-term, the per-page
   bundle could `import` only this slice if we ever split the JS
   pipeline by route. */

import {
  incomeVsExpense, netWorthByMonth, spendingByCategory,
  monthlyTrendsByCategory, debtOverview, assignmentHistory, projection,
  savingsRate, payeeLeaderboard, budgetVsActual,
  sankeyFlows, categoryHeatmap, yearOverYear, detectSubscriptions,
} from "../../domain/reports.js";

export const reportsSlice = {
  reportIncomeVsExpense(endMonth, count) {
    return this.profile ? incomeVsExpense(this.profile, endMonth || this.currentMonth, count) : [];
  },
  reportNetWorth(endMonth, count) {
    return this.profile ? netWorthByMonth(this.profile, endMonth || this.currentMonth, count) : [];
  },
  reportSpending(fromMonth, toMonth) {
    if (!this.profile) return [];
    var to = toMonth || this.currentMonth;
    var from = fromMonth || to;
    return spendingByCategory(this.profile, from, to);
  },
  reportTrends(endMonth, count, topN) {
    return this.profile ? monthlyTrendsByCategory(this.profile, endMonth || this.currentMonth, count, topN) : [];
  },
  reportDebt() {
    return this.profile ? debtOverview(this.profile) : [];
  },
  reportAssignmentHistory(endMonth, count, topN) {
    return this.profile ? assignmentHistory(this.profile, endMonth || this.currentMonth, count, topN) : [];
  },
  reportProjection(count) {
    return this.profile ? projection(this.profile, count) : [];
  },
  reportSavingsRate(endMonth, count) {
    return this.profile ? savingsRate(this.profile, endMonth || this.currentMonth, count) : [];
  },
  reportPayeeLeaderboard(fromMonth, toMonth, limit) {
    if (!this.profile) return [];
    var to = toMonth || this.currentMonth;
    var from = fromMonth || to;
    return payeeLeaderboard(this.profile, from, to, limit);
  },
  reportBudgetVsActual(month) {
    return this.profile ? budgetVsActual(this.profile, month || this.currentMonth) : [];
  },

  /* ---- New reports (Phase 4) ---- */
  reportSankey(fromMonth, toMonth) {
    void this._listVersion;
    var from = fromMonth || this.currentMonth;
    var to   = toMonth   || from;
    return this.profile ? sankeyFlows(this.profile, from, to) : { nodes: [], links: [] };
  },
  reportHeatmap(endMonth, count, topN) {
    void this._listVersion;
    return this.profile
      ? categoryHeatmap(this.profile, endMonth || this.currentMonth, count || 12, topN || 15)
      : { months: [], categories: [], cells: {}, max: 0 };
  },
  reportYearOverYear(currentRange, priorRange) {
    void this._listVersion;
    if (!this.profile) return { current: {}, prior: {}, paired: [], categoryRows: [], payeeRows: [], deltas: {} };
    return yearOverYear(this.profile, currentRange, priorRange);
  },
  reportSubscriptions(lookbackMonths) {
    void this._listVersion;
    return this.profile ? detectSubscriptions(this.profile, lookbackMonths || 12) : [];
  },
};
