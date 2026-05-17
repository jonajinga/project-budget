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
  addGoal(opts) {
    if (!this.profile) return null;
    this._recordUndo("Set goal");
    var g = addGoalImpl(this.profile, opts);
    this._bumpLists();
    this._save();
    return g;
  },
  removeGoal(categoryId) {
    if (!this.profile) return;
    this._recordUndo("Remove goal");
    removeGoalFor(this.profile, categoryId);
    this._bumpLists();
    this._save();
  },
  findGoal(categoryId) {
    return this.profile ? findGoalForCategory(this.profile, categoryId) : null;
  },
  goalNeeded(categoryId, month) {
    if (!this.profile) return 0;
    var g = findGoalForCategory(this.profile, categoryId);
    return goalNeeded(this.profile, g, month || this.currentMonth);
  },
  goalStatus(categoryId, month) {
    if (!this.profile) return null;
    var g = findGoalForCategory(this.profile, categoryId);
    return goalStatusFor(this.profile, g, month || this.currentMonth);
  },
};
