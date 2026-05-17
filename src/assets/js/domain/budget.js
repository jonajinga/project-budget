/* Envelope budget math.

   Conventions
   -----------
   - Months are ISO YYYY-MM strings.
   - All amounts are integer cents.
   - "Inflow to budget" = any transaction with amount > 0, categoryId === null,
     transferTxnId === null. The user can override by categorizing income.
   - On-budget overspending in month M doesn't roll into month M+1 — instead,
     it reduces month M+1's Ready to Assign (the overspending was funded by
     RTA, even if no category was assigned to cover it).
   - Credit-card payment categories compute activity from card spending and
     card payments rather than from direct transactions on that category.
*/

import { paymentCardId, paymentMap } from "./categories.js";

/**
 * ISO YYYY-MM string for the given date (defaults to now).
 * @param {Date} [d]
 * @returns {string} YYYY-MM
 */
export function thisMonth(d) {
  var dt = d || new Date();
  return dt.toISOString().slice(0, 7);
}

/**
 * First day of a month as YYYY-MM-DD.
 * @param {string} month YYYY-MM
 * @returns {string} YYYY-MM-DD
 */
export function monthStart(month) { return month + "-01"; }

/**
 * Last day of a month as YYYY-MM-DD.
 * @param {string} month YYYY-MM
 * @returns {string} YYYY-MM-DD
 */
export function monthEnd(month) {
  var parts = month.split("-").map(Number);
  /* Day 0 of next month is the last day of `month` in JS Date. */
  var d = new Date(parts[0], parts[1], 0);
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

/**
 * Month before the given month.
 * @param {string} month YYYY-MM
 * @returns {string} YYYY-MM
 */
export function prevMonth(month) {
  var parts = month.split("-").map(Number);
  var d = new Date(parts[0], parts[1] - 2, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

/**
 * Month after the given month.
 * @param {string} month YYYY-MM
 * @returns {string} YYYY-MM
 */
export function nextMonth(month) {
  var parts = month.split("-").map(Number);
  var d = new Date(parts[0], parts[1], 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

/* All months that have any data (assigned, activity, or scheduled txns)
   plus the requested upper bound, sorted ascending. */
/**
 * Months with budget data or transactions, up to and including throughMonth.
 * @param {Profile} profile
 * @param {string} throughMonth YYYY-MM upper bound (inclusive)
 * @returns {Array<string>} ascending YYYY-MM list
 */
export function relevantMonths(profile, throughMonth) {
  var set = new Set();
  Object.keys(profile.budgets || {}).forEach(function (m) { set.add(m); });
  profile.transactions.forEach(function (t) { if (t.date) set.add(t.date.slice(0, 7)); });
  set.add(throughMonth);
  return [...set].filter(function (m) { return m <= throughMonth; }).sort();
}

function txnsForCategoryInMonth(profile, categoryId, month) {
  return profile.transactions.filter(function (t) {
    if (t.date.slice(0, 7) !== month) return false;
    if (t.transferTxnId) return false;
    if (t.splits) {
      return t.splits.some(function (s) { return s.categoryId === categoryId; });
    }
    return t.categoryId === categoryId;
  });
}

/* Activity in a category, signed (negative = outflow). For payment
   categories we derive it from credit-card spending and payments. */
/**
 * Signed activity (cents) for a category in a month. Payment categories
 * derive activity from credit-card spending and payments.
 * @param {Profile} profile
 * @param {string} categoryId
 * @param {string} month YYYY-MM
 * @returns {number} cents (negative = outflow)
 */
export function activity(profile, categoryId, month) {
  var paymentForCard = paymentCardId(profile, categoryId);
  if (paymentForCard) {
    var monthPrefix = month;
    var charges = 0;
    var payments = 0;
    profile.transactions.forEach(function (t) {
      if (t.accountId !== paymentForCard) return;
      if (t.date.slice(0, 7) !== monthPrefix) return;
      if (t.transferTxnId) {
        /* Incoming transfer (positive amount) = paying down the card =
           cash leaving the payment category. */
        if (t.amount > 0) payments += t.amount;
        return;
      }
      /* Outflow on the credit card that's categorized to a real budget
         category counts as charges (cash gets earmarked into the payment
         category). Skip uncategorized charges — they're treated as
         informational only. */
      if (t.amount < 0 && t.categoryId) {
        charges += Math.abs(t.amount);
      }
      if (t.amount < 0 && t.splits) {
        t.splits.forEach(function (s) {
          if (s.categoryId) charges += Math.abs(s.amount);
        });
      }
    });
    return charges - payments;
  }

  /* Normal category — sum signed amounts. Splits contribute their slice. */
  var sum = 0;
  profile.transactions.forEach(function (t) {
    if (t.date.slice(0, 7) !== month) return;
    if (t.transferTxnId) return;
    if (t.splits) {
      t.splits.forEach(function (s) { if (s.categoryId === categoryId) sum += (s.amount || 0); });
    } else if (t.categoryId === categoryId) {
      sum += (t.amount || 0);
    }
  });
  return sum;
}

/**
 * Amount assigned to a category in a month.
 * @param {Profile} profile
 * @param {string} categoryId
 * @param {string} month YYYY-MM
 * @returns {number} cents
 */
export function assigned(profile, categoryId, month) {
  return (profile.budgets[month] && profile.budgets[month].assigned && profile.budgets[month].assigned[categoryId]) || 0;
}

/**
 * Sum of all category assignments in a month.
 * @param {Profile} profile
 * @param {string} month YYYY-MM
 * @returns {number} cents
 */
export function totalAssignedInMonth(profile, month) {
  var m = profile.budgets[month];
  if (!m || !m.assigned) return 0;
  return Object.values(m.assigned).reduce(function (a, b) { return a + (b || 0); }, 0);
}

/* Per-category row at the requested month. Walks all relevant prior months
   to compute carryIn (negative balances are zeroed out at month-end). */
/**
 * Budget row for a category in a month — { carryIn, assigned, activity, available }.
 * @param {Profile} profile
 * @param {string} categoryId
 * @param {string} month YYYY-MM
 * @returns {{ carryIn: number, assigned: number, activity: number, available: number }}
 */
export function categoryRow(profile, categoryId, month) {
  var months = relevantMonths(profile, month);
  var carry = 0;
  for (var i = 0; i < months.length; i++) {
    var m = months[i];
    if (m === month) break;
    var a = assigned(profile, categoryId, m);
    var act = activity(profile, categoryId, m);
    carry = Math.max(0, carry + a + act);
  }
  var thisAssigned = assigned(profile, categoryId, month);
  var thisActivity = activity(profile, categoryId, month);
  var available = carry + thisAssigned + thisActivity;
  return {
    carryIn: carry,
    assigned: thisAssigned,
    activity: thisActivity,
    available: available,
  };
}

/* Total inflow to budget up to and including the end of `month`. */
/**
 * Sum of uncategorized positive (income) transactions through end of month.
 * @param {Profile} profile
 * @param {string} month YYYY-MM
 * @returns {number} cents
 */
export function totalInflowToBudget(profile, month) {
  var endISO = monthEnd(month);
  var sum = 0;
  profile.transactions.forEach(function (t) {
    if (t.date > endISO) return;
    if (t.transferTxnId) return;
    if (t.splits) return;
    if (t.categoryId) return;        /* user categorized = not unassigned income */
    if (t.amount > 0) sum += t.amount;
  });
  return sum;
}

/* Ready to Assign at `month`:
     inflow_through_end_of_month
   - total_assigned_through_month
   - overspending_lost_in_prior_months
*/
/**
 * Ready-to-Assign value at the start of a month (inflow minus assignments
 * minus prior-month overspending losses).
 * @param {Profile} profile
 * @param {string} month YYYY-MM
 * @returns {number} cents
 */
export function readyToAssign(profile, month) {
  var inflow = totalInflowToBudget(profile, month);
  var months = relevantMonths(profile, month);

  var totalAssigned = 0;
  months.forEach(function (m) { totalAssigned += totalAssignedInMonth(profile, m); });

  /* Overspending lost = for each on-budget category, sum across each prior
     month of max(0, -availableNetOfCarry(cat, m)).
     We track each category's rolling available in one pass. */
  var lost = 0;
  var rollingByCat = {};
  profile.categories.forEach(function (c) { rollingByCat[c.id] = 0; });

  for (var i = 0; i < months.length; i++) {
    var m = months[i];
    if (m === month) break;
    profile.categories.forEach(function (c) {
      var a = assigned(profile, c.id, m);
      var act = activity(profile, c.id, m);
      var net = rollingByCat[c.id] + a + act;
      if (net < 0) {
        lost += -net;
        rollingByCat[c.id] = 0;
      } else {
        rollingByCat[c.id] = net;
      }
    });
  }

  return inflow - totalAssigned - lost;
}

/* Quick-assign helpers for the budget UI. */
/**
 * Absolute outflow from the prior month — suggested assignment amount.
 * @param {Profile} profile
 * @param {string} categoryId
 * @param {string} month YYYY-MM (current month)
 * @returns {number} cents
 */
export function quickAssignLastMonth(profile, categoryId, month) {
  var last = prevMonth(month);
  return Math.abs(activity(profile, categoryId, last));
}

/**
 * Rounded average absolute spending across the prior n months (default 3).
 * @param {Profile} profile
 * @param {string} categoryId
 * @param {string} month YYYY-MM (current month, excluded from window)
 * @param {number} [n] window size in months
 * @returns {number} cents
 */
export function quickAssignAverageSpending(profile, categoryId, month, n) {
  var window = n || 3;
  var total = 0;
  var samples = 0;
  var cursor = month;
  for (var i = 0; i < window; i++) {
    cursor = prevMonth(cursor);
    total += Math.abs(activity(profile, categoryId, cursor));
    samples += 1;
  }
  return samples ? Math.round(total / samples) : 0;
}
