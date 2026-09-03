/* History slice: memoized per-category, per-group and per-cut series
   for the category and cuts pages. */

import { categorySeries, groupSeries, seriesStats, cutSeries, monthsBack } from "../../domain/history.js";

export const historySlice = {
  categorySeries(catId, n, through) {
    if (!this.profile) return [];
    var m = through || this.currentMonth;
    var self = this;
    return this._memo("catSeries:" + catId + ":" + n + ":" + m, function () {
      return categorySeries(self.profile, catId, m, n, self._monthIndex());
    });
  },
  groupSeries(groupId, n, through) {
    if (!this.profile) return [];
    var m = through || this.currentMonth;
    var self = this;
    return this._memo("groupSeries:" + groupId + ":" + n + ":" + m, function () {
      var ids = (self.profile.categories || []).filter(function (c) { return c.groupId === groupId && !self.isPaymentCategory(c.id); }).map(function (c) { return c.id; });
      return groupSeries(self.profile, ids, m, n, self._monthIndex());
    });
  },
  seriesStats(rows) { return seriesStats(rows || []); },
  cutSeries(cutId, through) {
    if (!this.profile) return null;
    var m = through || this.currentMonth;
    var self = this;
    return this._memo("cutSeries:" + cutId + ":" + m, function () {
      var cut = (self.profile.reductions || []).find(function (r) { return r.id === cutId; });
      return cut ? cutSeries(self.profile, cut, m, self._monthIndex()) : null;
    });
  },
  /** Every live cut with its series, plus portfolio totals and a timeline. */
  cutsPortfolio(through) {
    if (!this.profile) return { cuts: [], totals: {}, timeline: [] };
    var m = through || this.currentMonth;
    var self = this;
    return this._memo("cutsPortfolio:" + m, function () {
      var cuts = self.listCuts().map(function (cut) {
        var series = self.cutSeries(cut.id, m);
        var cat = self.findCategory(cut.categoryId);
        var grp = cat && cat.groupId ? self.findCategoryGroup(cat.groupId) : null;
        var now = series.rows[series.rows.length - 1] || { saved: 0, target: 0, actual: 0, pct: 0 };
        return { cut: cut, name: cat ? cat.name : "?", groupName: grp ? grp.name : "", series: series, now: now };
      });
      var totals = { planned: 0, realized: 0, cumSaved: 0, cumPlanned: 0, annual: 0 };
      cuts.forEach(function (c) {
        totals.planned += c.series.target; totals.realized += c.now.saved;
        totals.cumSaved += c.series.cumSaved; totals.cumPlanned += c.series.cumPlanned;
      });
      totals.annual = totals.planned * 12;
      var summary = self.cutsSummaryFor(m);
      totals.pctOfInflow = summary.pctOfAvgInflow;
      /* Timeline: from the earliest start to `through`. */
      var starts = cuts.map(function (c) { return c.cut.startMonth; }).sort();
      var timeline = [];
      if (starts.length) {
        var months = [];
        var mm = starts[0];
        var guard = 0;
        while (mm <= m && guard++ < 240) { months.push(mm); var p = mm.split("-").map(Number); var d = new Date(p[0], p[1], 1); mm = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
        var cumS = 0, cumP = 0;
        timeline = months.map(function (month) {
          var saved = 0, planned = 0;
          cuts.forEach(function (c) { var r = c.series.rows.find(function (x) { return x.month === month; }); if (r) { saved += r.saved; planned += r.target; } });
          cumS += saved; cumP += planned;
          return { month: month, saved: saved, planned: planned, cumSaved: cumS, cumPlanned: cumP };
        });
      }
      return { cuts: cuts, totals: totals, timeline: timeline };
    });
  },
  monthsBack(through, n) { return monthsBack(through || this.currentMonth, n); },
};
