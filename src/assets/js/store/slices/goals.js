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
    var g = findGoalForCategory(this.profile, categoryId);
    return goalNeeded(this.profile, g, month || this.currentMonth);
  },
  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {object|null} status descriptor from the domain helper
   */
  goalStatus(categoryId, month) {
    if (!this.profile) return null;
    var g = findGoalForCategory(this.profile, categoryId);
    return goalStatusFor(this.profile, g, month || this.currentMonth);
  },
};
