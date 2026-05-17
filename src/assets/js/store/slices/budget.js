/* Budget slice — month nav, assigned / activity / available math,
   bulk-clear helpers, move-money, budget templates, quick-assign
   strategies. Doesn't own currentMonth (that lives on the store
   base) — `setMonth` / `goPrevMonth` / etc. just write to it. */

import {
  thisMonth, prevMonth, nextMonth,
  activity as budgetActivity,
  assigned as budgetAssigned,
  totalAssignedInMonth as totalAssignedInMonthImpl,
  categoryRow as categoryRowImpl,
  totalInflowToBudget as totalInflowToBudgetImpl,
  readyToAssign as readyToAssignImpl,
  quickAssignLastMonth,
  quickAssignAverageSpending,
} from "../../domain/budget.js";

export const budgetSlice = {
  /* ---- Budget month + math ---- */
  setMonth(m) { this.currentMonth = m; },
  goPrevMonth() { this.currentMonth = prevMonth(this.currentMonth); },
  goNextMonth() { this.currentMonth = nextMonth(this.currentMonth); },
  jumpToThisMonth() { this.currentMonth = thisMonth(); },

  readyToAssign(month) {
    if (!this.profile) return 0;
    return readyToAssignImpl(this.profile, month || this.currentMonth);
  },
  categoryRow(categoryId, month) {
    if (!this.profile) return { carryIn: 0, assigned: 0, activity: 0, available: 0 };
    return categoryRowImpl(this.profile, categoryId, month || this.currentMonth);
  },
  totalAssignedInMonth(month) {
    if (!this.profile) return 0;
    return totalAssignedInMonthImpl(this.profile, month || this.currentMonth);
  },
  totalInflowToBudget(month) {
    if (!this.profile) return 0;
    return totalInflowToBudgetImpl(this.profile, month || this.currentMonth);
  },
  assignedFor(categoryId, month) {
    if (!this.profile) return 0;
    return budgetAssigned(this.profile, categoryId, month || this.currentMonth);
  },
  activityFor(categoryId, month) {
    if (!this.profile) return 0;
    return budgetActivity(this.profile, categoryId, month || this.currentMonth);
  },

  /* Assign a value (in cents) to a category for a month.
     Replaces the budgets[month] object (and the inner .assigned map)
     with fresh references so every consumer that reads through the
     Alpine proxy sees a top-level property change and re-evaluates.
     Mutating a nested property in place is technically reactive in
     Alpine v3, but downstream re-reads sometimes hold stale values
     when the dependency chain crosses a function boundary
     (categoryRow -> assigned). The fresh-reference assignment is
     bulletproof. */
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

  /* ---- Bulk-clear helpers ---------------------------------------
     Wipe many assigned values (or push them so available == 0) in
     a single undo entry. Used by the budget page's multi-select
     toolbar + the per-group/per-row "Clear" actions.

     clearAssignedForCategories: sets assigned to 0 for every catId
     in `categoryIds` in `month`. Empty list = no-op.

     clearAvailableForCategories: walks each catId, computes the
     assignment needed so categoryRow(cat).available == 0, and writes
     it. For categories whose available is already 0, no-op. */
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
  clearAvailableForCategories(categoryIds, month, label) {
    if (!this.profile || !categoryIds || !categoryIds.length) return 0;
    var m = month || this.currentMonth;
    this._recordUndo(label || ("Clear available (" + categoryIds.length + ")"));
    var existing = this.profile.budgets[m] || { month: m, assigned: {}, notes: {} };
    var nextAssigned = Object.assign({}, existing.assigned || {});
    var self = this;
    var n = 0;
    categoryIds.forEach(function (id) {
      var row = categoryRowImpl(self.profile, id, m);
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

  /* Convenience: every on-budget category id for the active profile
     (skips payment categories — those are derived from card spending
     and don't accept direct assignment safely). */
  allBudgetableCategoryIds() {
    if (!this.profile) return [];
    var self = this;
    return (this.profile.categories || [])
      .filter(function (c) { return !c.hidden && !self.isPaymentCategory(c.id); })
      .map(function (c) { return c.id; });
  },
  /* All category ids belonging to a single group (skips payment +
     hidden). Useful for "select entire group" / "clear assigned for
     this group". */
  categoryIdsInGroup(groupId) {
    if (!this.profile) return [];
    var self = this;
    return (this.profile.categories || [])
      .filter(function (c) { return c.groupId === groupId && !c.hidden && !self.isPaymentCategory(c.id); })
      .map(function (c) { return c.id; });
  },

  /* Move money from one category to another in a single transaction:
     decrement source.assigned by cents, increment target.assigned by
     cents. The net change to "Total assigned" is zero — the user is
     just reallocating. Records ONE undo entry covering both legs. */
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

  /* ---- Budget templates -----------------------------------------
     A template is a named snapshot of a single month's `assigned`
     map. Save once ("Standard month"), apply to any future month to
     re-create the same allocation. Stored on the profile under
     `budgetTemplates`. Categories that no longer exist when the
     template is applied are silently dropped. */

  listBudgetTemplates() {
    void this._listVersion;
    if (!this.profile) return [];
    return (this.profile.budgetTemplates || []).slice().sort(function (a, b) {
      return (a.name || "").localeCompare(b.name || "");
    });
  },

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

  /* Quick-assign helpers — they return cents; UI calls assign(). */
  quickLastMonth(categoryId, month) {
    if (!this.profile) return 0;
    return quickAssignLastMonth(this.profile, categoryId, month || this.currentMonth);
  },
  quickAvg(categoryId, month, n) {
    if (!this.profile) return 0;
    return quickAssignAverageSpending(this.profile, categoryId, month || this.currentMonth, n);
  },
  quickGoalTarget(categoryId, month) {
    var goal = this.findGoal(categoryId);
    if (!goal) return 0;
    return goal.target || 0;
  },
};
