/* Goals slice — addGoal / removeGoal / findGoal / goalNeeded /
   goalStatus. Thin layer over ../../domain/goals.js with the
   undo/save plumbing every mutator needs. */

import {
  addGoal as addGoalImpl,
  removeGoalFor,
  findGoalForCategory,
  needed as goalNeeded,
  statusFor as goalStatusFor,
} from "../../domain/goals.js";

export const goalsSlice = {
  /**
   * Create or replace the goal on a category. Records an undo entry.
   * @param {object} opts {categoryId, type, target, ...}
   * @returns {object|null} the goal record
   */
  addGoal(opts) {
    if (!this.profile) return null;
    this._recordUndo("Set goal");
    var g = addGoalImpl(this.profile, opts);
    this._bumpLists();
    this._save();
    return g;
  },
  /**
   * Drop the goal attached to a category. Records an undo entry.
   * @param {id} categoryId
   */
  removeGoal(categoryId) {
    if (!this.profile) return;
    this._recordUndo("Remove goal");
    removeGoalFor(this.profile, categoryId);
    this._bumpLists();
    this._save();
  },
  /**
   * @param {id} categoryId
   * @returns {object|null}
   */
  findGoal(categoryId) {
    return this.profile ? findGoalForCategory(this.profile, categoryId) : null;
  },
  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {number} cents still needed to meet the goal in the month
   */
  goalNeeded(categoryId, month) {
    if (!this.profile) return 0;
    var m = month || this.currentMonth;
    var self = this;
    /* Memoized, and fed the slice's table-backed row: statusFor+needed
       used to cost 3-4 full carry-chain walks PER GOAL ROW per render. */
    return this._memo("goalNeeded:" + categoryId + ":" + m, function () {
      var g = findGoalForCategory(self.profile, categoryId);
      if (!g) return 0;
      return goalNeeded(self.profile, g, m, self.categoryRow(categoryId, m));
    });
  },
  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {object|null} status descriptor from the domain helper
   */
  goalStatus(categoryId, month) {
    if (!this.profile) return null;
    var m = month || this.currentMonth;
    var self = this;
    return this._memo("goalStatus:" + categoryId + ":" + m, function () {
      var g = findGoalForCategory(self.profile, categoryId);
      if (!g) return null;
      var row = self.categoryRow(categoryId, m);
      var n = goalNeeded(self.profile, g, m, row);
      return goalStatusFor(self.profile, g, m, row, n);
    });
  },
};
