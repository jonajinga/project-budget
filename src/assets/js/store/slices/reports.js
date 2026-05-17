/* Reports slice — delegation to ../../domain/reports.js, but every
   method goes through this._memo (store-level cache keyed on
   _listVersion). Each domain function walks the full transactions
   list (1,000+ rows at sample scale); dashboard widgets + chart
   bootstraps + report tables all call them on every render, so
   memoizing once per profile mutation collapses dozens of walks
   per tick to one. */

import {
  incomeVsExpense, netWorthByMonth, spendingByCategory,
  monthlyTrendsByCategory, debtOverview, assignmentHistory, projection,
  savingsRate, payeeLeaderboard, budgetVsActual,
  sankeyFlows, categoryHeatmap, yearOverYear, detectSubscriptions,
} from "../../domain/reports.js";

export const reportsSlice = {
  /** @returns {object[]} */
  reportIncomeVsExpense(endMonth, count) {
    if (!this.profile) return [];
    var em = endMonth || this.currentMonth;
    var cnt = count || 0;
    var self = this;
    return this._memo("rIE:" + em + ":" + cnt, function () {
      return incomeVsExpense(self.profile, em, cnt);
    });
  },
  /** @returns {object[]} */
  reportNetWorth(endMonth, count) {
    if (!this.profile) return [];
    var em = endMonth || this.currentMonth;
    var cnt = count || 0;
    var self = this;
    return this._memo("rNW:" + em + ":" + cnt, function () {
      return netWorthByMonth(self.profile, em, cnt);
    });
  },
  /** @returns {object[]} */
  reportSpending(fromMonth, toMonth) {
    if (!this.profile) return [];
    var to = toMonth || this.currentMonth;
    var from = fromMonth || to;
    var self = this;
    return this._memo("rSp:" + from + ":" + to, function () {
      return spendingByCategory(self.profile, from, to);
    });
  },
  /** @returns {object[]} */
  reportTrends(endMonth, count, topN) {
    if (!this.profile) return [];
    var em = endMonth || this.currentMonth;
    var self = this;
    return this._memo("rTr:" + em + ":" + (count || 0) + ":" + (topN || 0), function () {
      return monthlyTrendsByCategory(self.profile, em, count, topN);
    });
  },
  /** @returns {object[]} */
  reportDebt() {
    if (!this.profile) return [];
    var self = this;
    return this._memo("rDebt", function () { return debtOverview(self.profile); });
  },
  /** @returns {object[]} */
  reportAssignmentHistory(endMonth, count, topN) {
    if (!this.profile) return [];
    var em = endMonth || this.currentMonth;
    var self = this;
    return this._memo("rAH:" + em + ":" + (count || 0) + ":" + (topN || 0), function () {
      return assignmentHistory(self.profile, em, count, topN);
    });
  },
  /** @returns {object[]} */
  reportProjection(count) {
    if (!this.profile) return [];
    var cnt = count || 0;
    var self = this;
    return this._memo("rProj:" + cnt, function () {
      return projection(self.profile, cnt);
    });
  },
  /** @returns {object[]} */
  reportSavingsRate(endMonth, count) {
    if (!this.profile) return [];
    var em = endMonth || this.currentMonth;
    var cnt = count || 0;
    var self = this;
    return this._memo("rSR:" + em + ":" + cnt, function () {
      return savingsRate(self.profile, em, cnt);
    });
  },
  /** @returns {object[]} */
  reportPayeeLeaderboard(fromMonth, toMonth, limit) {
    if (!this.profile) return [];
    var to = toMonth || this.currentMonth;
    var from = fromMonth || to;
    var lim = limit || 0;
    var self = this;
    return this._memo("rPL:" + from + ":" + to + ":" + lim, function () {
      return payeeLeaderboard(self.profile, from, to, lim);
    });
  },
  /** @returns {object[]} */
  reportBudgetVsActual(month) {
    if (!this.profile) return [];
    var m = month || this.currentMonth;
    var self = this;
    return this._memo("rBA:" + m, function () {
      return budgetVsActual(self.profile, m);
    });
  },

  /* ---- New reports (Phase 4) ---- */
  /** @returns {object} {nodes, links} */
  reportSankey(fromMonth, toMonth) {
    if (!this.profile) return { nodes: [], links: [] };
    var from = fromMonth || this.currentMonth;
    var to   = toMonth   || from;
    var self = this;
    return this._memo("rSk:" + from + ":" + to, function () {
      return sankeyFlows(self.profile, from, to);
    });
  },
  /** @returns {object} {months, categories, cells, max} */
  reportHeatmap(endMonth, count, topN) {
    if (!this.profile) return { months: [], categories: [], cells: {}, max: 0 };
    var em = endMonth || this.currentMonth;
    var c = count || 12;
    var t = topN || 15;
    var self = this;
    return this._memo("rHM:" + em + ":" + c + ":" + t, function () {
      return categoryHeatmap(self.profile, em, c, t);
    });
  },
  /** @returns {object} {current, prior, paired, categoryRows, payeeRows, deltas} */
  reportYearOverYear(currentRange, priorRange) {
    if (!this.profile) return { current: {}, prior: {}, paired: [], categoryRows: [], payeeRows: [], deltas: {} };
    var self = this;
    /* YoY ranges are objects; key on JSON. */
    var k = "rYoY:" + JSON.stringify(currentRange || {}) + ":" + JSON.stringify(priorRange || {});
    return this._memo(k, function () {
      return yearOverYear(self.profile, currentRange, priorRange);
    });
  },
  /** @returns {object[]} */
  reportSubscriptions(lookbackMonths) {
    if (!this.profile) return [];
    var lm = lookbackMonths || 12;
    var self = this;
    return this._memo("rSubs:" + lm, function () {
      return detectSubscriptions(self.profile, lm);
    });
  },
};
