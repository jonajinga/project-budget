/* Recurring transactions. A ScheduledTxn carries a template (a partial
   Transaction shape) and a frequency. On app boot we surface anything
   whose nextDate <= today as "due"; the user reviews and approves each. */

import { newScheduledTxn, newTransaction } from "../store/schema.js";

export const FREQUENCIES = [
  { value: "daily",     label: "Daily" },
  { value: "weekly",    label: "Weekly" },
  { value: "biweekly",  label: "Every two weeks" },
  { value: "monthly",   label: "Monthly" },
  { value: "yearly",    label: "Yearly" },
];

function isoDate(d) { return d.toISOString().slice(0, 10); }

function parseISO(s) {
  /* Avoid timezone offset surprises: parse YYYY-MM-DD as local-midnight. */
  var parts = (s || "").split("-").map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

export function advance(dateISO, frequency) {
  var d = parseISO(dateISO);
  switch (frequency) {
    case "daily":    d.setDate(d.getDate() + 1); break;
    case "weekly":   d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly":  d.setMonth(d.getMonth() + 1); break;
    case "yearly":   d.setFullYear(d.getFullYear() + 1); break;
    default:         d.setMonth(d.getMonth() + 1);
  }
  return isoDate(d);
}

export function addSchedule(profile, opts) {
  var s = newScheduledTxn(opts);
  profile.scheduled.push(s);
  return s;
}

export function removeSchedule(profile, id) {
  profile.scheduled = profile.scheduled.filter(function (s) { return s.id !== id; });
}

/* Returns the list of due-today (or overdue) scheduled transactions for
   the user to approve. Does NOT post anything. */
export function dueTransactions(profile, today) {
  var todayISO = today || isoDate(new Date());
  return profile.scheduled.filter(function (s) { return s.nextDate <= todayISO; });
}

/* Approve a scheduled txn: post a real transaction from its template,
   then advance nextDate by the frequency. */
export function postScheduled(profile, scheduledId, overrides) {
  var s = profile.scheduled.find(function (x) { return x.id === scheduledId; });
  if (!s) return null;
  var tpl = s.template || {};
  var t = newTransaction({
    accountId: overrides?.accountId ?? tpl.accountId,
    date: overrides?.date ?? s.nextDate,
    payeeId: overrides?.payeeId ?? tpl.payeeId ?? null,
    categoryId: overrides?.categoryId ?? tpl.categoryId ?? null,
    amount: overrides?.amount ?? tpl.amount ?? 0,
    memo: overrides?.memo ?? tpl.memo ?? "",
    scheduledId: s.id,
  });
  profile.transactions.push(t);
  s.lastRun = t.date;
  s.nextDate = advance(s.nextDate, s.frequency);
  return t;
}

/* Skip the next occurrence — advance nextDate without posting. */
export function skipScheduled(profile, scheduledId) {
  var s = profile.scheduled.find(function (x) { return x.id === scheduledId; });
  if (!s) return null;
  s.nextDate = advance(s.nextDate, s.frequency);
  return s;
}
