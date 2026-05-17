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
  { value: "custom",    label: "Custom…" },
];

export const CUSTOM_UNITS = [
  { value: "days",   label: "days"   },
  { value: "weeks",  label: "weeks"  },
  { value: "months", label: "months" },
  { value: "years",  label: "years"  },
];

function isoDate(d) { return d.toISOString().slice(0, 10); }

function parseISO(s) {
  /* Avoid timezone offset surprises: parse YYYY-MM-DD as local-midnight. */
  var parts = (s || "").split("-").map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

/* Accepts either the preset frequency string OR the full sched object
   (so custom intervals can pull customInterval/customUnit). The legacy
   string form remains supported so older callers / data don't break. */
/**
 * Returns the next-occurrence date by advancing once per frequency. Accepts
 * either a preset string ("daily" | "weekly" | "biweekly" | "monthly" |
 * "yearly" | "custom") or the full schedule object (custom needs customInterval/customUnit).
 * @param {string} dateISO YYYY-MM-DD
 * @param {string|object} freqOrSched
 * @returns {string} YYYY-MM-DD
 */
export function advance(dateISO, freqOrSched) {
  var d = parseISO(dateISO);
  var freq = (typeof freqOrSched === "string") ? freqOrSched : (freqOrSched && freqOrSched.frequency);
  switch (freq) {
    case "daily":    d.setDate(d.getDate() + 1); break;
    case "weekly":   d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly":  d.setMonth(d.getMonth() + 1); break;
    case "yearly":   d.setFullYear(d.getFullYear() + 1); break;
    case "custom": {
      var n = Math.max(1, Math.round((freqOrSched && freqOrSched.customInterval) || 1));
      var u = (freqOrSched && freqOrSched.customUnit) || "months";
      switch (u) {
        case "days":   d.setDate(d.getDate() + n); break;
        case "weeks":  d.setDate(d.getDate() + 7 * n); break;
        case "months": d.setMonth(d.getMonth() + n); break;
        case "years":  d.setFullYear(d.getFullYear() + n); break;
        default:       d.setMonth(d.getMonth() + n);
      }
      break;
    }
    default:         d.setMonth(d.getMonth() + 1);
  }
  return isoDate(d);
}

/* Human-readable label for any frequency including custom. */
/**
 * Human-readable cadence label (handles "custom" via customInterval/customUnit).
 * @param {object} s schedule object
 * @returns {string}
 */
export function frequencyLabel(s) {
  if (!s) return "";
  if (s.frequency === "custom") {
    var n = Math.max(1, Math.round(s.customInterval || 1));
    var u = s.customUnit || "months";
    if (n === 1) {
      var singular = { days: "day", weeks: "week", months: "month", years: "year" }[u] || u;
      return "Every " + singular;
    }
    return "Every " + n + " " + u;
  }
  var preset = FREQUENCIES.find(function (f) { return f.value === s.frequency; });
  return preset ? preset.label : (s.frequency || "");
}

/**
 * Adds a scheduled txn. Mutates profile in place.
 * @param {Profile} profile
 * @param {object} opts - { template, frequency, nextDate, customInterval?, customUnit? }
 * @returns {object} the new schedule
 */
export function addSchedule(profile, opts) {
  var s = newScheduledTxn(opts);
  profile.scheduled.push(s);
  return s;
}

/**
 * Removes a schedule by id. Mutates profile in place.
 * @param {Profile} profile
 * @param {string} id
 */
export function removeSchedule(profile, id) {
  profile.scheduled = profile.scheduled.filter(function (s) { return s.id !== id; });
}

/* Edit an existing schedule in place. `patch` may carry any of:
   template (full object replacement), frequency, customInterval,
   customUnit, nextDate, lastRun. Returns the updated record. */
/**
 * Updates a schedule in place. Patch keys: { template, frequency,
 * customInterval, customUnit, nextDate, lastRun }.
 * @param {Profile} profile
 * @param {string} id
 * @param {object} patch
 * @returns {object|null}
 */
export function updateSchedule(profile, id, patch) {
  var s = profile.scheduled.find(function (x) { return x.id === id; });
  if (!s || !patch) return null;
  if (patch.template !== undefined) s.template = patch.template;
  if (patch.frequency !== undefined) s.frequency = patch.frequency;
  if (patch.customInterval !== undefined) s.customInterval = patch.customInterval;
  if (patch.customUnit !== undefined) s.customUnit = patch.customUnit;
  if (patch.nextDate !== undefined) s.nextDate = patch.nextDate;
  if (patch.lastRun !== undefined) s.lastRun = patch.lastRun;
  return s;
}

/* Returns the list of due-today (or overdue) scheduled transactions for
   the user to approve. Does NOT post anything. Paused templates are
   excluded — they keep their nextDate but don't show up in the queue. */
/**
 * Scheduled txns whose nextDate is on or before `today`. Paused templates
 * are skipped. Read-only — does not post anything.
 * @param {Profile} profile
 * @param {string} [today] YYYY-MM-DD (defaults to today)
 * @returns {Array<object>}
 */
export function dueTransactions(profile, today) {
  var todayISO = today || isoDate(new Date());
  return profile.scheduled.filter(function (s) {
    if (s.paused) return false;
    return s.nextDate <= todayISO;
  });
}

/* Approve a scheduled txn: post a real transaction from its template,
   then advance nextDate by the frequency. */
/**
 * Posts a real transaction from a schedule's template and advances nextDate.
 * Mutates profile in place.
 * @param {Profile} profile
 * @param {string} scheduledId
 * @param {object} [overrides] - { accountId, date, payeeId, categoryId, amount, memo }
 * @returns {object|null} the posted transaction
 */
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
  s.nextDate = advance(s.nextDate, s);
  return t;
}

/* Walk a schedule forward from its nextDate and return every occurrence
   (as YYYY-MM-DD strings) that falls within [startISO, endISO] inclusive.
   Used by the calendar to project recurring transactions into future
   months without modifying the schedule. The 400-iteration guard caps
   runaway loops if a malformed schedule advances by less than a day. */
/**
 * Projects every occurrence of a schedule that falls within [startISO, endISO]
 * inclusive. Pure — never modifies the schedule. Paused schedules return [].
 * @param {object} sched
 * @param {string} startISO YYYY-MM-DD
 * @param {string} endISO YYYY-MM-DD
 * @returns {Array<string>} YYYY-MM-DD list
 */
export function occurrencesIn(sched, startISO, endISO) {
  var out = [];
  if (!sched || !sched.nextDate) return out;
  /* Paused templates produce no projected occurrences — calendar dots
     and "upcoming bills" widgets stay clean while the template is
     suspended. */
  if (sched.paused) return out;
  var cur = sched.nextDate.slice(0, 10);
  var guard = 400;
  while (cur && cur <= endISO && guard-- > 0) {
    if (cur >= startISO) out.push(cur);
    var nxt = advance(cur, sched);
    if (!nxt || nxt === cur) break;
    cur = nxt;
  }
  return out;
}

/* Skip the next occurrence — advance nextDate without posting. */
/**
 * Advances nextDate without posting a transaction. Mutates profile in place.
 * @param {Profile} profile
 * @param {string} scheduledId
 * @returns {object|null} the updated schedule
 */
export function skipScheduled(profile, scheduledId) {
  var s = profile.scheduled.find(function (x) { return x.id === scheduledId; });
  if (!s) return null;
  s.nextDate = advance(s.nextDate, s);
  return s;
}
