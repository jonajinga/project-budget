/* Shift every date in the bundled sample forward so it reads as "now".

   The sample is generated against a fixed anchor date (settings.sampleAnchor)
   so regeneration is deterministic. When it is loaded, every date moves
   forward by the whole number of months between the anchor and today.
   Whole months, not days: paydays stay on the 1st and 15th, the mortgage
   stays on the 1st, and the budget's YYYY-MM keys line up with the calendar.
   Day-of-month is clamped to the target month's length.

   Pure: returns the same profile object, mutated in place. */

function pad(n) { return String(n).padStart(2, "0"); }

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

/* YYYY-MM -> YYYY-MM */
export function shiftMonth(month, delta) {
  if (typeof month !== "string" || !/^\d{4}-\d{2}/.test(month)) return month;
  var y = Number(month.slice(0, 4));
  var m = Number(month.slice(5, 7));
  var d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}

/* YYYY-MM-DD (optionally followed by a time) -> same shape */
export function shiftDate(dateISO, delta) {
  if (typeof dateISO !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(dateISO)) return dateISO;
  var y = Number(dateISO.slice(0, 4));
  var m = Number(dateISO.slice(5, 7));
  var day = Number(dateISO.slice(8, 10));
  var target = new Date(y, m - 1 + delta, 1);
  var ty = target.getFullYear();
  var tm = target.getMonth() + 1;
  var td = Math.min(day, daysInMonth(ty, tm));
  return ty + "-" + pad(tm) + "-" + pad(td) + dateISO.slice(10);
}

/* Whole months from anchor (YYYY-MM-DD) to today (YYYY-MM-DD). */
export function monthsBetween(anchorISO, todayISO) {
  var a = anchorISO.split("-").map(Number);
  var t = todayISO.split("-").map(Number);
  return (t[0] - a[0]) * 12 + (t[1] - a[1]);
}

/**
 * Move every date-bearing field on a sample profile forward by whole
 * months so its anchor lands in today's month.
 * @param {object} profile a profile bundle (mutated in place)
 * @param {string} [todayISO] YYYY-MM-DD, defaults to today
 * @returns {object} the same profile
 */
export function shiftSampleToToday(profile, todayISO) {
  if (!profile || !profile.settings || !profile.settings.sampleAnchor) return profile;
  var today = todayISO || new Date().toISOString().slice(0, 10);
  var delta = monthsBetween(profile.settings.sampleAnchor, today);
  var nowISO = new Date().toISOString();

  if (delta !== 0) {
    (profile.transactions || []).forEach(function (t) { t.date = shiftDate(t.date, delta); });
    (profile.trash || []).forEach(function (t) { t.date = shiftDate(t.date, delta); });
    (profile.scheduled || []).forEach(function (s) {
      s.nextDate = shiftDate(s.nextDate, delta);
      if (s.lastRun) s.lastRun = shiftDate(s.lastRun, delta);
    });
    (profile.goals || []).forEach(function (g) { if (g.byDate) g.byDate = shiftDate(g.byDate, delta); });
    (profile.accounts || []).forEach(function (a) { if (a.closedAt) a.closedAt = shiftDate(a.closedAt, delta); });
    (profile.reductions || []).forEach(function (r) {
      r.startMonth = shiftMonth(r.startMonth, delta);
      if (r.targetMonth) r.targetMonth = shiftMonth(r.targetMonth, delta);
    });
    var budgets = {};
    Object.keys(profile.budgets || {}).forEach(function (m) {
      var rec = profile.budgets[m];
      var nm = shiftMonth(m, delta);
      budgets[nm] = Object.assign({}, rec, { month: nm });
    });
    profile.budgets = budgets;
    profile.settings.sampleAnchor = shiftDate(profile.settings.sampleAnchor, delta);
  }

  /* Trashed rows expire 30 days after deletedAt; stamp them as deleted
     now so the Trash page has something to show for a month. */
  (profile.trash || []).forEach(function (t) { t.deletedAt = nowISO; });
  (profile.reductions || []).forEach(function (r) { r.createdAt = nowISO; r.updatedAt = nowISO; });
  (profile.dashboards || []).forEach(function (d) { d.createdAt = nowISO; d.updatedAt = nowISO; });
  (profile.budgetTemplates || []).forEach(function (t) { t.createdAt = nowISO; t.updatedAt = nowISO; });
  return profile;
}
