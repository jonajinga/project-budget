/* Four goal types. Each computes `needed(month)` — the dollars the user
   should assign this month to stay on track.

   monthlyFixed   — assign `target` every month.
   refillUpTo     — top the category balance back up to `target` at the
                    start of each month.
   monthlyTopUp   — assign `target` cents on top of whatever rolled over.
                    (Effectively the same as monthlyFixed minus carryIn.
                    Project Budget keeps it distinct so the UI can label it differently.)
   targetByDate   — accumulate to `target` by `byDate`. Per-month need is
                    the remaining gap divided by remaining whole months. */

import { newGoal } from "../store/schema.js";
import { categoryRow } from "./budget.js";

export const GOAL_TYPES = [
  { value: "monthlyFixed", label: "Monthly fixed amount" },
  { value: "refillUpTo",   label: "Refill up to a balance" },
  { value: "monthlyTopUp", label: "Add a fixed amount on top" },
  { value: "targetByDate", label: "Reach a target by a date" },
];

/**
 * Adds a goal, replacing any existing goal on the same category. Mutates profile.
 * @param {Profile} profile
 * @param {object} opts - { categoryId, type, target, byDate? }
 * @returns {object} the new goal
 */
export function addGoal(profile, opts) {
  /* Replace any existing goal on the same category. */
  removeGoalFor(profile, opts.categoryId);
  var g = newGoal(opts);
  profile.goals.push(g);
  /* Link from the category for fast lookup. */
  var c = profile.categories.find(function (x) { return x.id === opts.categoryId; });
  if (c) c.goalId = g.id;
  return g;
}

/**
 * Removes whatever goal is set on a category. Mutates profile in place.
 * @param {Profile} profile
 * @param {string} categoryId
 */
export function removeGoalFor(profile, categoryId) {
  profile.goals = profile.goals.filter(function (g) { return g.categoryId !== categoryId; });
  var c = profile.categories.find(function (x) { return x.id === categoryId; });
  if (c) c.goalId = null;
}

/**
 * Returns the goal attached to a category, or null.
 * @param {Profile} profile
 * @param {string} categoryId
 * @returns {object|null}
 */
export function findGoalForCategory(profile, categoryId) {
  return profile.goals.find(function (g) { return g.categoryId === categoryId; }) || null;
}

function monthsBetween(fromMonth, toISO) {
  /* Returns whole months remaining from start of `fromMonth` to `toISO`,
     inclusive of both endpoints. Parses as UTC to avoid timezone drift —
     `new Date("YYYY-MM-DD")` is UTC midnight, then getMonth() reads local
     time, which can shift across month boundaries. */
  var fromParts = fromMonth.split("-").map(Number);
  var toParts = (toISO || "").split("-").map(Number);
  if (!toParts[0]) return 0;
  var diff = (toParts[0] - fromParts[0]) * 12 + ((toParts[1] || 1) - fromParts[1]);
  return Math.max(0, diff + 1);
}

/**
 * Cents the user should assign this month to keep the goal on track.
 * Dispatches on goal.type (monthlyFixed, monthlyTopUp, refillUpTo, targetByDate).
 * @param {Profile} profile
 * @param {object|null} goal
 * @param {string} month YYYY-MM
 * @returns {number} cents (always >= 0)
 */
export function needed(profile, goal, month) {
  if (!goal) return 0;
  var row = categoryRow(profile, goal.categoryId, month);
  var target = goal.target || 0;

  switch (goal.type) {
    case "monthlyFixed":
      return Math.max(0, target - row.assigned);

    case "monthlyTopUp":
      /* Top up means: assigned this month should be at least target.
         carryIn is irrelevant. */
      return Math.max(0, target - row.assigned);

    case "refillUpTo":
      /* Goal: at the end of this month, available should equal target.
         Spend in the month has already happened (row.activity is negative
         when spent), so we need:
           carryIn + assigned + activity = target
           assigned = target - carryIn - activity
         Below zero means already at or above target. */
      return Math.max(0, target - row.carryIn - row.activity - row.assigned);

    case "targetByDate":
      if (!goal.byDate) return 0;
      var monthsLeft = monthsBetween(month, goal.byDate);
      if (monthsLeft === 0) return Math.max(0, target - row.carryIn - row.assigned);
      var gap = target - row.carryIn;
      if (gap <= 0) return 0;
      return Math.max(0, Math.round(gap / monthsLeft) - row.assigned);

    default:
      return 0;
  }
}

/* Status for the UI badge: 'funded' | 'partial' | 'needed' | 'over'. */
/**
 * Goal status badge: 'funded' | 'partial' | 'needed' | 'over'.
 * @param {Profile} profile
 * @param {object|null} goal
 * @param {string} month YYYY-MM
 * @returns {string|null}
 */
export function statusFor(profile, goal, month) {
  if (!goal) return null;
  var n = needed(profile, goal, month);
  var row = categoryRow(profile, goal.categoryId, month);
  if (n === 0) return "funded";
  if (row.assigned > 0) return "partial";
  if (row.available >= (goal.target || 0)) return "over";
  return "needed";
}
