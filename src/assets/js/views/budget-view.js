/* Alpine x-data factory for /app/budget/.
   Extracted from budget.njk so the template stays focused on
   markup. Exposed as a window-level global because Alpine reads
   x-data via Function() and needs the symbol on window. Load
   order in app.njk puts this BEFORE alpine.min.js (both defer). */
(function () {
  "use strict";

function budgetView() {
  return {
    /* Multi-select state for the bulk-clear UI. selectedCatIds is the
       authoritative list; group checkboxes are derived from whether
       every cat in the group is currently selected. */
    selectedCatIds: [],
    isCatSelected(id) { return this.selectedCatIds.indexOf(id) !== -1; },
    toggleCatSelected(id) {
      var i = this.selectedCatIds.indexOf(id);
      if (i === -1) this.selectedCatIds.push(id);
      else this.selectedCatIds.splice(i, 1);
    },
    groupAllSelected(group) {
      var self = this;
      var ids = (group.categories || []).map(function (c) { return c.id; });
      if (!ids.length) return false;
      return ids.every(function (id) { return self.isCatSelected(id); });
    },
    groupSomeSelected(group) {
      var self = this;
      var ids = (group.categories || []).map(function (c) { return c.id; });
      return ids.some(function (id) { return self.isCatSelected(id); }) && !this.groupAllSelected(group);
    },
    toggleGroupSelected(group) {
      var ids = (group.categories || []).map(function (c) { return c.id; });
      if (!ids.length) return;
      var allSel = this.groupAllSelected(group);
      var self = this;
      if (allSel) {
        this.selectedCatIds = this.selectedCatIds.filter(function (id) { return ids.indexOf(id) === -1; });
      } else {
        ids.forEach(function (id) { if (!self.isCatSelected(id)) self.selectedCatIds.push(id); });
      }
    },
    clearSelection() { this.selectedCatIds = []; },

    /* ---- Budget templates UI ---- */
    templatesOpen: false,
    templateNewName: "",
    openTemplates() {
      this.templateNewName = "";
      this.templatesOpen = true;
      var self = this;
      this.$nextTick(function () {
        var el = document.getElementById("tpl-name");
        if (el) el.focus();
      });
    },
    saveTemplate() {
      var name = (this.templateNewName || "").trim();
      if (!name) return;
      this.$store.budget.saveBudgetTemplate(name, this.$store.budget.currentMonth);
      this.templateNewName = "";
    },
    applyTemplate(id) {
      var self = this;
      var m = this.$store.budget.currentMonth;
      window.PBDialog.confirm({
        title: "Apply template to " + m + "?",
        message: "Existing assignments for any categories in this template will be overwritten. Cmd/Ctrl+Z undoes.",
        confirmLabel: "Apply template",
      }).then(function (ok) {
        if (!ok) return;
        self.$store.budget.applyBudgetTemplate(id, m);
        self.templatesOpen = false;
      });
    },
    deleteTemplate(id, name) {
      var self = this;
      window.PBDialog.confirm({
        title: "Delete template \"" + name + "\"?",
        message: "Saved templates can't be recovered after deletion.",
        confirmLabel: "Delete template",
        danger: true,
      }).then(function (ok) {
        if (!ok) return;
        self.$store.budget.deleteBudgetTemplate(id);
      });
    },

    /* Keyboard alternative to drag-and-drop (WCAG 2.5.7). Arrow keys
       on the .dnd-handle reorder the row/group up or down by one
       position, then restore focus to the same handle so the user
       can keep pressing. Uses the same store mutators Sortable's
       onEnd dispatches. */
    keyboardMoveGroup(group, delta) {
      if (!group || !group.id) return;
      var view = this.$store.budget.categoryGroupsView();
      var groupBuckets = view.filter(function (b) { return b.group; });
      var idx = groupBuckets.findIndex(function (b) { return b.group.id === group.id; });
      if (idx < 0) return;
      var next = Math.max(0, Math.min(groupBuckets.length - 1, idx + delta));
      if (next === idx) return;
      this.$store.budget.moveCategoryGroup(group.id, next);
      var self = this;
      this.$nextTick(function () {
        var el = document.querySelector('[data-sortable-id="' + group.id + '"] .dnd-handle');
        if (el) el.focus();
      });
    },
    keyboardMoveCat(c, groupBucket, delta) {
      if (!c || !c.id) return;
      var groupId = (groupBucket && groupBucket.group) ? groupBucket.group.id : null;
      var cats = (groupBucket && groupBucket.categories) || [];
      var idx = cats.findIndex(function (x) { return x.id === c.id; });
      if (idx < 0) return;
      var next = Math.max(0, Math.min(cats.length - 1, idx + delta));
      if (next === idx) return;
      this.$store.budget.moveCategory(c.id, groupId, next);
      this.$nextTick(function () {
        var el = document.querySelector('[data-sortable-id="' + c.id + '"] .dnd-handle');
        if (el) el.focus();
      });
    },
    /* Bulk-clear handlers — all run through the new store methods with
       PBDialog confirmation for the irreversible-ish operations.
       Toasts the row count + a Cmd-Z hint. */
    async bulkClearAssigned(scope) {
      var s = this.$store.budget;
      var ids = scope === "all"       ? s.allBudgetableCategoryIds()
              : scope === "selection" ? this.selectedCatIds.slice()
              : null;
      if (!ids || !ids.length) return;
      var label = scope === "all" ? "every category in the budget" : (ids.length + " selected categor" + (ids.length === 1 ? "y" : "ies"));
      if (window.PBDialog) {
        var ok = await window.PBDialog.confirm({
          title: "Clear assigned to $0?",
          message: "Reset Assigned to $0 for " + label + " in this month. Activity and carry-in stay put. Cmd/Ctrl+Z undoes.",
          confirmLabel: "Clear assigned",
        });
        if (!ok) return;
      }
      var n = s.clearAssignedForCategories(ids, s.currentMonth, "Clear assigned · " + label);
      s.pushToast("Cleared assigned for " + n + " categor" + (n === 1 ? "y" : "ies") + ".", "ok");
      if (scope === "selection") this.clearSelection();
    },
    async bulkClearAvailable(scope) {
      var s = this.$store.budget;
      var ids = scope === "selection" ? this.selectedCatIds.slice() : null;
      if (!ids || !ids.length) return;
      var label = ids.length + " selected categor" + (ids.length === 1 ? "y" : "ies");
      if (window.PBDialog) {
        var ok = await window.PBDialog.confirm({
          title: "Clear available to $0?",
          message: "Push Available to $0 for " + label + " in this month — pulls money back to Ready to Assign by lowering Assigned. Cmd/Ctrl+Z undoes.",
          confirmLabel: "Clear available",
        });
        if (!ok) return;
      }
      var n = s.clearAvailableForCategories(ids, s.currentMonth, "Clear available · " + label);
      s.pushToast("Cleared available for " + n + " categor" + (n === 1 ? "y" : "ies") + ".", "ok");
      this.clearSelection();
    },
    /* Quick per-group helpers — select the whole group then clear. */
    async groupClearAssigned(group) {
      this.selectedCatIds = (group.categories || []).map(function (c) { return c.id; });
      await this.bulkClearAssigned("selection");
    },
    async groupClearAvailable(group) {
      this.selectedCatIds = (group.categories || []).map(function (c) { return c.id; });
      await this.bulkClearAvailable("selection");
    },
    /* Per-category Clear helpers — single-cat path with the same
       confirm UX as the bulk version, no selection side effects. */
    async catClearAssigned(c) {
      var s = this.$store.budget;
      var label = "'" + (c.name || "this category") + "'";
      if (window.PBDialog) {
        var ok = await window.PBDialog.confirm({
          title: "Clear assigned to $0?",
          message: "Reset Assigned to $0 for " + label + " in this month. Activity and carry-in stay put. Cmd/Ctrl+Z undoes.",
          confirmLabel: "Clear assigned",
        });
        if (!ok) return;
      }
      s.clearAssignedForCategories([c.id], s.currentMonth, "Clear assigned · " + label);
      s.pushToast("Cleared assigned for " + (c.name || "category") + ".", "ok");
    },
    async catClearAvailable(c) {
      var s = this.$store.budget;
      var label = "'" + (c.name || "this category") + "'";
      if (window.PBDialog) {
        var ok = await window.PBDialog.confirm({
          title: "Clear available to $0?",
          message: "Push Available to $0 for " + label + " in this month — pulls money back to Ready to Assign by lowering Assigned. Cmd/Ctrl+Z undoes.",
          confirmLabel: "Clear available",
        });
        if (!ok) return;
      }
      s.clearAvailableForCategories([c.id], s.currentMonth, "Clear available · " + label);
      s.pushToast("Cleared available for " + (c.name || "category") + ".", "ok");
    },
    /* Auto-assign from the bulk-actions bar — re-uses the existing
       modal with kind: 'selection' so the copy reads "Only the N
       selected categories are touched." */
    bulkAutoAssign() {
      if (!this.selectedCatIds.length) return;
      var n = this.selectedCatIds.length;
      this.openAutoAssign({
        kind: "selection",
        name: n + " selected categor" + (n === 1 ? "y" : "ies"),
        ids: this.selectedCatIds.slice(),
      });
    },

    /* Inline-edit modal state — covers create / rename / delete and
       goal-edit for both groups and categories. The budget page is
       the canonical surface for all category management. */
    newGroupOpen: false,
    newGroupName: "",
    newCatOpen: false,
    newCatName: "",
    newCatGroupId: null,
    newCatGroupName: "",
    deleteGroupId: null,
    deleteGroupName: "",
    deleteCatId: null,
    deleteCatName: "",
    renameOpen: false,
    renameKind: "",      /* 'group' | 'category' */
    renameTargetId: null,
    renameName: "",
    /* Goal modal state — goalCatId + goalForm drive the goal-edit
       form rendered inside the budget page. */
    goalCatId: null,
    goalForm: { type: "monthlyFixed", target: "", byDate: "" },
    /* Activity drill-down modal — opens when the user clicks any
       Outflow number. activityScope tells us whether to show a single
       category, a group of categories, or every category. */
    activityOpen: false,
    activityScope: { kind: "category", id: null, name: "", categoryIds: null },
    /* Auto-assign modal — strategy picker that one-clicks the
       Assigned column. autoAssignScope sets what gets touched:
         { kind: 'all' }                 → every non-payment category
         { kind: 'group', name, ids[] }  → just the categories in one group
         { kind: 'category', name, id }  → a single category
       Defaults to "all" when opened from the top toolbar. */
    autoAssignOpen: false,
    autoAssignChoice: "",
    autoAssignScope: { kind: "all", name: "All categories", ids: null },
    /* Section-level collapse — hides every category row and the
       column header strip, leaving only the toolbar + Total Budget
       summary so the user can scan the bottom line at a glance. */
    budgetCollapsed: false,
    /* Move-money modal — reallocate Assigned dollars between
       categories or payment pools in the active month. */
    moveMoneyOpen: false,
    moveMoneyForm: { fromId: "", toId: "", amount: "" },

    /* URL state sync — currentMonth lives on the budget store rather
       than this factory, so writes happen via Alpine.effect (not
       $watch) and reads happen at init time before the store is
       guaranteed ready (a polling retry handles late readiness). */
    _syncUrl() {
      try {
        var s = window.Alpine && window.Alpine.store && window.Alpine.store("budget");
        var m = s && s.currentMonth;
        var parts = [];
        if (m) parts.push("m=" + encodeURIComponent(m));
        var qs = parts.length ? ("?" + parts.join("&")) : "";
        history.replaceState(null, "", window.location.pathname + qs);
      } catch (_e) {}
    },
    saveCurrentView() {
      this._syncUrl();
      this.$dispatch("pb:save-view", { kind: "budget", name: "" });
    },

    init() {
      var self = this;
      /* Honor incoming `?m=YYYY-MM` from a recalled saved view. The
         store may not be ready yet — poll until it is, then apply. */
      var requestedMonth = null;
      try {
        var p = new URL(window.location.href).searchParams;
        var m = p.get("m");
        if (m && /^\d{4}-\d{2}$/.test(m)) requestedMonth = m;
      } catch (_e) {}
      var tries = 0;
      var apply = function () {
        var s = window.Alpine && window.Alpine.store && window.Alpine.store("budget");
        if (!s || !s.setMonth) {
          if (++tries < 100) setTimeout(apply, 50);
          return;
        }
        if (requestedMonth) s.setMonth(requestedMonth);
        /* Write URL whenever the store's currentMonth changes. Using
           Alpine.effect because it's a store value, not a local
           reactive field — $watch would miss it. */
        if (window.Alpine && window.Alpine.effect) {
          window.Alpine.effect(function () {
            void s.currentMonth;
            self._syncUrl();
          });
        }
      };
      apply();
    },

    /* ---- Auto-assign --------------------------------------------- */
    /* Compute per-category cents under each strategy. Returns the
       same record shape (cats map + total) every time so the modal's
       preview totals stay deterministic. Payment categories are
       skipped — those track credit-card spending and shouldn't be
       overwritten by auto-assign. */
    _autoAssignPlan(strategy) {
      var store = this.$store.budget;
      if (!store.profile) return { cats: {}, total: 0 };
      var month = store.currentMonth;
      var self = this;
      var cats = {};
      var total = 0;
      var scope = this.autoAssignScope || { kind: "all" };
      var scopeIds = scope.kind === "category" && scope.id ? [scope.id]
                   : (scope.kind === "group" || scope.kind === "selection") && scope.ids ? scope.ids
                   : null;
      var scopeSet = scopeIds ? new Set(scopeIds.filter(Boolean)) : null;
      var allCats = (store.profile.categories || []).filter(function (c) {
        if (store.isPaymentCategory(c.id)) return false;
        if (scopeSet && !scopeSet.has(c.id)) return false;
        return true;
      });
      function add(catId, cents) {
        if (!cents) return;
        cats[catId] = cents;
        total += cents;
      }
      allCats.forEach(function (c) {
        if (strategy === "goals") {
          /* Underfunded — what each goal still needs this month. */
          var g = store.findGoal(c.id);
          if (!g) return;
          var need = store.goalNeeded(c.id, month) || 0;
          if (need > 0) add(c.id, need);
        } else if (strategy === "last-month-assigned") {
          var prev = self._prevMonth(month);
          var prevAssigned = store.assignedFor(c.id, prev) || 0;
          if (prevAssigned > 0) add(c.id, prevAssigned);
        } else if (strategy === "last-month-spent") {
          var prev2 = self._prevMonth(month);
          var act = Math.abs(Math.min(0, store.activityFor(c.id, prev2) || 0));
          if (act > 0) add(c.id, act);
        } else if (strategy === "avg-3-spent") {
          var sum = 0;
          var cursor = month;
          for (var i = 0; i < 3; i++) {
            cursor = self._prevMonth(cursor);
            sum += Math.abs(Math.min(0, store.activityFor(c.id, cursor) || 0));
          }
          var avg = Math.round(sum / 3);
          if (avg > 0) add(c.id, avg);
        }
      });
      return { cats: cats, total: total };
    },
    _prevMonth(iso) {
      var parts = (iso || "").split("-").map(Number);
      var d = new Date(parts[0], parts[1] - 2, 1);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    },
    autoAssignStrategies() {
      var goals = this._autoAssignPlan("goals");
      var prevA = this._autoAssignPlan("last-month-assigned");
      var prevS = this._autoAssignPlan("last-month-spent");
      var avg   = this._autoAssignPlan("avg-3-spent");
      return [
        {
          id: "goals",
          label: "Underfunded (goals)",
          hint: "Assigns exactly what each category's goal still needs to reach its target this month.",
          preview: goals.total,
          disabled: Object.keys(goals.cats).length === 0,
        },
        {
          id: "last-month-assigned",
          label: "Last month's assigned",
          hint: "Copies what you assigned to each category last month. Great for steady, repeatable budgets.",
          preview: prevA.total,
          disabled: Object.keys(prevA.cats).length === 0,
        },
        {
          id: "last-month-spent",
          label: "Last month's spending",
          hint: "Assigns what each category actually spent last month — useful when last month was a typical month.",
          preview: prevS.total,
          disabled: Object.keys(prevS.cats).length === 0,
        },
        {
          id: "avg-3-spent",
          label: "Average of last 3 months",
          hint: "Smooths out one-off swings by averaging the last three months of spending per category.",
          preview: avg.total,
          disabled: Object.keys(avg.cats).length === 0,
        },
      ];
    },
    autoAssignAffectedCount() {
      if (!this.autoAssignChoice) return 0;
      return Object.keys(this._autoAssignPlan(this.autoAssignChoice).cats).length;
    },
    /* Strategy-specific footer blurb. Each one names what's actually
       happening ("fund goals", "copy last month", etc.) instead of
       the generic "Will set Assigned for N categories". Total is
       calculated from the plan so the number always matches what
       Apply will commit. */
    autoAssignSummary() {
      if (!this.autoAssignChoice) return "";
      var plan = this._autoAssignPlan(this.autoAssignChoice);
      var n = Object.keys(plan.cats).length;
      if (n === 0) return "";
      var total = this.formatCents(plan.total);
      var scope = this.autoAssignScope || { kind: "all" };
      /* Scope label is the noun phrase ("Groceries" / "Daily group" /
         "2 categories"). Lets us name the actual target instead of
         "1 category" when the user clicked the ⚡ on a single row. */
      var target;
      if (scope.kind === "category" && scope.name) {
        target = scope.name;
      } else if (scope.kind === "group" && scope.name) {
        target = n + " " + (n === 1 ? "category" : "categories") +
                 " in " + scope.name;
      } else {
        target = n + " " + (n === 1 ? "category" : "categories");
      }
      switch (this.autoAssignChoice) {
        case "goals":
          /* Single-category scope: only ever 1 goal. */
          if (scope.kind === "category") {
            return "Will fully fund the " + scope.name + " goal (" + total + ").";
          }
          return "Will fully fund " + n + " " + (n === 1 ? "goal" : "goals") +
                 " across " + target + " for " + total + " total.";
        case "last-month-assigned":
          return "Will copy last month's plan (" + total + ") to " + target + ".";
        case "last-month-spent":
          return "Will mirror last month's actual spending (" + total + ") to " + target + ".";
        case "avg-3-spent":
          return "Will assign the 3-month average (" + total + ") to " + target + ".";
      }
      return "Will set Assigned for " + target + ".";
    },
    openAutoAssign(scope) {
      this.autoAssignScope = scope || { kind: "all", name: "All categories", ids: null };
      this.autoAssignChoice = "";
      this.autoAssignOpen = true;
    },

    /* ---- Move money --------------------------------------------- */
    /* Build the dropdown options — every non-hidden category plus
       payment pools (which ARE categories with isPaymentCategory:
       true). Each option shows the group prefix + the Available so
       the user can see at a glance which categories have spare
       dollars to move from. */
    moveMoneyCategoryOptions() {
      void this.$store.budget._listVersion;
      var store = this.$store.budget;
      if (!store.profile) return [];
      var self = this;
      var view = store.categoryGroupsView() || [];
      var out = [];
      view.forEach(function (b) {
        (b.categories || []).forEach(function (c) {
          out.push({
            id: c.id,
            label: (b.group ? b.group.name + " / " : "") + c.name,
            available: self.categoryAvailable(c.id),
          });
        });
      });
      return out;
    },
    _assignedFor(catId) {
      if (!catId) return 0;
      return this.$store.budget.assignedFor(catId, this.$store.budget.currentMonth) || 0;
    },
    openMoveMoney(c) {
      this.moveMoneyForm = { fromId: c ? c.id : "", toId: "", amount: "" };
      this.moveMoneyOpen = true;
    },
    submitMoveMoney() {
      var f = this.moveMoneyForm;
      if (!f.fromId || !f.toId || f.fromId === f.toId) return;
      var cents = this.parseDollars(f.amount);
      if (cents <= 0) return;
      var ok = this.$store.budget.moveMoney(
        f.fromId, f.toId, cents, this.$store.budget.currentMonth
      );
      if (ok) {
        var fromName = this.$store.budget.categoryName(f.fromId);
        var toName = this.$store.budget.categoryName(f.toId);
        this.$store.budget.pushToast(
          "Moved " + this.formatCents(cents) + " · " + fromName + " → " + toName + "."
        );
        this.moveMoneyOpen = false;
        this.moveMoneyForm = { fromId: "", toId: "", amount: "" };
      }
    },
    applyAutoAssign() {
      if (!this.autoAssignChoice) return;
      var plan = this._autoAssignPlan(this.autoAssignChoice);
      var ids = Object.keys(plan.cats);
      if (!ids.length) { this.autoAssignOpen = false; return; }
      var self = this;
      var month = this.$store.budget.currentMonth;
      var scope = this.autoAssignScope || { kind: "all", name: "All categories" };
      var scopeLabel = scope.kind === "category" ? "the " + scope.name + " category"
                     : scope.kind === "group"    ? scope.name
                     : "every category";
      window.PBDialog.confirm({
        title: "Apply auto-assign?",
        message: "This will overwrite the Assigned column for " + ids.length +
                 " categor" + (ids.length === 1 ? "y" : "ies") +
                 " in " + scopeLabel + " for " + this.monthHeaderLabel() +
                 " with the chosen strategy. Your existing assignments are replaced.",
        confirmLabel: "Apply auto-assign",
      }).then(function (ok) {
        if (!ok) return;
        ids.forEach(function (catId) {
          self.$store.budget.assign(catId, month, plan.cats[catId]);
        });
        self.$store.budget.pushToast("Auto-assigned " + ids.length + " categor" + (ids.length === 1 ? "y" : "ies") + ".");
        self.autoAssignOpen = false;
        self.autoAssignChoice = "";
      });
    },

    /* ---- Activity drill-down ---- */
    openActivity(scope) {
      if (!scope) return;
      this.activityScope = Object.assign(
        { kind: "category", id: null, name: "", categoryIds: null },
        scope
      );
      this.activityOpen = true;
    },
    monthHeaderLabel() {
      var m = this.$store.budget.currentMonth || "";
      var parts = m.split("-").map(Number);
      if (parts.length < 2) return m;
      var d = new Date(parts[0], parts[1] - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    },
    /* Returns flat list of transactions matching the active scope and
       the currently-active budget month. Splits are expanded so each
       leg counts only against its own category. */
    activityTxns() {
      void this.$store.budget._listVersion;
      var p = this.$store.budget.profile;
      if (!p) return [];
      var month = this.$store.budget.currentMonth;
      var scope = this.activityScope || {};
      var wantedIds = null;
      if (scope.kind === "category") wantedIds = [scope.id];
      else if (scope.kind === "group") wantedIds = (scope.categoryIds || []);
      /* kind === 'all' leaves wantedIds null = match everything. */
      var wantedSet = wantedIds ? new Set(wantedIds.filter(Boolean)) : null;

      var out = [];
      (p.transactions || []).forEach(function (t) {
        if ((t.date || "").slice(0, 7) !== month) return;
        if (t.transferTxnId) return; /* skip transfer pairs */
        if (t.splits && t.splits.length) {
          t.splits.forEach(function (s, i) {
            if (wantedSet && !wantedSet.has(s.categoryId)) return;
            out.push({
              id: t.id, splitKey: "s" + i,
              date: t.date, accountId: t.accountId, payeeId: t.payeeId,
              categoryId: s.categoryId, memo: s.memo || t.memo || "",
              amount: s.amount,
            });
          });
        } else {
          if (wantedSet && !wantedSet.has(t.categoryId)) return;
          out.push(t);
        }
      });
      /* Newest first — matches register's default sort. */
      out.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      return out;
    },
    activityTotal() {
      return this.activityTxns().reduce(function (s, t) { return s + (t.amount || 0); }, 0);
    },
    /* Click any row in the drill-down to jump straight to that
       transaction in the register, filtered by account and anchored
       by the transaction id. The register reads ?focus= and scrolls
       the matching row into view + highlights it. */
    openInRegister(t) {
      if (!t || !t.id) return;
      var qs = "?account=" + encodeURIComponent(t.accountId || "") +
               "&focus="   + encodeURIComponent(t.id);
      this.activityOpen = false;
      window.location.assign("/app/register/" + qs);
    },

    /* ---- Inline group + category edits --------------------------- */
    submitNewGroup() {
      var name = (this.newGroupName || "").trim();
      if (!name) return;
      this.$store.budget.addCategoryGroup(name);
      this.newGroupOpen = false;
      this.newGroupName = "";
      this.$store.budget.pushToast("Group created.");
    },
    addCategoryTo(group) {
      if (!group) return;
      this.newCatGroupId = group.id;
      this.newCatGroupName = group.name;
      this.newCatName = "";
      this.newCatOpen = true;
    },
    submitNewCategory() {
      var name = (this.newCatName || "").trim();
      if (!name || !this.newCatGroupId) return;
      this.$store.budget.addCategory({ name: name, groupId: this.newCatGroupId });
      this.newCatOpen = false;
      this.newCatName = "";
      this.$store.budget.pushToast("Category added.");
    },
    openRenameGroup(group) {
      if (!group) return;
      this.renameKind = "group";
      this.renameTargetId = group.id;
      this.renameName = group.name;
      this.renameOpen = true;
    },
    openRename(c) {
      if (!c) return;
      this.renameKind = "category";
      this.renameTargetId = c.id;
      this.renameName = c.name;
      this.renameOpen = true;
    },
    submitRename() {
      var n = (this.renameName || "").trim();
      if (!n || !this.renameTargetId) return;
      if (this.renameKind === "group") {
        this.$store.budget.renameCategoryGroup(this.renameTargetId, n);
        this.$store.budget.pushToast("Group renamed.");
      } else {
        this.$store.budget.renameCategory(this.renameTargetId, n);
        this.$store.budget.pushToast("Category renamed.");
      }
      this.renameOpen = false;
      this.renameTargetId = null;
    },

    deleteGroup(group) {
      if (!group) return;
      this.deleteGroupId = group.id;
      this.deleteGroupName = group.name;
    },
    confirmDeleteGroup() {
      if (!this.deleteGroupId) return;
      this.$store.budget.deleteCategoryGroup(this.deleteGroupId);
      this.$store.budget.pushToast("Group deleted.");
      this.deleteGroupId = null;
    },
    deleteCategoryRow(c) {
      if (!c) return;
      this.deleteCatId = c.id;
      this.deleteCatName = c.name;
    },
    confirmDeleteCategory() {
      if (!this.deleteCatId) return;
      this.$store.budget.deleteCategory(this.deleteCatId);
      this.$store.budget.pushToast("Category deleted.");
      this.deleteCatId = null;
    },

    /* ---- Goal modal — handlers for the budget page's goal-edit form ----- */
    goalTypeHint() {
      switch (this.goalForm.type) {
        case "monthlyFixed": return "Assign at least this amount every month.";
        case "monthlyTopUp": return "Add this amount on top of whatever rolled over from last month.";
        case "refillUpTo":   return "After spending, top the category balance back up to this number.";
        case "targetByDate": return "Save up to this number by the chosen date.";
      }
      return "";
    },
    openGoal(c) {
      if (!c) return;
      this.goalCatId = c.id;
      var g = this.$store.budget.findGoal(c.id);
      if (g) {
        this.goalForm = {
          type: g.type,
          target: ((g.target || 0) / 100).toFixed(2),
          byDate: g.byDate || "",
        };
      } else {
        this.goalForm = { type: "monthlyFixed", target: "", byDate: "" };
      }
    },
    saveGoal() {
      if (!this.goalCatId) return;
      this.$store.budget.addGoal({
        categoryId: this.goalCatId,
        type: this.goalForm.type,
        target: this.parseDollars(this.goalForm.target),
        byDate: this.goalForm.byDate || null,
      });
      this.$store.budget.pushToast("Goal saved.");
      this.goalCatId = null;
    },
    removeGoal() {
      if (!this.goalCatId) return;
      this.$store.budget.removeGoal(this.goalCatId);
      this.$store.budget.pushToast("Goal removed.");
      this.goalCatId = null;
    },

    /* ---- Goal status helpers (data for the status panel) ---- */
    goalCurrentTarget() {
      var g = this.goalCatId && this.$store.budget.findGoal(this.goalCatId);
      return g ? (g.target || 0) : 0;
    },
    goalPctForModal() {
      var g = this.goalCatId && this.$store.budget.findGoal(this.goalCatId);
      if (!g || !g.target) return 0;
      var assigned = this.$store.budget.assignedFor(this.goalCatId, this.$store.budget.currentMonth) || 0;
      return Math.max(0, Math.min(999, Math.round((assigned / g.target) * 100)));
    },
    goalStatusTooltip() {
      var pct = this.goalPctForModal();
      var assigned = this.$store.budget.assignedFor(this.goalCatId, this.$store.budget.currentMonth) || 0;
      var target = this.goalCurrentTarget();
      return pct + "% funded · " + this.formatCents(assigned) + " of " + this.formatCents(target) + " target";
    },
    goalNarrative() {
      var g = this.goalCatId && this.$store.budget.findGoal(this.goalCatId);
      if (!g) return "";
      var need = this.$store.budget.goalNeeded(this.goalCatId) || 0;
      var pct = this.goalPctForModal();
      var name = this.$store.budget.categoryName(this.goalCatId);
      if (need <= 0) return "Goal fully funded for this month. Nothing more needed.";
      if (pct === 0) return "No dollars assigned yet — assign " + this.formatCents(need) + " to reach the target.";
      return "You're " + pct + "% there. " + this.formatCents(need) + " more would reach the target for " + name + ".";
    },
    goalDateHint() {
      if (this.goalForm.type !== "targetByDate" || !this.goalForm.byDate) return "";
      var target = new Date(this.goalForm.byDate);
      var today = new Date();
      var monthsBetween = (target.getFullYear() - today.getFullYear()) * 12
                       + (target.getMonth() - today.getMonth());
      if (monthsBetween <= 0) return "Target date is in the past or this month.";
      var amount = this.parseDollars(this.goalForm.target);
      if (amount <= 0) return "";
      var perMonth = Math.round(amount / monthsBetween);
      return "~" + this.formatCents(perMonth) + " per month for " + monthsBetween + " month" + (monthsBetween === 1 ? "" : "s") + ".";
    },

    /* Drag/drop handled by SortableJS via
       /assets/js/ui/sortable-bind.js. Markup carries data-sortable-*. */

    get hasCategories() {
      return !!(this.$store.budget.profile && this.$store.budget.profile.categories.length);
    },

    rtaCents() {
      return this.$store.budget.readyToAssign(this.$store.budget.currentMonth);
    },

    formatCents(c) {
      return ((c || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    },

    /* Blurred display value — full currency formatting so row Assigned
       lines up visually with the group total and the Available column
       (both formatted as $X,XXX.XX). On focus we swap to formatPlain
       so the user types bare digits without fighting the $ / comma. */
    formatAssigned(c) {
      return ((c || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    },

    /* Focused edit value — bare digits + decimal, no $, no commas.
       parseDollars accepts either form on blur. */
    formatPlain(c) {
      return ((c || 0) / 100).toFixed(2);
    },

    parseDollars(s) {
      if (s == null || s === "") return 0;
      if (window.PBCalc) {
        var v = window.PBCalc.parseAmountCents(s);
        if (isFinite(v)) return v;
      }
      var clean = String(s).replace(/[$,\s]/g, "").trim();
      if (/^\(.*\)$/.test(clean)) clean = "-" + clean.slice(1, -1);
      var n = Number(clean);
      return isFinite(n) ? Math.round(n * 100) : 0;
    },
    calcPreview(s) { return (window.PBCalc ? window.PBCalc.formatExpressionPreview(s) : ""); },

    commitAssign(catId, raw) {
      var cents = this.parseDollars(raw);
      this.$store.budget.assign(catId, this.$store.budget.currentMonth, cents);
    },

    categoryAvailable(catId) {
      void this.$store.budget._listVersion;
      return this.$store.budget.categoryRow(catId).available;
    },

    availableClass(catId) {
      var v = this.categoryAvailable(catId);
      if (v > 0) return "budget__available--green";
      if (v === 0) return "budget__available--zero";
      return "budget__available--red";
    },

    /* Pill color for the Available column:
       - red    : overspent (v < 0)
       - zero   : muted gray (v === 0)
       - green  : funded toward a goal (goal exists and met)
       - blue   : positive but no goal threshold (default funded)
    */
    availablePillClass(catId) {
      var v = this.categoryAvailable(catId);
      if (v < 0) return "available-pill--red";
      if (v === 0) return "available-pill--zero";
      var goal = this.$store.budget.findGoal(catId);
      if (goal) {
        var status = this.$store.budget.goalStatus(catId);
        if (status === "funded" || status === "over") return "available-pill--green";
      }
      return "available-pill--blue";
    },
    /* Same color rules but driven by a sum across multiple categories
       (a group's total). Skips the per-cat goal check — at group
       level there's no single goal to evaluate; positive sums get
       blue, negative red, zero muted. */
    groupAvailablePillClass(cats) {
      var v = this.groupTotalAvailable(cats);
      if (v < 0) return "available-pill--red";
      if (v === 0) return "available-pill--zero";
      return "available-pill--blue";
    },

    /* Touching _listVersion forces these aggregations to re-evaluate
       on any store mutation, even when the dependency chain crosses
       a function boundary that Alpine's proxy traversal might not
       catch (categoryRow -> assigned across multiple months). */
    groupTotalAssigned(cats) {
      void this.$store.budget._listVersion;
      var self = this;
      return cats.reduce(function (sum, c) { return sum + self.$store.budget.assignedFor(c.id); }, 0);
    },

    groupTotalActivity(cats) {
      void this.$store.budget._listVersion;
      var self = this;
      return cats.reduce(function (sum, c) { return sum + self.$store.budget.activityFor(c.id); }, 0);
    },

    groupTotalAvailable(cats) {
      void this.$store.budget._listVersion;
      var self = this;
      return cats.reduce(function (sum, c) { return sum + self.$store.budget.categoryRow(c.id).available; }, 0);
    },

    /* Month-wide totals for the bottom summary row. */
    monthlyOutflowTotal() {
      void this.$store.budget._listVersion;
      var p = this.$store.budget.profile;
      if (!p) return 0;
      var self = this;
      return p.categories.reduce(function (sum, c) { return sum + self.$store.budget.activityFor(c.id); }, 0);
    },
    monthlyAvailableTotal() {
      void this.$store.budget._listVersion;
      var p = this.$store.budget.profile;
      if (!p) return 0;
      var self = this;
      return p.categories.reduce(function (sum, c) { return sum + self.$store.budget.categoryRow(c.id).available; }, 0);
    },

    goalLabel(catId) {
      var n = this.$store.budget.goalNeeded(catId);
      if (n === 0) return "Funded";
      return "Need " + this.formatCents(n);
    },

    /* Goal progress bar — % of the goal target funded this month.
       Uses assigned (not available) so the bar reflects what the user
       committed *this period*, not carry-over from prior months. */
    goalPercent(catId) {
      void this.$store.budget._listVersion;
      var g = this.$store.budget.findGoal(catId);
      if (!g || !g.target) return 0;
      var assigned = this.$store.budget.assignedFor(catId);
      var pct = (assigned / g.target) * 100;
      if (!isFinite(pct) || pct < 0) pct = 0;
      return Math.round(Math.min(100, pct));
    },
    goalBarClass(catId) {
      var pct = this.goalPercent(catId);
      if (pct >= 100) return "goal-bar--funded";
      if (pct >= 50)  return "goal-bar--accent";
      return "goal-bar--muted";
    },
    goalBarTooltip(catId) {
      var g = this.$store.budget.findGoal(catId);
      if (!g || !g.target) return "";
      var assigned = this.$store.budget.assignedFor(catId);
      var pct = this.goalPercent(catId);
      return pct + "% funded: " + this.formatCents(assigned) + " of " + this.formatCents(g.target);
    },

    /* ---- Month strip helpers ----------------------------------------
       The strip shows the 12 months of the year currently being viewed.
       Year arrows shift the view a year forward / back, keeping the same
       month-of-year if possible. */
    currentYear() {
      var parts = (this.$store.budget.currentMonth || "").split("-");
      return parseInt(parts[0], 10) || new Date().getFullYear();
    },
    currentMonthNumber() {
      var parts = (this.$store.budget.currentMonth || "").split("-");
      return parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    },
    monthsOfYear() {
      var year = this.currentYear();
      var labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return labels.map(function (label, i) {
        var mm = String(i + 1).padStart(2, "0");
        return { value: year + "-" + mm, label: label };
      });
    },
    thisMonthValue() {
      var d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    },
    prevYearMonth() {
      var y = this.currentYear() - 1;
      var m = String(this.currentMonthNumber()).padStart(2, "0");
      return y + "-" + m;
    },
    nextYearMonth() {
      var y = this.currentYear() + 1;
      var m = String(this.currentMonthNumber()).padStart(2, "0");
      return y + "-" + m;
    },
    /* Single-step month nav for the mobile month strip — wraps year
       boundaries cleanly so December → next January and vice versa. */
    prevMonthValue() {
      var y = this.currentYear();
      var m = this.currentMonthNumber() - 1;
      if (m < 1) { y -= 1; m = 12; }
      return y + "-" + String(m).padStart(2, "0");
    },
    nextMonthValue() {
      var y = this.currentYear();
      var m = this.currentMonthNumber() + 1;
      if (m > 12) { y += 1; m = 1; }
      return y + "-" + String(m).padStart(2, "0");
    },
    prevYearLabel() { return String(this.currentYear() - 1); },
    nextYearLabel() { return String(this.currentYear() + 1); },

    /* ---- Credit card payment pools ----------------------------------
       For each credit account, find its paired payment category, read
       the available amount (the pool), and compare to the absolute
       negative balance (the debt). */
    paymentPools() {
      void this.$store.budget._listVersion;
      var store = this.$store.budget;
      var p = store.profile;
      if (!p) return [];
      var self = this;
      var creditAccts = (p.accounts || []).filter(function (a) {
        return a.type === "credit" && !a.closedAt;
      });
      return creditAccts.map(function (a) {
        var balance = store.accountBalance(a.id);
        var debt = balance < 0 ? -balance : 0;
        var map = (p.settings && p.settings.creditCardPaymentMap) || {};
        var payCatId = map[a.id] || null;
        var pool = payCatId ? store.categoryRow(payCatId).available : 0;
        var coveragePct = debt > 0 ? Math.round((Math.max(pool, 0) / debt) * 100) : 100;
        return {
          accountId: a.id,
          accountName: a.name,
          payCatId: payCatId,
          pool: pool,
          debt: debt,
          coveragePct: coveragePct,
        };
      });
    },
    poolCardClass(p) {
      if (p.debt === 0) return "pool-card--clear";
      if (p.coveragePct >= 100) return "pool-card--covered";
      return "pool-card--short";
    },
    poolPillClass(p) {
      if (p.pool < 0) return "available-pill--red";
      if (p.debt === 0) return "available-pill--green";
      if (p.coveragePct >= 100) return "available-pill--green";
      return "available-pill--blue";
    },
    poolBarClass(p) {
      if (p.coveragePct >= 100) return "pool-card__progress-bar--full";
      if (p.coveragePct >= 50)  return "pool-card__progress-bar--mid";
      return "pool-card__progress-bar--low";
    },
    poolCoverageLabel(p) {
      if (p.debt === 0) return "Balance paid off.";
      if (p.coveragePct >= 100) return "100% of your debt is covered.";
      var remaining = p.debt - Math.max(p.pool, 0);
      return this.formatCents(remaining) + " of debt is remaining.";
    },
  };
}

  window.budgetView = budgetView;
})();
