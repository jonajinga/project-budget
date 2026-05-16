/* Pure data shaping for every report.
   These functions are independent of D3 — they return plain JS data the
   chart modules turn into SVG. They're easy to test under node and easy
   to reuse in print fallbacks. */

import { activity, assigned, prevMonth, nextMonth, thisMonth, monthEnd, totalInflowToBudget } from "./budget.js";
import { runningBalance, netWorth, findAccount } from "./accounts.js";
import { findGoalForCategory, needed as goalNeeded } from "./goals.js";

/* Helpers ---------------------------------------------------------------- */

export function monthRangeBack(endMonth, count) {
  var out = [];
  var cursor = endMonth || thisMonth();
  for (var i = 0; i < count; i++) {
    out.unshift(cursor);
    cursor = prevMonth(cursor);
  }
  return out;
}

export function monthRangeForward(startMonth, count) {
  var out = [];
  var cursor = startMonth || thisMonth();
  for (var i = 0; i < count; i++) {
    out.push(cursor);
    cursor = nextMonth(cursor);
  }
  return out;
}

function endOfMonthBalance(profile, accountId, month) {
  var endISO = monthEnd(month);
  var acct = findAccount(profile, accountId);
  if (!acct) return 0;
  var sum = acct.openingBalance || 0;
  profile.transactions.forEach(function (t) {
    if (t.accountId !== accountId) return;
    if (t.date > endISO) return;
    sum += (t.amount || 0);
  });
  return sum;
}

/* Income vs Expense ------------------------------------------------------ */

export function incomeVsExpense(profile, endMonth, count) {
  var months = monthRangeBack(endMonth || thisMonth(), count || 12);
  return months.map(function (m) {
    var income = 0;
    var expense = 0;
    profile.transactions.forEach(function (t) {
      if (t.date.slice(0, 7) !== m) return;
      if (t.transferTxnId) return;
      var amt = t.amount || 0;
      if (amt > 0) income += amt;
      else expense += -amt;
    });
    return { month: m, income: income, expense: expense, net: income - expense };
  });
}

/* Net worth over time ---------------------------------------------------- */

export function netWorthByMonth(profile, endMonth, count) {
  var months = monthRangeBack(endMonth || thisMonth(), count || 12);
  return months.map(function (m) {
    var value = profile.accounts.reduce(function (sum, a) {
      if (a.closedAt && a.closedAt.slice(0, 7) < m) return sum;
      return sum + endOfMonthBalance(profile, a.id, m);
    }, 0);
    return { month: m, value: value };
  });
}

/* Spending by category --------------------------------------------------- */

export function spendingByCategory(profile, fromMonth, toMonth) {
  /* Sum negative activity per category over the month range. Skips
     transfers and credit-card payment categories (they're derived). */
  var out = {};
  profile.transactions.forEach(function (t) {
    var m = t.date.slice(0, 7);
    if (m < fromMonth || m > toMonth) return;
    if (t.transferTxnId) return;
    if (t.amount >= 0) return;
    if (t.splits) {
      t.splits.forEach(function (s) {
        if (s.amount >= 0) return;
        var key = s.categoryId || "__uncat__";
        out[key] = (out[key] || 0) + Math.abs(s.amount);
      });
    } else {
      var key = t.categoryId || "__uncat__";
      out[key] = (out[key] || 0) + Math.abs(t.amount);
    }
  });
  var rows = Object.keys(out).map(function (id) {
    var c = profile.categories.find(function (x) { return x.id === id; });
    var g = c ? profile.categoryGroups.find(function (gg) { return gg.id === c.groupId; }) : null;
    return {
      categoryId: id,
      category: c ? c.name : "Uncategorized",
      group: g ? g.name : (c ? "Ungrouped" : "Uncategorized"),
      value: out[id],
    };
  });
  rows.sort(function (a, b) { return b.value - a.value; });
  return rows;
}

/* Monthly trends --------------------------------------------------------- */

export function monthlyTrendsByCategory(profile, endMonth, count, topN) {
  var months = monthRangeBack(endMonth || thisMonth(), count || 12);
  var ranking = spendingByCategory(profile, months[0], months[months.length - 1]);
  var top = ranking.filter(function (r) { return r.categoryId !== "__uncat__"; }).slice(0, topN || 12);
  return top.map(function (r) {
    var points = months.map(function (m) {
      return { month: m, value: Math.abs(activity(profile, r.categoryId, m)) };
    });
    return { categoryId: r.categoryId, category: r.category, group: r.group, points: points, total: r.value };
  });
}

/* Debt overview ---------------------------------------------------------- */

/* For each credit and tracking-liability account, surface current balance
   (absolute), recent 3-month payment average, and a payoff projection
   based on that average. Returns rows ready for table + stacked bar. */
export function debtOverview(profile) {
  var today = new Date().toISOString().slice(0, 10);
  var currentMonth = today.slice(0, 7);
  var lookback = monthRangeBack(currentMonth, 3);

  return profile.accounts
    .filter(function (a) { return !a.closedAt && (a.type === "credit" || a.type === "tracking-liability"); })
    .map(function (a) {
      var balance = runningBalance(profile, a.id);
      var owed = Math.abs(Math.min(0, balance));
      /* Payments = positive amounts on the liability account (incoming
         transfers or manual paydowns). */
      var totalPayments = 0;
      profile.transactions.forEach(function (t) {
        if (t.accountId !== a.id) return;
        var m = t.date.slice(0, 7);
        if (lookback.indexOf(m) === -1) return;
        if (t.amount > 0) totalPayments += t.amount;
      });
      var avgPayment = lookback.length ? Math.round(totalPayments / lookback.length) : 0;
      var monthsToPayoff = avgPayment > 0 ? Math.ceil(owed / avgPayment) : null;
      return {
        accountId: a.id,
        account: a.name,
        type: a.type,
        balance: owed,
        avgPayment: avgPayment,
        monthsToPayoff: monthsToPayoff,
      };
    })
    .sort(function (a, b) { return b.balance - a.balance; });
}

/* Assignment history ----------------------------------------------------- */

/* Per-category: assigned + spent (absolute activity) per month over the
   window. UI renders it as a small table or stacked bar pair. */
export function assignmentHistory(profile, endMonth, count, topN) {
  var months = monthRangeBack(endMonth || thisMonth(), count || 12);
  var ranking = spendingByCategory(profile, months[0], months[months.length - 1]);
  var top = ranking.filter(function (r) { return r.categoryId !== "__uncat__"; }).slice(0, topN || 8);
  return top.map(function (r) {
    var points = months.map(function (m) {
      var a = assigned(profile, r.categoryId, m);
      var act = Math.abs(activity(profile, r.categoryId, m));
      return { month: m, assigned: a, spent: act, delta: a - act };
    });
    return { categoryId: r.categoryId, category: r.category, group: r.group, points: points };
  });
}

/* Cashflow projection ---------------------------------------------------- */

/* Forward N months. Starting balance = current sum of on-budget account
   balances. For each future month, subtract scheduled outflows and goal
   needs; add scheduled inflows. The low band = scheduled only; the high
   band = scheduled + average discretionary spending baseline of zero
   (since discretionary is hard to predict without categories analysis).
   v1 keeps the band tight; later phases can compute it from history. */
export function projection(profile, count) {
  var months = monthRangeForward(thisMonth(), (count || 12) + 1);
  var startBalance = profile.accounts
    .filter(function (a) { return !a.closedAt && a.onBudget; })
    .reduce(function (sum, a) { return sum + runningBalance(profile, a.id); }, 0);

  /* Per-month net of scheduled inflows minus scheduled outflows. */
  var perMonthScheduled = months.slice(1).map(function (m) {
    var net = 0;
    profile.scheduled.forEach(function (s) {
      if (!s.template || !s.template.amount) return;
      var nextMonth = s.nextDate.slice(0, 7);
      if (nextMonth <= m) {
        /* Approximate occurrences in `m` based on frequency. */
        var occurrences = occurrencesIn(m, s);
        net += occurrences * s.template.amount;
      }
    });
    return net;
  });

  /* Goal funding requirement per month: sum of needed() per category. */
  var goalNeeds = months.slice(1).map(function (m) {
    var sum = 0;
    profile.goals.forEach(function (g) {
      sum += goalNeeded(profile, g, m);
    });
    return sum;
  });

  var bal = startBalance;
  var out = [{ month: months[0], expected: startBalance, low: startBalance, high: startBalance }];
  for (var i = 0; i < perMonthScheduled.length; i++) {
    bal += perMonthScheduled[i];
    var month = months[i + 1];
    /* High band: scheduled-only (best case).
       Low band: scheduled minus goal funding needed (worst sustainable). */
    out.push({
      month: month,
      expected: bal,
      high: bal,
      low: bal - goalNeeds[i],
    });
  }
  return out;
}

function occurrencesIn(month, schedule) {
  /* For monthly+yearly schedules: 1 if the next due date falls within
     `month` or earlier (treated as occurring once that month). For weekly:
     ~4. For biweekly: ~2. For daily: ~30. Good enough for projection. */
  switch (schedule.frequency) {
    case "daily":    return 30;
    case "weekly":   return 4;
    case "biweekly": return 2;
    case "yearly":   return (schedule.nextDate.slice(0, 7) === month) ? 1 : 0;
    case "monthly":
    default:         return 1;
  }
}
