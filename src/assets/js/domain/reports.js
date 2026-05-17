/* Pure data shaping for every report.
   These functions are independent of D3 — they return plain JS data the
   chart modules turn into SVG. They're easy to test under node and easy
   to reuse in print fallbacks. */

import { activity, assigned, prevMonth, nextMonth, thisMonth, monthEnd, totalInflowToBudget } from "./budget.js";
import { runningBalance, netWorth, findAccount } from "./accounts.js";
import { findGoalForCategory, needed as goalNeeded } from "./goals.js";

/* Helpers ---------------------------------------------------------------- */

/**
 * Ascending list of `count` months ending at endMonth.
 * @param {string} endMonth YYYY-MM
 * @param {number} count
 * @returns {Array<string>} YYYY-MM, oldest first
 */
export function monthRangeBack(endMonth, count) {
  var out = [];
  var cursor = endMonth || thisMonth();
  for (var i = 0; i < count; i++) {
    out.unshift(cursor);
    cursor = prevMonth(cursor);
  }
  return out;
}

/**
 * Ascending list of `count` months starting at startMonth.
 * @param {string} startMonth YYYY-MM
 * @param {number} count
 * @returns {Array<string>} YYYY-MM
 */
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

/**
 * Per-month income, expense, and net totals across the last `count` months.
 * @param {Profile} profile
 * @param {string} endMonth YYYY-MM
 * @param {number} [count] default 12
 * @returns {Array<{ month: string, income: number, expense: number, net: number }>}
 */
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

/**
 * End-of-month net worth across the last `count` months.
 * @param {Profile} profile
 * @param {string} endMonth YYYY-MM
 * @param {number} [count] default 12
 * @returns {Array<{ month: string, value: number }>}
 */
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

/**
 * Total spending per category over a month range, sorted descending.
 * Skips transfers; uncategorized rolls into "__uncat__".
 * @param {Profile} profile
 * @param {string} fromMonth YYYY-MM
 * @param {string} toMonth YYYY-MM
 * @returns {Array<{ categoryId: string, category: string, group: string, value: number }>}
 */
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

/**
 * Top-N spending categories with per-month spend points across the window.
 * @param {Profile} profile
 * @param {string} endMonth YYYY-MM
 * @param {number} [count] window size (default 12)
 * @param {number} [topN] default 12
 * @returns {Array<{ categoryId: string, category: string, group: string, points: Array<{ month: string, value: number }>, total: number }>}
 */
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
/**
 * Per-debt-account snapshot with 3-month average payment + payoff projection.
 * @param {Profile} profile
 * @returns {Array<{ accountId: string, account: string, type: string, balance: number, avgPayment: number, monthsToPayoff: number|null }>}
 */
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
/**
 * Per-month assigned vs spent for top-N categories over the window.
 * @param {Profile} profile
 * @param {string} endMonth YYYY-MM
 * @param {number} [count] default 12
 * @param {number} [topN] default 8
 * @returns {Array<{ categoryId: string, category: string, group: string, points: Array<{ month: string, assigned: number, spent: number, delta: number }> }>}
 */
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
/**
 * On-budget cashflow projection forward `count` months from today, with
 * expected/high/low bands derived from scheduled txns and goal needs.
 * @param {Profile} profile
 * @param {number} [count] months forward (default 12)
 * @returns {Array<{ month: string, expected: number, low: number, high: number }>}
 */
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

/* Savings rate ----------------------------------------------------------- */

/* Per-month savings rate = (income - expense) / income. NaN-safe (returns
   null when income is 0 so the chart can skip that point). Carries the
   underlying numbers so the table can show them alongside the rate. */
/**
 * Per-month savings rate (savings / income). `rate` is null when income is 0.
 * @param {Profile} profile
 * @param {string} endMonth YYYY-MM
 * @param {number} [count] default 12
 * @returns {Array<{ month: string, income: number, expense: number, savings: number, rate: number|null }>}
 */
export function savingsRate(profile, endMonth, count) {
  var rows = incomeVsExpense(profile, endMonth, count);
  return rows.map(function (r) {
    var savings = r.income - r.expense;
    var rate = r.income > 0 ? savings / r.income : null;
    return { month: r.month, income: r.income, expense: r.expense, savings: savings, rate: rate };
  });
}

/* Payee leaderboard ------------------------------------------------------- */

/* Top N payees by absolute outflow over [fromMonth, toMonth]. Returns
   one row per payee with usage count, total spend, average per
   transaction, and last-used date so the table can rank merchants
   the same way YNAB / Mint do. */
/**
 * Top payees ranked by outflow over a month range.
 * @param {Profile} profile
 * @param {string} [fromMonth] YYYY-MM (open lower bound when omitted)
 * @param {string} [toMonth] YYYY-MM (open upper bound when omitted)
 * @param {number} [limit] default 25
 * @returns {Array<{ payeeId: string, payee: string, total: number, count: number, avg: number, lastDate: string }>}
 */
export function payeeLeaderboard(profile, fromMonth, toMonth, limit) {
  var n = limit || 25;
  var bucket = {};
  profile.transactions.forEach(function (t) {
    if (t.transferTxnId) return;
    if (!t.payeeId) return;
    if (t.amount >= 0) return;
    var m = t.date.slice(0, 7);
    if (fromMonth && m < fromMonth) return;
    if (toMonth   && m > toMonth)   return;
    var b = bucket[t.payeeId] || (bucket[t.payeeId] = {
      payeeId: t.payeeId,
      total: 0,
      count: 0,
      lastDate: "",
    });
    b.total += Math.abs(t.amount || 0);
    b.count += 1;
    if (t.date > b.lastDate) b.lastDate = t.date;
  });
  var rows = Object.keys(bucket).map(function (id) {
    var b = bucket[id];
    var p = (profile.payees || []).find(function (x) { return x.id === id; });
    return {
      payeeId: id,
      payee: p ? p.name : "(unknown)",
      total: b.total,
      count: b.count,
      avg: b.count ? Math.round(b.total / b.count) : 0,
      lastDate: b.lastDate,
    };
  });
  rows.sort(function (a, b) { return b.total - a.total; });
  return rows.slice(0, n);
}

/* Budget vs Actual -------------------------------------------------------- */

/* For a given month, per-category snapshot: assigned, spent (absolute),
   remaining, and a status flag (under / at / over). Drives the
   envelope-health dashboard. Skips internal payment categories. */
/**
 * Per-category snapshot of assigned / spent / remaining for a month, sorted
 * with attention-needing rows first. Skips payment categories.
 * @param {Profile} profile
 * @param {string} [month] YYYY-MM (defaults to current month)
 * @returns {Array<{ categoryId: string, category: string, group: string, assigned: number, spent: number, remaining: number, pct: number, status: ('over'|'unbudgeted'|'at'|'under') }>}
 */
export function budgetVsActual(profile, month) {
  var m = month || thisMonth();
  return profile.categories
    .filter(function (c) { return !c.isPaymentCategory; })
    .map(function (c) {
      var g = profile.categoryGroups.find(function (gg) { return gg.id === c.groupId; });
      var a = assigned(profile, c.id, m);
      var spent = Math.abs(Math.min(0, activity(profile, c.id, m)));
      var remaining = a - spent;
      var pct = a > 0 ? Math.min(999, Math.round((spent / a) * 100)) : (spent > 0 ? 999 : 0);
      var status = "under";
      if (a > 0 && spent > a) status = "over";
      else if (a > 0 && spent === a) status = "at";
      else if (a === 0 && spent > 0) status = "unbudgeted";
      return {
        categoryId: c.id,
        category: c.name,
        group: g ? g.name : "Ungrouped",
        assigned: a,
        spent: spent,
        remaining: remaining,
        pct: pct,
        status: status,
      };
    })
    .sort(function (a, b) {
      /* Over-budget first, then unbudgeted spend, then by spent
         descending so the table leads with what needs attention. */
      var rank = { over: 0, unbudgeted: 1, at: 2, under: 3 };
      var dr = (rank[a.status] || 9) - (rank[b.status] || 9);
      if (dr !== 0) return dr;
      return b.spent - a.spent;
    });
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

/* Cash-flow Sankey ------------------------------------------------------- */

/* Build { nodes, links } for the D3 sankey diagram. Three node columns:
   income sources (positive non-transfer txns by category, fallback
   "Uncategorized income"), spending categories (negative txns by
   category), and savings/debt-payoff buckets (transfers to savings
   accounts or any credit-card payment category). Edge values are
   absolute dollars; sankey doesn't render negatives.

   Currently produces a single time slice — fromMonth/toMonth bound the
   transactions considered. The renderer + page can re-call for new
   ranges. */
/**
 * Sankey-ready { nodes, links } for income -> Cash Flow pivot -> spending.
 * Link values are in dollars (not cents).
 * @param {Profile} profile
 * @param {string} [fromMonth] YYYY-MM
 * @param {string} [toMonth] YYYY-MM
 * @returns {{ nodes: Array<{ name: string }>, links: Array<{ source: number, target: number, value: number }> }}
 */
export function sankeyFlows(profile, fromMonth, toMonth) {
  var from = (fromMonth || thisMonth()) + "-01";
  var to   = monthEnd(toMonth || fromMonth || thisMonth());
  var nodes = [];
  var nodeIndex = {};
  function node(name) {
    if (nodeIndex[name] !== undefined) return nodeIndex[name];
    var i = nodes.length;
    nodes.push({ name: name });
    nodeIndex[name] = i;
    return i;
  }
  /* Pre-create the central pivot node so income → pivot → spending
     reads as a clear cash-flow story when no payments / savings
     transfers exist in the range. */
  var pivotIdx = node("Cash flow");

  var links = [];
  var categoryById = {};
  (profile.categories || []).forEach(function (c) { categoryById[c.id] = c; });

  (profile.transactions || []).forEach(function (t) {
    if (!t || !t.date) return;
    if (t.date < from || t.date > to) return;
    var amt = t.amount || 0;
    if (amt === 0) return;
    var cat = t.categoryId ? categoryById[t.categoryId] : null;
    if (t.transferTxnId) {
      /* Transfers: model as a flow from pivot → destination account.
         Only the outflow leg (negative amount) is rendered so we
         don't double-count both halves of the same transfer pair. */
      if (amt > 0) return;
      var destTxn = (profile.transactions || []).find(function (x) { return x.id === t.transferTxnId; });
      var destAcct = destTxn ? findAccount(profile, destTxn.accountId) : null;
      if (!destAcct) return;
      var transferName = "Transfer → " + destAcct.name;
      links.push({ source: pivotIdx, target: node(transferName), value: Math.abs(amt) / 100 });
      return;
    }
    if (amt > 0) {
      /* Income: payee → pivot. Group by category if set, else
         "Uncategorized income". */
      var srcName = cat ? cat.name : "Uncategorized income";
      links.push({ source: node(srcName), target: pivotIdx, value: amt / 100 });
    } else {
      /* Spending: pivot → category. Skip credit-card payment
         categories because they're not "spending" — they're a
         transfer to the debt account. */
      if (cat && cat.isPaymentCategory) return;
      var sinkName = cat ? cat.name : "Uncategorized spending";
      links.push({ source: pivotIdx, target: node(sinkName), value: Math.abs(amt) / 100 });
    }
  });

  /* Collapse duplicate links: same source+target consolidates into
     one fatter link. The sankey layout handles overlapping links
     poorly, so this both looks cleaner and reads more honestly. */
  var collapsed = {};
  links.forEach(function (l) {
    var key = l.source + ">" + l.target;
    if (!collapsed[key]) collapsed[key] = { source: l.source, target: l.target, value: 0 };
    collapsed[key].value += l.value;
  });
  var finalLinks = Object.keys(collapsed).map(function (k) { return collapsed[k]; });

  return { nodes: nodes, links: finalLinks };
}

/* Category heatmap ------------------------------------------------------- */

/* Top-N spending categories × month grid. Returns:
     {
       months: [YYYY-MM, ...],
       categories: [{ categoryId, category, group, total }, ...],
       cells: { categoryId: { month: value } },
       max: <max cell value across the grid>,
     }
   The renderer uses `max` to scale the sequential color ramp so the
   busiest cells hit full saturation and quiet cells stay light. */
/**
 * Heatmap grid of spending: top categories x months, plus `max` for color scaling.
 * @param {Profile} profile
 * @param {string} endMonth YYYY-MM
 * @param {number} [monthCount] default 12
 * @param {number} [topN] default 15
 * @returns {{ months: Array<string>, categories: Array<object>, cells: Object<string, Object<string, number>>, max: number }}
 */
export function categoryHeatmap(profile, endMonth, monthCount, topN) {
  var months = monthRangeBack(endMonth || thisMonth(), monthCount || 12);
  var byCat = {};
  var nameByCat = {};
  var groupByCat = {};
  /* Pre-index groups by id so we can resolve each category's group
     name in O(1) instead of an O(G) find per category. The previous
     implementation walked profile.categoryGroups expecting a
     `.categories` array on each group — but the schema models the
     relationship the other way (category.groupId). The lookup was
     reading undefined, so every row's `group` field came back as ""
     and the heatmap's group column appeared blank. */
  var groupNameById = {};
  (profile.categoryGroups || []).forEach(function (g) {
    groupNameById[g.id] = g.name;
  });
  (profile.categories || []).forEach(function (c) {
    nameByCat[c.id] = c.name;
    if (c.groupId && groupNameById[c.groupId]) {
      groupByCat[c.id] = groupNameById[c.groupId];
    }
  });
  (profile.transactions || []).forEach(function (t) {
    if (!t || !t.date) return;
    var m = t.date.slice(0, 7);
    if (months.indexOf(m) === -1) return;
    var amt = t.amount || 0;
    if (amt >= 0) return;
    if (t.transferTxnId) return;
    var cid = t.categoryId || "__uncat";
    if (!byCat[cid]) byCat[cid] = { total: 0, cells: {} };
    var v = Math.abs(amt);
    byCat[cid].total += v;
    byCat[cid].cells[m] = (byCat[cid].cells[m] || 0) + v;
  });
  var rows = Object.keys(byCat).map(function (cid) {
    return {
      categoryId: cid,
      category: nameByCat[cid] || (cid === "__uncat" ? "Uncategorized" : "Unknown"),
      group: groupByCat[cid] || "",
      total: byCat[cid].total,
      cells: byCat[cid].cells,
    };
  }).sort(function (a, b) { return b.total - a.total; });
  var top = rows.slice(0, topN || 15);
  var max = 0;
  top.forEach(function (r) {
    months.forEach(function (m) {
      var v = r.cells[m] || 0;
      if (v > max) max = v;
    });
  });
  var cellsOut = {};
  top.forEach(function (r) { cellsOut[r.categoryId] = r.cells; });
  return { months: months, categories: top, cells: cellsOut, max: max };
}

/* Year-over-year --------------------------------------------------------- */

/* Compare two date ranges. By default: current = last 12 months,
   prior = the preceding 12 months. Returns per-month, per-category,
   per-payee paired totals + KPI deltas. Each range is { from, to }
   in YYYY-MM. */
/**
 * Compares two month ranges. Each range is { from, to } in YYYY-MM. Returns
 * aggregated totals, paired-by-index month rows, top movers, and KPI deltas.
 * @param {Profile} profile
 * @param {{ from: string, to: string }} currentRange
 * @param {{ from: string, to: string }} priorRange
 * @returns {object}
 */
export function yearOverYear(profile, currentRange, priorRange) {
  function bucket(range) {
    var months = [];
    var cursor = range.from;
    while (cursor <= range.to) {
      months.push(cursor);
      cursor = nextMonth(cursor);
    }
    return months;
  }
  function aggregate(months) {
    var byMonth = {};
    var byCategory = {};
    var byPayee = {};
    var totalIncome = 0, totalExpense = 0;
    months.forEach(function (m) { byMonth[m] = { income: 0, expense: 0 }; });
    var catName = {}; (profile.categories || []).forEach(function (c) { catName[c.id] = c.name; });
    var payeeName = {}; (profile.payees || []).forEach(function (p) { payeeName[p.id] = p.name; });
    (profile.transactions || []).forEach(function (t) {
      if (!t || !t.date) return;
      var m = t.date.slice(0, 7);
      if (months.indexOf(m) === -1) return;
      if (t.transferTxnId) return;
      var amt = t.amount || 0;
      if (amt > 0) { totalIncome += amt; byMonth[m].income += amt; }
      else         { totalExpense += -amt; byMonth[m].expense += -amt; }
      if (amt < 0) {
        var cid = t.categoryId || "__uncat";
        var pid = t.payeeId || "__unpayee";
        byCategory[cid] = (byCategory[cid] || 0) + -amt;
        byPayee[pid] = (byPayee[pid] || 0) + -amt;
      }
    });
    return {
      months: months,
      byMonth: byMonth,
      byCategory: byCategory,
      byPayee: byPayee,
      catName: catName,
      payeeName: payeeName,
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      net: totalIncome - totalExpense,
      savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) : null,
    };
  }
  var current = aggregate(bucket(currentRange));
  var prior   = aggregate(bucket(priorRange));

  /* Build paired-by-month rows aligned by their relative month index
     (month 1 of current vs month 1 of prior, etc.) so the chart
     compares chronological position rather than calendar date. */
  var paired = [];
  var maxLen = Math.max(current.months.length, prior.months.length);
  for (var i = 0; i < maxLen; i++) {
    var cm = current.months[i] || null;
    var pm = prior.months[i] || null;
    paired.push({
      index: i + 1,
      currentMonth: cm,
      priorMonth: pm,
      currentIncome:  cm ? current.byMonth[cm].income  : 0,
      currentExpense: cm ? current.byMonth[cm].expense : 0,
      priorIncome:    pm ? prior.byMonth[pm].income    : 0,
      priorExpense:   pm ? prior.byMonth[pm].expense   : 0,
    });
  }

  /* Top movers — categories with the biggest expense delta between
     ranges (positive = current spent more, negative = current spent
     less). Used for the "Biggest swing" KPI + the by-category tab. */
  var allCats = {};
  Object.keys(current.byCategory).forEach(function (k) { allCats[k] = true; });
  Object.keys(prior.byCategory).forEach(function (k) { allCats[k] = true; });
  var categoryRows = Object.keys(allCats).map(function (cid) {
    var cur = current.byCategory[cid] || 0;
    var pri = prior.byCategory[cid]   || 0;
    return {
      categoryId: cid,
      category: current.catName[cid] || prior.catName[cid] || (cid === "__uncat" ? "Uncategorized" : "Unknown"),
      current: cur,
      prior: pri,
      delta: cur - pri,
    };
  }).sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });

  var allPayees = {};
  Object.keys(current.byPayee).forEach(function (k) { allPayees[k] = true; });
  Object.keys(prior.byPayee).forEach(function (k) { allPayees[k] = true; });
  var payeeRows = Object.keys(allPayees).map(function (pid) {
    var cur = current.byPayee[pid] || 0;
    var pri = prior.byPayee[pid]   || 0;
    return {
      payeeId: pid,
      payee: current.payeeName[pid] || prior.payeeName[pid] || (pid === "__unpayee" ? "No payee" : "Unknown"),
      current: cur,
      prior: pri,
      delta: cur - pri,
    };
  }).sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); }).slice(0, 20);

  return {
    current: current,
    prior: prior,
    paired: paired,
    categoryRows: categoryRows,
    payeeRows: payeeRows,
    deltas: {
      income: current.totalIncome - prior.totalIncome,
      expense: current.totalExpense - prior.totalExpense,
      net: current.net - prior.net,
      savingsRate: (current.savingsRate !== null && prior.savingsRate !== null)
        ? (current.savingsRate - prior.savingsRate) : null,
      biggestSwing: categoryRows[0] || null,
    },
  };
}

/* Subscription audit ----------------------------------------------------- */

/* Walk the last N months looking for cadence patterns: same payee +
   approximately the same amount (within ±5%) charged repeatedly
   within ±3 days of a monthly/weekly/yearly anchor. Returns:
     [
       { payee, typicalAmount, cadence, occurrences, annualCost,
         lastCharge, lastChargeAccountId },
       ...
     ]
   sorted by annualCost desc. Pure function — no UI / dates assumed
   except for the lookback window. */
/**
 * Detects subscription-like charges (stable amount + cadence) from history.
 * Cadence is one of Monthly / Weekly / Biweekly / Quarterly / Yearly.
 * @param {Profile} profile
 * @param {number} [lookbackMonths] default 12
 * @returns {Array<{ payeeId: string, payee: string, typicalAmount: number, cadence: string, occurrences: number, annualCost: number, lastCharge: string, lastChargeAccountId: string }>}
 */
export function detectSubscriptions(profile, lookbackMonths) {
  var monthsBack = lookbackMonths || 12;
  var cutoffMonth = thisMonth();
  for (var i = 0; i < monthsBack; i++) cutoffMonth = prevMonth(cutoffMonth);
  var cutoffISO = cutoffMonth + "-01";
  var payeeName = {};
  (profile.payees || []).forEach(function (p) { payeeName[p.id] = p.name; });

  /* Group spending transactions by payeeId. Skip transfers, splits,
     and positive amounts. */
  var groups = {};
  (profile.transactions || []).forEach(function (t) {
    if (!t || !t.date) return;
    if (t.date < cutoffISO) return;
    if (t.transferTxnId) return;
    if (t.splits) return;
    var amt = t.amount || 0;
    if (amt >= 0) return;
    var pid = t.payeeId || "__unpayee";
    if (!groups[pid]) groups[pid] = [];
    groups[pid].push({ date: t.date, amount: Math.abs(amt), accountId: t.accountId });
  });

  function median(arr) {
    if (!arr.length) return 0;
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  function daysBetween(a, b) {
    var d1 = new Date(a + "T00:00:00Z").getTime();
    var d2 = new Date(b + "T00:00:00Z").getTime();
    return Math.round(Math.abs(d2 - d1) / 86400000);
  }

  var subscriptions = [];
  Object.keys(groups).forEach(function (pid) {
    var txns = groups[pid].sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (txns.length < 3) return; /* need ≥3 charges to detect a cadence */
    var amounts = txns.map(function (t) { return t.amount; });
    var med = median(amounts);
    /* Pricey-burrito false-positive guard: require amount stability
       (max-min within 25% of the median) before calling it a sub. */
    var lo = Math.min.apply(null, amounts);
    var hi = Math.max.apply(null, amounts);
    if (med === 0 || (hi - lo) / med > 0.25) return;
    /* Compute intervals between consecutive charges. */
    var intervals = [];
    for (var i = 1; i < txns.length; i++) intervals.push(daysBetween(txns[i - 1].date, txns[i].date));
    var medInterval = median(intervals);
    var cadence = null;
    var annualMultiplier = 0;
    if (medInterval >= 27 && medInterval <= 33)       { cadence = "Monthly";   annualMultiplier = 12; }
    else if (medInterval >= 6  && medInterval <= 8)   { cadence = "Weekly";    annualMultiplier = 52; }
    else if (medInterval >= 13 && medInterval <= 15)  { cadence = "Biweekly";  annualMultiplier = 26; }
    else if (medInterval >= 88 && medInterval <= 95)  { cadence = "Quarterly"; annualMultiplier = 4; }
    else if (medInterval >= 360 && medInterval <= 370){ cadence = "Yearly";    annualMultiplier = 1; }
    if (!cadence) return;
    var last = txns[txns.length - 1];
    subscriptions.push({
      payeeId: pid,
      payee: payeeName[pid] || (pid === "__unpayee" ? "(no payee)" : "Unknown"),
      typicalAmount: med,
      cadence: cadence,
      occurrences: txns.length,
      annualCost: med * annualMultiplier,
      lastCharge: last.date,
      lastChargeAccountId: last.accountId,
    });
  });

  return subscriptions.sort(function (a, b) { return b.annualCost - a.annualCost; });
}
