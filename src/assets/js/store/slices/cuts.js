/* Reduction-planning slice (budget revamp phase 6). One LIVE cut per
   category (adding again soft-deletes the old one inside the same
   undo entry); reads go through the month index and are memoized. */

import { newReduction } from "../schema.js";
import { cutTarget, cutProgress, cutsSummary } from "../../domain/cuts.js";
import { ageOfMoney, projectedAgeOfMoney } from "../../domain/insights.js";

export const cutsSlice = {
  /** Live cuts, oldest first. Reads _listVersion for reactivity. */
  listCuts() {
    void this._listVersion;
    if (!this.profile) return [];
    return (this.profile.reductions || []).filter(function (r) { return !r.deletedAt; });
  },
  /** @returns {object|null} the live cut on a category */
  cutForCategory(categoryId) {
    void this._listVersion;
    if (!this.profile) return null;
    return (this.profile.reductions || []).find(function (r) {
      return !r.deletedAt && r.categoryId === categoryId;
    }) || null;
  },
  /**
   * Create (or replace) the cut on a category. One undo entry covers
   * the soft-delete of any previous cut plus the new record.
   */
  addCut(opts) {
    if (!this.profile) return null;
    if (!Array.isArray(this.profile.reductions)) this.profile.reductions = [];
    this._recordUndo("Plan a cut");
    var now = new Date().toISOString();
    var catId = opts.categoryId;
    this.profile.reductions.forEach(function (r) {
      if (!r.deletedAt && r.categoryId === catId) {
        r.deletedAt = now;
        r.updatedAt = now;
      }
    });
    var cut = newReduction(Object.assign({ startMonth: this.currentMonth }, opts));
    this.profile.reductions.push(cut);
    this._bumpLists();
    this._save();
    return cut;
  },
  updateCut(id, patch) {
    if (!this.profile) return false;
    var cut = (this.profile.reductions || []).find(function (r) { return r.id === id; });
    if (!cut) return false;
    this._recordUndo("Edit cut");
    Object.assign(cut, patch, { updatedAt: new Date().toISOString(), version: (cut.version || 1) + 1 });
    this._bumpLists();
    this._save();
    return true;
  },
  /** Soft delete. */
  removeCut(id) {
    if (!this.profile) return false;
    var cut = (this.profile.reductions || []).find(function (r) { return r.id === id && !r.deletedAt; });
    if (!cut) return false;
    this._recordUndo("Remove cut");
    var now = new Date().toISOString();
    cut.deletedAt = now;
    cut.updatedAt = now;
    this._bumpLists();
    this._save();
    return true;
  },
  cutTargetFor(cutId) {
    var self = this;
    return this._memo("cutTarget:" + cutId, function () {
      var cut = (self.profile.reductions || []).find(function (r) { return r.id === cutId; });
      return cut ? cutTarget(self.profile, cut, self._monthIndex()) : 0;
    });
  },
  cutProgressFor(cutId, month) {
    if (!this.profile) return null;
    var m = month || this.currentMonth;
    var self = this;
    return this._memo("cutProgress:" + cutId + ":" + m, function () {
      var cut = (self.profile.reductions || []).find(function (r) { return r.id === cutId; });
      return cut ? cutProgress(self.profile, cut, m, self._monthIndex()) : null;
    });
  },
  cutsSummaryFor(month) {
    if (!this.profile) return { monthlyPlanned: 0, monthlyRealized: 0, annualPlanned: 0, pctOfAvgInflow: 0, projectedRtaDelta: 0 };
    var m = month || this.currentMonth;
    var self = this;
    return this._memo("cutsSummary:" + m, function () {
      return cutsSummary(self.profile, self.listCuts(), m, self._monthIndex());
    });
  },
  /** Current age of money in days (null until there are outflows). */
  ageOfMoneyStat() {
    if (!this.profile) return null;
    var self = this;
    return this._memo("aom", function () {
      return ageOfMoney(self.profile, new Date().toISOString().slice(0, 10));
    });
  },
  /** Age of money if the planned cuts land, same null semantics. */
  projectedAgeOfMoneyStat(month) {
    if (!this.profile) return null;
    var planned = this.cutsSummaryFor(month).monthlyPlanned;
    var self = this;
    return this._memo("aomProjected:" + planned, function () {
      return projectedAgeOfMoney(self.profile, planned, new Date().toISOString().slice(0, 10));
    });
  },
};
