/* Budget slice — month nav, assigned / activity / available math,
   bulk-clear helpers, move-money, budget templates, quick-assign
   strategies. Doesn't own currentMonth (that lives on the store
   base) — `setMonth` / `goPrevMonth` / etc. just write to it. */

import {
  thisMonth, prevMonth, nextMonth,
  assigned as budgetAssigned,
  totalAssignedInMonth as totalAssignedInMonthImpl,
  buildMonthIndex, buildBudgetTable, tableCategoryRow, tableReadyToAssign,
  quickAssignLastMonth,
  quickAssignAverageSpending,
} from "../../domain/budget.js";

export const budgetSlice = {
  /* ---- Budget month + math ---- */
  /** @param {string} m YYYY-MM */
  setMonth(m) { this.currentMonth = m; },
  /** Step the active month back by one. */
  goPrevMonth() { this.currentMonth = prevMonth(this.currentMonth); },
  /** Step the active month forward by one. */
  goNextMonth() { this.currentMonth = nextMonth(this.currentMonth); },
  /** Reset the active month to today's calendar month. */
  jumpToThisMonth() { this.currentMonth = thisMonth(); },

  /* ---- The month index / budget table (Phase 1) ------------------
     One O(T) index pass and one forward O(months x categories) table
     pass serve EVERY row and RTA read for every visible month. The
     table's horizon is max(currentMonth, _budgetHorizon, queried
     month), so one memo entry covers all columns of a multi-month
     view; _budgetHorizon is set by the view when it shows months past
     currentMonth. Cache invalidation is _listVersion, same as every
     other memo. */
  _budgetHorizon: null,
  _monthIndex() {
    var self = this;
    return this._memo("monthIndex", function () { return buildMonthIndex(self.profile); });
  },
  _budgetTable(month) {
    var h = this.currentMonth;
    if (this._budgetHorizon && this._budgetHorizon > h) h = this._budgetHorizon;
    if (month && month > h) h = month;
    var self = this;
    return this._memo("budgetTable:" + h, function () {
      return buildBudgetTable(self.profile, h, self._monthIndex());
    });
  },

  /**
   * @param {string} [month] YYYY-MM, defaults to currentMonth
   * @returns {number} cents available to assign this month
   */
  readyToAssign(month) {
    if (!this.profile) return 0;
    var m = month || this.currentMonth;
    var v = tableReadyToAssign(this._budgetTable(m), m);
    return v == null ? 0 : v;
  },
  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {object} {carryIn, assigned, activity, available} — all cents
   *
   * Memoized — the budget grid calls this PER CATEGORY on every
   * render (40+ categories × 3 reads per row = 120+ walks per tick
   * pre-cache). Cache invalidates on _listVersion.
   */
  categoryRow(categoryId, month) {
    if (!this.profile) return { carryIn: 0, assigned: 0, activity: 0, available: 0 };
    var m = month || this.currentMonth;
    var row = tableCategoryRow(this._budgetTable(m), categoryId, m);
    return row || { carryIn: 0, assigned: 0, activity: 0, available: 0 };
  },
  /**
   * @param {string} [month]
   * @returns {number} cents — sum of every category's assigned value this month
   */
  totalAssignedInMonth(month) {
    if (!this.profile) return 0;
    var m = month || this.currentMonth;
    var self = this;
    return this._memo("totalAssigned:" + m, function () { return totalAssignedInMonthImpl(self.profile, m); });
  },
  /**
   * @param {string} [month]
   * @returns {number} cents — inflow-to-RTA transactions in the month
   */
  totalInflowToBudget(month) {
    if (!this.profile) return 0;
    var m = month || this.currentMonth;
    var idx = this._monthIndex();
    var sum = 0;
    idx.months.forEach(function (mm) { if (mm <= m) sum += idx.inflow[mm] || 0; });
    return sum;
  },
  /**
   * The three components behind readyToAssign, for the inspector's
   * month overview: cumulative inflow-to-budget, cumulative assigned,
   * and prior-month overspending lost. inflow - assigned - lost ===
   * readyToAssign(month) by construction.
   * @param {string} [month]
   * @returns {{inflow:number, assigned:number, lost:number, rta:number}}
   */
  rtaBreakdown(month) {
    if (!this.profile) return { inflow: 0, assigned: 0, lost: 0, rta: 0 };
    var m = month || this.currentMonth;
    var idx = this._monthIndex();
    var inflow = 0;
    var assignedCum = 0;
    idx.months.forEach(function (mm) {
      if (mm > m) return;
      inflow += idx.inflow[mm] || 0;
      assignedCum += idx.assignedTotal[mm] || 0;
    });
    var rta = this.readyToAssign(m);
    return { inflow: inflow, assigned: assignedCum, lost: inflow - assignedCum - rta, rta: rta };
  },

  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {number} cents assigned to the category in the month
   */
  assignedFor(categoryId, month) {
    if (!this.profile) return 0;
    var m = month || this.currentMonth;
    var self = this;
    return this._memo("assigned:" + categoryId + ":" + m, function () { return budgetAssigned(self.profile, categoryId, m); });
  },
  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {number} cents of transaction activity (typically negative)
   */
  activityFor(categoryId, month) {
    if (!this.profile) return 0;
    var m = month || this.currentMonth;
    var bucket = this._monthIndex().act[m];
    return (bucket && bucket[categoryId]) || 0;
  },

  /**
   * Assign a value (in cents) to a category for a month. Replaces the
   * budgets[month] object and its inner .assigned map by reference so
   * Alpine consumers downstream of categoryRow re-evaluate reliably.
   * Records an undo entry.
   * @param {id} categoryId
   * @param {string} month YYYY-MM
   * @param {number} cents
   */
  assign(categoryId, month, cents) {
    if (!this.profile) return;
    var m = month || this.currentMonth;
    var catName = this.categoryName(categoryId) || "category";
    this._recordUndo("Assign to " + catName);
    var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
    var nextAssigned = Object.assign({}, existing.assigned || {});
    nextAssigned[categoryId] = Math.round(Number(cents) || 0);
    this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
    this._bumpLists();
    this._save();
  },

  /**
   * Write a whole {categoryId: cents} map onto one month under a
   * SINGLE undo entry and a single save. Every multi-category
   * assignment path (auto-assign, quick fills) must come through
   * here — calling assign() in a loop records one undo entry and one
   * full-profile save per category, which evicts the 50-entry undo
   * history in one gesture.
   * @param {Object<string, number>} assignments categoryId -> cents
   * @param {string} [month]
   * @param {string} [label] undo label
   * @returns {number} count of categories written
   */
  applyAssignments(assignments, month, label) {
    if (!this.profile) return 0;
    var ids = Object.keys(assignments || {});
    if (!ids.length) return 0;
    var m = month || this.currentMonth;
    this._recordUndo(label || ("Assign " + ids.length + " categories"));
    var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
    var nextAssigned = Object.assign({}, existing.assigned || {});
    ids.forEach(function (id) {
      nextAssigned[id] = Math.round(Number(assignments[id]) || 0);
    });
    this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
    this._bumpLists();
    this._save();
    return ids.length;
  },

  /**
   * The per-month note for a category (budgets[m].notes - the schema
   * field that sat unwritten since v1).
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {string}
   */
  monthNote(categoryId, month) {
    void this._listVersion;
    if (!this.profile) return "";
    var m = month || this.currentMonth;
    var rec = this.profile.budgets[m];
    return (rec && rec.notes && rec.notes[categoryId]) || "";
  },
  /**
   * Set (or clear) the per-month note. Trimmed; no-op when unchanged
   * so a blur that changed nothing does not spam undo. One undo entry
   * per real change; empty notes are removed from the map.
   * @returns {boolean} true if changed
   */
  setMonthNote(categoryId, month, text) {
    if (!this.profile) return false;
    var m = month || this.currentMonth;
    var clean = String(text == null ? "" : text).trim();
    var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
    var current = (existing.notes && existing.notes[categoryId]) || "";
    if (current === clean) return false;
    this._recordUndo("Edit note");
    var nextNotes = Object.assign({}, existing.notes || {});
    if (clean) nextNotes[categoryId] = clean;
    else delete nextNotes[categoryId];
    this.profile.budgets[m] = Object.assign({}, existing, { notes: nextNotes });
    this._bumpLists();
    this._save();
    return true;
  },

  /* ---- Bulk-clear helpers --------------------------------------- */
  /**
   * Set assigned to 0 for every catId in `categoryIds` in `month`,
   * under one undo entry.
   * @param {string[]} categoryIds
   * @param {string} [month]
   * @param {string} [label] undo label override
   * @returns {number} count of categories actually changed
   */
  clearAssignedForCategories(categoryIds, month, label) {
    if (!this.profile || !categoryIds || !categoryIds.length) return 0;
    var m = month || this.currentMonth;
    this._recordUndo(label || ("Clear assigned (" + categoryIds.length + ")"));
    var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
    var nextAssigned = Object.assign({}, existing.assigned || {});
    var n = 0;
    categoryIds.forEach(function (id) {
      if (nextAssigned[id]) { nextAssigned[id] = 0; n++; }
    });
    this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
    this._bumpLists();
    this._save();
    return n;
  },
  /**
   * For each catId, write the assignment that makes available == 0
   * (i.e. assigned = -carryIn - activity). Categories already at 0
   * are skipped. Single undo entry.
   * @param {string[]} categoryIds
   * @param {string} [month]
   * @param {string} [label] undo label override
   * @returns {number} count of categories actually changed
   */
  clearAvailableForCategories(categoryIds, month, label) {
    if (!this.profile || !categoryIds || !categoryIds.length) return 0;
    var m = month || this.currentMonth;
    this._recordUndo(label || ("Clear available (" + categoryIds.length + ")"));
    var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
    var nextAssigned = Object.assign({}, existing.assigned || {});
    var self = this;
    var n = 0;
    categoryIds.forEach(function (id) {
      var row = self.categoryRow(id, m);
      if (row.available === 0) return;
      /* available = carryIn + assigned + activity, so set
         assigned = -carryIn - activity to land on 0. */
      nextAssigned[id] = -row.carryIn - row.activity;
      n++;
    });
    this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
    this._bumpLists();
    this._save();
    return n;
  },

  /**
   * Every on-budget category id, excluding hidden and payment
   * categories (those derive from card spending and shouldn't take
   * direct assignment).
   * @returns {string[]}
   */
  allBudgetableCategoryIds() {
    if (!this.profile) return [];
    var self = this;
    return (this.profile.categories || [])
      .filter(function (c) { return !c.hidden && !self.isPaymentCategory(c.id); })
      .map(function (c) { return c.id; });
  },
  /**
   * Category ids belonging to a single group (skips hidden + payment
   * categories). Useful for "select entire group" actions.
   * @param {id} groupId
   * @returns {string[]}
   */
  categoryIdsInGroup(groupId) {
    if (!this.profile) return [];
    var self = this;
    return (this.profile.categories || [])
      .filter(function (c) { return c.groupId === groupId && !c.hidden && !self.isPaymentCategory(c.id); })
      .map(function (c) { return c.id; });
  },

  /**
   * Reallocate cents from one category to another in a single undo
   * entry — net change to total assigned is zero. No-op if the ids
   * match or amount is non-positive.
   * @param {id} fromCategoryId
   * @param {id} toCategoryId
   * @param {number} cents
   * @param {string} [month]
   * @returns {boolean} false on invalid args
   */
  moveMoney(fromCategoryId, toCategoryId, cents, month) {
    if (!this.profile) return false;
    var amt = Math.round(Number(cents) || 0);
    if (!fromCategoryId || !toCategoryId || amt <= 0) return false;
    if (fromCategoryId === toCategoryId) return false;
    var m = month || this.currentMonth;
    var fromName = this.categoryName(fromCategoryId) || "category";
    var toName = this.categoryName(toCategoryId) || "category";
    this._recordUndo("Move money: " + fromName + " → " + toName);
    var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
    var nextAssigned = Object.assign({}, existing.assigned || {});
    nextAssigned[fromCategoryId] = (nextAssigned[fromCategoryId] || 0) - amt;
    nextAssigned[toCategoryId]   = (nextAssigned[toCategoryId]   || 0) + amt;
    this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
    this._bumpLists();
    this._save();
    return true;
  },

  /* ---- Budget templates ----------------------------------------- */
  /**
   * All saved templates sorted by name. Reads _listVersion for
   * reactivity.
   * @returns {object[]}
   */
  listBudgetTemplates() {
    void this._listVersion;
    if (!this.profile) return [];
    return (this.profile.budgetTemplates || []).slice().sort(function (a, b) {
      return (a.name || "").localeCompare(b.name || "");
    });
  },

  /**
   * Snapshot a month's non-zero assigned map under `name`; overwrites
   * if a template by that name already exists. Records an undo entry.
   * @param {string} name
   * @param {string} [month]
   * @returns {object|null} template, or null if name is blank
   */
  saveBudgetTemplate(name, month) {
    if (!this.profile) return null;
    var clean = (name || "").trim();
    if (!clean) return null;
    var m = month || this.currentMonth;
    var src = this.profile.budgets[m] || { assigned: {} };
    var assigned = {};
    Object.keys(src.assigned || {}).forEach(function (catId) {
      var cents = src.assigned[catId];
      if (cents) assigned[catId] = cents;
    });
    this._recordUndo("Save budget template");
    if (!this.profile.budgetTemplates) this.profile.budgetTemplates = [];
    var existing = this.profile.budgetTemplates.find(function (t) { return t.name === clean; });
    var tpl;
    if (existing) {
      existing.assigned = assigned;
      existing.updatedAt = new Date().toISOString();
      tpl = existing;
    } else {
      tpl = {
        id: (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : ("tpl-" + Date.now().toString(36)),
        name: clean,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assigned: assigned,
      };
      this.profile.budgetTemplates.push(tpl);
    }
    this._bumpLists();
    this._save();
    this.pushToast("Saved budget template \"" + clean + "\".", "ok");
    return tpl;
  },

  /**
   * Copy a template's assigned values onto `month`. Category ids that
   * no longer exist are silently dropped. Records an undo entry.
   * @param {id} templateId
   * @param {string} [month]
   * @returns {number} count of categories actually assigned
   */
  applyBudgetTemplate(templateId, month) {
    if (!this.profile) return 0;
    var tpl = (this.profile.budgetTemplates || []).find(function (t) { return t.id === templateId; });
    if (!tpl) return 0;
    var m = month || this.currentMonth;
    var validIds = new Set((this.profile.categories || []).map(function (c) { return c.id; }));
    this._recordUndo("Apply template: " + (tpl.name || "template"));
    var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
    var nextAssigned = Object.assign({}, existing.assigned || {});
    var n = 0;
    Object.keys(tpl.assigned || {}).forEach(function (catId) {
      if (!validIds.has(catId)) return;
      nextAssigned[catId] = tpl.assigned[catId];
      n += 1;
    });
    this.profile.budgets[m] = Object.assign({}, existing, { assigned: nextAssigned });
    this._bumpLists();
    this._save();
    this.pushToast(
      "Applied template — " + n + " categor" + (n === 1 ? "y" : "ies") + " assigned in " + m + ".",
      "ok"
    );
    return n;
  },

  /**
   * Remove a saved template by id. Records an undo entry.
   * @param {id} templateId
   * @returns {boolean} false if not found
   */
  deleteBudgetTemplate(templateId) {
    if (!this.profile || !this.profile.budgetTemplates) return false;
    var i = this.profile.budgetTemplates.findIndex(function (t) { return t.id === templateId; });
    if (i === -1) return false;
    var name = this.profile.budgetTemplates[i].name;
    this._recordUndo("Delete template");
    this.profile.budgetTemplates.splice(i, 1);
    this._bumpLists();
    this._save();
    this.pushToast("Deleted budget template \"" + name + "\".", "ok");
    return true;
  },

  /* Quick-assign helpers — they return cents; UI applies them via
     applyAssignments(). These are the single source of truth for the
     auto-assign strategies (the view used to reimplement all four). */
  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {number} cents assigned to the category in the PRIOR month
   */
  quickLastMonthAssigned(categoryId, month) {
    if (!this.profile) return 0;
    return budgetAssigned(this.profile, categoryId, prevMonth(month || this.currentMonth));
  },
  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {number} cents of absolute outflow in the PRIOR month
   *   (a net-refund month suggests 0)
   */
  quickLastMonthSpent(categoryId, month) {
    if (!this.profile) return 0;
    return quickAssignLastMonth(this.profile, categoryId, month || this.currentMonth);
  },
  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @param {number} [n] window in months
   * @returns {number} cents of average spending over the window
   */
  quickAvg(categoryId, month, n) {
    if (!this.profile) return 0;
    return quickAssignAverageSpending(this.profile, categoryId, month || this.currentMonth, n);
  },
  /**
   * @param {id} categoryId
   * @param {string} [month]
   * @returns {number} cents the category's goal still needs in the
   *   month to be fully funded, or 0 with no goal
   */
  quickGoalTarget(categoryId, month) {
    var goal = this.findGoal(categoryId);
    if (!goal) return 0;
    return this.goalNeeded(categoryId, month || this.currentMonth) || 0;
  },
};
