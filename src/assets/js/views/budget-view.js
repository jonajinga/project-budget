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
      this.$nextTick(function () {
        var el = document.querySelector('[data-group-id="' + group.id + '"] .overflow-menu__trigger');
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
        var el = document.querySelector('[data-cat-id="' + c.id + '"] .overflow-menu__trigger');
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

    /* Inline-edit modal state — create / rename / delete for groups
       and categories. Goal editing and row-path move-money moved into
       the inspector (phase 3). */
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
    /* Goal form state — lives in the inspector, keyed on sel. */
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
    /* Move-money form — lives in the inspector (phase 3); the modal
       it once drove is gone. */
    moveMoneyForm: { fromId: "", toId: "", amount: "", month: "" },

    /* ---- Inspector (phase 3) ------------------------------------
       sel = { catId, month } | null. Docked as a persistent pane at
       >=1024px (collapsible - an open pane caps the month columns at
       2, because pane + 3 columns physically cannot share 1280px);
       a bottom sheet below 1024. */
    sel: null,
    inspectorDocked: false,
    inspectorOpen: true,
    noteDraft: "",
    renameEditing: false,
    renameDraft: "",
    selectCategory(c, month) {
      var id = c && c.id ? c.id : c;
      if (!id) return;
      this.sel = { catId: id, month: month || this.$store.budget.currentMonth };
      if (this.inspectorDocked && !this.inspectorOpen) this.setInspectorOpen(true);
      this._loadInspectorState();
    },
    clearSel() { this.sel = null; this.overviewOpen = false; },
    setInspectorOpen(open) {
      this.inspectorOpen = !!open;
      try { localStorage.setItem("projectbudget:budget-inspector-open", open ? "1" : "0"); } catch (_e) {}
    },
    selCategory() {
      void this.$store.budget._listVersion;
      return this.sel ? this.$store.budget.findCategory(this.sel.catId) : null;
    },
    selRow() {
      void this.$store.budget._listVersion;
      return this.sel ? this.$store.budget.categoryRow(this.sel.catId, this.sel.month) : null;
    },
    _loadInspectorState() {
      if (!this.sel) return;
      var s = this.$store.budget;
      var cat = s.findCategory(this.sel.catId);
      this.noteDraft = (cat && cat.note) || "";
      this.renameDraft = (cat && cat.name) || "";
      this.renameEditing = false;
      var g = s.findGoal(this.sel.catId);
      this.goalForm = g
        ? { type: g.type, target: ((g.target || 0) / 100).toFixed(2), byDate: g.byDate || "" }
        : { type: "monthlyFixed", target: "", byDate: "" };
      this.moveMoneyForm = { fromId: this.sel.catId, toId: "", amount: "", month: this.sel.month };
      this._loadCutForm();
    },
    commitNote() {
      if (!this.sel) return;
      if (this.$store.budget.setCategoryNote(this.sel.catId, this.noteDraft)) {
        this.$store.budget.pushToast("Note saved.");
      }
    },
    commitInspectorRename() {
      if (!this.sel || !this.renameEditing) return;
      var n = (this.renameDraft || "").trim();
      this.renameEditing = false;
      if (!n || n === (this.selCategory() || {}).name) return;
      this.$store.budget.renameCategory(this.sel.catId, n);
      this.$store.budget.pushToast("Category renamed.");
    },
    /* The 5 newest transactions for the selected category + month. */
    inspectorTxns() {
      void this.$store.budget._listVersion;
      var p = this.$store.budget.profile;
      if (!p || !this.sel) return [];
      var catId = this.sel.catId;
      var month = this.sel.month;
      var out = [];
      (p.transactions || []).forEach(function (t) {
        if ((t.date || "").slice(0, 7) !== month) return;
        if (t.transferTxnId) return;
        if (t.splits && t.splits.length) {
          t.splits.forEach(function (sp, i) {
            if (sp.categoryId !== catId) return;
            out.push({ id: t.id, splitKey: "s" + i, date: t.date, payeeId: t.payeeId, amount: sp.amount });
          });
        } else if (t.categoryId === catId) {
          out.push(t);
        }
      });
      out.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      return out.slice(0, 5);
    },

    /* ---- Quick fills + month overview + hide (phase 4) ---------- */
    overviewOpen: false,
    hiddenOpen: false,
    openOverview() {
      this.sel = null;
      if (this.inspectorDocked) this.setInspectorOpen(true);
      else this.overviewOpen = true;
    },
    closeInspectorSurface() {
      this.sel = null;
      this.overviewOpen = false;
    },
    rtaBreak() {
      void this.$store.budget._listVersion;
      return this.$store.budget.rtaBreakdown(this.$store.budget.currentMonth);
    },
    /* The four one-click fills for the SELECTED category + month.
       Kind maps to the store quick helpers; every write goes through
       applyAssignments (one undo entry, one save). */
    quickFillValue(kind) {
      if (!this.sel) return 0;
      var s = this.$store.budget;
      var id = this.sel.catId;
      var m = this.sel.month;
      if (kind === "goal") return s.findGoal(id) ? (s.quickGoalTarget(id, m) || 0) : 0;
      if (kind === "last-assigned") return s.quickLastMonthAssigned(id, m) || 0;
      if (kind === "last-spent") return s.quickLastMonthSpent(id, m) || 0;
      if (kind === "avg-3") return s.quickAvg(id, m, 3) || 0;
      return 0;
    },
    applyQuickFill(kind, label) {
      if (!this.sel) return;
      var v = this.quickFillValue(kind);
      if (v <= 0) return;
      var s = this.$store.budget;
      var map = {};
      /* The goal fill ADDS what is still needed; the others REPLACE. */
      map[this.sel.catId] = kind === "goal"
        ? (s.assignedFor(this.sel.catId, this.sel.month) || 0) + v
        : v;
      s.applyAssignments(map, this.sel.month, label);
      s.pushToast(label + ": " + this.formatCents(map[this.sel.catId]) + " assigned.");
    },
    /* Overspent (available < 0) non-payment categories for a month. */
    overspentCategories(month) {
      void this.$store.budget._listVersion;
      var s = this.$store.budget;
      var p = s.profile;
      if (!p) return [];
      var m = month || s.currentMonth;
      var out = [];
      (p.categories || []).forEach(function (c) {
        if (c.hidden || s.isPaymentCategory(c.id)) return;
        var row = s.categoryRow(c.id, m);
        if (row.available < 0) out.push({ id: c.id, name: c.name, deficit: -row.available });
      });
      out.sort(function (a, b) { return b.deficit - a.deficit; });
      return out;
    },
    /* Suggested donor: the visible, non-payment, non-income category
       with the most Available this month. */
    coverDonor(excludeId, month) {
      void this.$store.budget._listVersion;
      var s = this.$store.budget;
      var p = s.profile;
      if (!p) return null;
      var m = month || s.currentMonth;
      var best = null;
      (p.categories || []).forEach(function (c) {
        if (c.id === excludeId || c.hidden) return;
        if (s.isPaymentCategory(c.id) || s.isIncomeCategory(c.id)) return;
        var avail = s.categoryRow(c.id, m).available;
        if (avail > 0 && (!best || avail > best.available)) best = { id: c.id, name: c.name, available: avail };
      });
      return best;
    },
    coverOverspent(catId, month) {
      var s = this.$store.budget;
      var m = month || s.currentMonth;
      var deficit = -s.categoryRow(catId, m).available;
      if (deficit <= 0) return;
      var donor = this.coverDonor(catId, m);
      if (!donor) { s.pushToast("No category has money available to cover from.", "danger"); return; }
      if (s.moveMoney(donor.id, catId, deficit, m)) {
        s.pushToast("Covered " + this.formatCents(deficit) + " from " + donor.name + ".");
      }
    },
    /* ---- Reduction planning (phase 6) ---- */
    cutForm: { mode: "percent", value: "", goalLabel: "", targetMonth: "" },
    _loadCutForm() {
      var cut = this.sel ? this.$store.budget.cutForCategory(this.sel.catId) : null;
      this.cutForm = cut
        ? { mode: cut.mode,
            value: cut.mode === "percent" ? String(cut.value / 100) : ((cut.value || 0) / 100).toFixed(2),
            goalLabel: cut.goalLabel || "",
            targetMonth: cut.targetMonth || "" }
        : { mode: "percent", value: "", goalLabel: "", targetMonth: "" };
    },
    saveCut() {
      if (!this.sel) return;
      var s = this.$store.budget;
      var raw = this.cutForm.value;
      var value = this.cutForm.mode === "percent"
        ? Math.round((parseFloat(raw) || 0) * 100)   /* 25 -> 2500 bp */
        : this.parseDollars(raw);
      if (value <= 0) return;
      s.addCut({
        categoryId: this.sel.catId,
        mode: this.cutForm.mode,
        value: value,
        goalLabel: this.cutForm.goalLabel,
        targetMonth: this.cutForm.targetMonth || null,
      });
      s.pushToast("Cut planned for " + s.categoryName(this.sel.catId) + ".");
    },
    removeCutSelected() {
      if (!this.sel) return;
      var s = this.$store.budget;
      var cut = s.cutForCategory(this.sel.catId);
      if (cut && s.removeCut(cut.id)) {
        s.pushToast("Cut removed.");
        this._loadCutForm();
      }
    },
    cutBadgeText(catId) {
      void this.$store.budget._listVersion;
      var s = this.$store.budget;
      var cut = s.cutForCategory(catId);
      if (!cut) return "";
      return "-" + this.formatCents(s.cutTargetFor(cut.id)) + "/mo";
    },

    hideSelected() {
      if (!this.sel) return;
      var s = this.$store.budget;
      var name = s.categoryName(this.sel.catId);
      if (s.setCategoryHidden(this.sel.catId, true)) {
        s.pushToast(name + " hidden. Its money stays counted; unhide it from the list below the grid.");
        this.closeInspectorSurface();
      }
    },

    /* ---- Roving tabindex over the Assigned cells (phase 5) ------
       The register grid's proven pattern: exactly ONE cell tabbable,
       arrows move the roving point, Enter or a digit starts the edit,
       Escape cancels without committing. Focus is applied
       SYNCHRONOUSLY (the register's _focusCellNode lesson: deferring
       to $nextTick drops arrow keypresses mid-hold). */
    focusCell: { catId: null, month: null },
    _editCancel: false,
    _returnFocus: false,
    /* Visible, editable categories in grid order: collapsed groups and
       read-only rows (income, payment pools) are skipped. */
    flattenedNavCats() {
      void this.$store.budget._listVersion;
      var s = this.$store.budget;
      var self = this;
      var out = [];
      (s.categoryGroupsView() || []).forEach(function (b) {
        if (b.group && s.isCatGroupCollapsed(b.group.id)) return;
        (b.categories || []).forEach(function (c) {
          if (self.assignReadOnly(c)) return;
          out.push(c.id);
        });
      });
      return out;
    },
    _rovingCell() {
      var months = this.visibleMonths();
      if (this.focusCell.catId
          && months.indexOf(this.focusCell.month) !== -1
          && this.flattenedNavCats().indexOf(this.focusCell.catId) !== -1) {
        return this.focusCell;
      }
      var cats = this.flattenedNavCats();
      if (!cats.length) return { catId: null, month: null };
      return { catId: cats[0], month: months[0] };
    },
    cellTabIndex(catId, month) {
      var r = this._rovingCell();
      return r.catId === catId && r.month === month ? 0 : -1;
    },
    setFocusCell(catId, month) {
      this.focusCell = { catId: catId, month: month };
      /* Follow the roving point in the inspector - but never FORCE the
         pane open (the user may have closed it for the third column). */
      if (this.inspectorDocked && this.inspectorOpen) {
        this.sel = { catId: catId, month: month };
        this._loadInspectorState();
      }
    },
    _focusCellNode(catId, month) {
      var q = '.budget__row[data-cat-id="' + catId + '"] .budget__assigned[data-month="' + month + '"]';
      var el = document.querySelector(q);
      if (el && el.focus) { el.focus(); return; }
      this.$nextTick(function () {
        var late = document.querySelector(q);
        if (late && late.focus) late.focus();
      });
    },
    onCellKeydown(c, vm, e) {
      /* keydown bubbles from the cell's own input; only handle keys
         pressed ON the cell itself. */
      if (e.target !== e.currentTarget) return;
      var months = this.visibleMonths();
      var cats = this.flattenedNavCats();
      var col = months.indexOf(vm);
      var row = cats.indexOf(c.id);
      if (col === -1 || row === -1) return;
      if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        this._startCellEdit(c.id, vm, e.key);
        return;
      }
      var nc = col;
      var nr = row;
      switch (e.key) {
        case "ArrowRight": nc = Math.min(months.length - 1, col + 1); break;
        case "ArrowLeft":  nc = Math.max(0, col - 1); break;
        case "ArrowDown":  nr = Math.min(cats.length - 1, row + 1); break;
        case "ArrowUp":    nr = Math.max(0, row - 1); break;
        case "Home":       nc = 0; break;
        case "End":        nc = months.length - 1; break;
        case "Enter":
        case " ":
          e.preventDefault();
          this._startCellEdit(c.id, vm, null);
          return;
        default: return;
      }
      e.preventDefault();
      this.setFocusCell(cats[nr], months[nc]);
      this._focusCellNode(cats[nr], months[nc]);
    },
    _startCellEdit(catId, vm, seedKey) {
      var input = document.querySelector(
        '.budget__row[data-cat-id="' + catId + '"] .budget__assigned[data-month="' + vm + '"] input'
      );
      if (!input) return;
      input.focus(); /* the input's @focus swaps to plain digits + select() */
      if (seedKey != null) input.value = seedKey;
    },
    onAssignKeyEnter(e) { this._returnFocus = true; e.target.blur(); },
    onAssignKeyEscape(e) { this._editCancel = true; this._returnFocus = true; e.target.blur(); },
    onAssignBlur(c, vm, e) {
      if (this._editCancel) {
        this._editCancel = false;
        e.target.value = this.formatAssigned(this.$store.budget.assignedFor(c.id, vm));
      } else {
        this.commitAssign(c.id, vm, e.target.value);
        e.target.value = this.formatAssigned(this.$store.budget.assignedFor(c.id, vm));
      }
      if (this._returnFocus) {
        this._returnFocus = false;
        this.focusCell = { catId: c.id, month: vm };
        this._focusCellNode(c.id, vm);
      }
    },

    /* ---- Multi-month columns (phase 2) --------------------------
       The anchor is ALWAYS $store.budget.currentMonth (the leftmost
       column); extra columns run forward. monthCount is the user's
       preference; the viewport clamps it (below 900px: 1, 900-1279:
       2, >=1280: 3) so phones never render parallel columns. */
    monthCount: 1,
    viewportMaxMonths: 1,
    _stickyTop: 0,
    setMonthCount(n) {
      n = Math.max(1, Math.min(3, n | 0));
      this.monthCount = n;
      try { localStorage.setItem("projectbudget:budget-month-count", String(n)); } catch (_e) {}
    },
    effectiveMonthCount() {
      var max = this.viewportMaxMonths;
      /* An open docked inspector (21rem) + three month columns cannot
         share 1280px - the grid's minimums alone overflow. Close the
         pane to unlock the third column. */
      if (this.inspectorDocked && this.inspectorOpen && max > 2) max = 2;
      return Math.min(this.monthCount, max);
    },
    _nextMonthOf(iso) {
      var p = (iso || "").split("-").map(Number);
      var y = p[0], m = p[1] + 1;
      if (m > 12) { y += 1; m = 1; }
      return y + "-" + String(m).padStart(2, "0");
    },
    visibleMonths() {
      var out = [this.$store.budget.currentMonth];
      var n = this.effectiveMonthCount();
      while (out.length < n) out.push(this._nextMonthOf(out[out.length - 1]));
      return out;
    },
    monthColClass() {
      var n = this.effectiveMonthCount();
      return n === 3 ? "budget--m3" : n === 2 ? "budget--m2" : "";
    },
    monthShortLabel(m) {
      var p = (m || "").split("-").map(Number);
      if (!p[0]) return m;
      var d = new Date(p[0], p[1] - 1, 1);
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    },
    stickyTop() { return this._stickyTop; },

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
      /* Multi-month preference + viewport clamp. The matchMedia
         listeners are window-global, so the previous visit's pair is
         removed first — the router swaps this view in and out and
         Alpine has no destroy hook here. */
      try {
        var stored = parseInt(localStorage.getItem("projectbudget:budget-month-count"), 10);
        if (stored >= 1 && stored <= 3) this.monthCount = stored;
      } catch (_e) {}
      try {
        this.inspectorOpen = localStorage.getItem("projectbudget:budget-inspector-open") !== "0";
      } catch (_e) {}
      var mq2 = window.matchMedia("(min-width: 900px)");
      var mq3 = window.matchMedia("(min-width: 1280px)");
      /* Dock threshold 1180, not 1024: sidebar (260) + pane (336)
         leave ~370px of table at 1024 - unusable. Below 1180 the
         inspector presents as the bottom sheet instead. */
      var mqDock = window.matchMedia("(min-width: 1180px)");
      var setMax = function () {
        self.viewportMaxMonths = mq3.matches ? 3 : (mq2.matches ? 2 : 1);
        self.inspectorDocked = mqDock.matches;
      };
      var measureSticky = function () {
        var h = document.querySelector(".site-header");
        self._stickyTop = h ? h.offsetHeight : 0;
      };
      if (window.__pbBudgetViewCleanup) window.__pbBudgetViewCleanup();
      mq2.addEventListener("change", setMax);
      mq3.addEventListener("change", setMax);
      mqDock.addEventListener("change", setMax);
      window.addEventListener("resize", measureSticky);
      window.__pbBudgetViewCleanup = function () {
        mq2.removeEventListener("change", setMax);
        mq3.removeEventListener("change", setMax);
        mqDock.removeEventListener("change", setMax);
        window.removeEventListener("resize", measureSticky);
      };
      setMax();
      measureSticky();

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
          /* Keep the store's table horizon at the LAST visible column
             so one memoized budget table serves every column. */
          window.Alpine.effect(function () {
            var months = self.visibleMonths();
            s._budgetHorizon = months[months.length - 1];
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
      /* Each strategy delegates to the store's quick-assign helper —
         one implementation, shared with any future quick-fill UI. */
      allCats.forEach(function (c) {
        if (strategy === "goals") {
          if (!store.findGoal(c.id)) return;
          var need = store.quickGoalTarget(c.id, month) || 0;
          if (need > 0) add(c.id, need);
        } else if (strategy === "last-month-assigned") {
          var prevAssigned = store.quickLastMonthAssigned(c.id, month) || 0;
          if (prevAssigned > 0) add(c.id, prevAssigned);
        } else if (strategy === "last-month-spent") {
          var act = store.quickLastMonthSpent(c.id, month) || 0;
          if (act > 0) add(c.id, act);
        } else if (strategy === "avg-3-spent") {
          var avg = store.quickAvg(c.id, month, 3) || 0;
          if (avg > 0) add(c.id, avg);
        }
      });
      return { cats: cats, total: total };
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
      var m = this.moveMoneyForm.month || store.currentMonth;
      var view = store.categoryGroupsView() || [];
      var out = [];
      view.forEach(function (b) {
        (b.categories || []).forEach(function (c) {
          out.push({
            id: c.id,
            label: (b.group ? b.group.name + " / " : "") + c.name,
            available: self.categoryAvailable(c.id, m),
          });
        });
      });
      return out;
    },
    _assignedFor(catId) {
      if (!catId) return 0;
      var m = this.moveMoneyForm.month || this.$store.budget.currentMonth;
      return this.$store.budget.assignedFor(catId, m) || 0;
    },
    submitMoveMoney() {
      var f = this.moveMoneyForm;
      if (!f.fromId || !f.toId || f.fromId === f.toId) return;
      var cents = this.parseDollars(f.amount);
      if (cents <= 0) return;
      var ok = this.$store.budget.moveMoney(
        f.fromId, f.toId, cents, f.month || this.$store.budget.currentMonth
      );
      if (ok) {
        var fromName = this.$store.budget.categoryName(f.fromId);
        var toName = this.$store.budget.categoryName(f.toId);
        this.$store.budget.pushToast(
          "Moved " + this.formatCents(cents) + " · " + fromName + " → " + toName + "."
        );
        this.moveMoneyForm.toId = "";
        this.moveMoneyForm.amount = "";
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
        /* One store write for the whole plan — assign() in a loop
           records one undo entry and one save per category, which
           evicts the entire 50-entry undo history in one click. */
        self.$store.budget.applyAssignments(
          plan.cats, month, "Auto-assign (" + ids.length + ")"
        );
        self.$store.budget.pushToast("Auto-assigned " + ids.length + " categor" + (ids.length === 1 ? "y" : "ies") + ".");
        self.autoAssignOpen = false;
        self.autoAssignChoice = "";
      });
    },

    /* ---- Activity drill-down ---- */
    openActivity(scope) {
      if (!scope) return;
      this.activityScope = Object.assign(
        { kind: "category", id: null, name: "", categoryIds: null,
          month: this.$store.budget.currentMonth },
        scope
      );
      this.activityOpen = true;
    },
    monthHeaderLabel(month) {
      var m = month || this.$store.budget.currentMonth || "";
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
      var scope = this.activityScope || {};
      var month = scope.month || this.$store.budget.currentMonth;
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
    saveGoal() {
      if (!this.sel) return;
      var target = this.parseDollars(this.goalForm.target);
      if (target <= 0) return;
      this.$store.budget.addGoal({
        categoryId: this.sel.catId,
        type: this.goalForm.type,
        target: target,
        byDate: this.goalForm.byDate || null,
      });
      this.$store.budget.pushToast("Goal saved.");
    },
    removeGoal() {
      if (!this.sel) return;
      this.$store.budget.removeGoal(this.sel.catId);
      this.$store.budget.pushToast("Goal removed.");
      this.goalForm = { type: "monthlyFixed", target: "", byDate: "" };
    },

    /* ---- Goal status helpers (data for the status panel) ---- */
    goalNarrative() {
      if (!this.sel) return "";
      var s = this.$store.budget;
      var g = s.findGoal(this.sel.catId);
      if (!g) return "";
      var need = s.goalNeeded(this.sel.catId, this.sel.month) || 0;
      var pct = this.goalPercent(this.sel.catId, this.sel.month);
      var name = s.categoryName(this.sel.catId);
      if (need <= 0) return "Goal fully funded for this month. Nothing more needed.";
      if (pct === 0) return "No dollars assigned yet — assign " + this.formatCents(need) + " to reach the target.";
      return "You're " + pct + "% there. " + this.formatCents(need) + " more would reach the target for " + name + ".";
    },
    goalDateHint() {
      if (this.goalForm.type !== "targetByDate" || !this.goalForm.byDate) return "";
      /* Months remaining from the VIEWED month, inclusive of both
         endpoints - the same count domain/goals.js divides by. It was
         computed from new Date(), so the hint disagreed with the goal
         math whenever the user was viewing any month but the real one. */
      var fromMonth = (this.sel && this.sel.month) || this.$store.budget.currentMonth || "";
      var from = fromMonth.split("-").map(Number);
      var to = this.goalForm.byDate.split("-").map(Number);
      if (!from[0] || !to[0]) return "";
      var monthsLeft = (to[0] - from[0]) * 12 + ((to[1] || 1) - from[1]) + 1;
      if (monthsLeft <= 0) return "Target date is before the month you are viewing.";
      var amount = this.parseDollars(this.goalForm.target);
      if (amount <= 0) return "";
      var perMonth = Math.round(amount / monthsLeft);
      return "~" + this.formatCents(perMonth) + " per month for " + monthsLeft + " month" + (monthsLeft === 1 ? "" : "s") + ".";
    },

    /* Reordering is keyboard/menu driven (Move up / Move down in the
       row and group kebabs) — there is no drag-and-drop on this page. */

    /* Income categories are funded by their own transactions and
       payment pools by Move money — neither takes direct assignment
       (auto-assign and the bulk helpers already skip them), so the
       Assigned cell renders read-only for both. */
    assignReadOnly(c) {
      var s = this.$store.budget;
      return s.isPaymentCategory(c.id) || s.isIncomeCategory(c.id);
    },

    get hasCategories() {
      return !!(this.$store.budget.profile && this.$store.budget.profile.categories.length);
    },

    rtaCents(month) {
      return this.$store.budget.readyToAssign(month || this.$store.budget.currentMonth);
    },

    formatCents(c) {
      return ((c || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    },

    /* Grid display formatter. With 2-3 month columns on screen the
       cent-precision strings physically do not fit their tracks
       ("$444,488.86" needs ~85px against ~80px columns and the
       numbers collide), so multi-month mode displays whole dollars.
       Exact cents remain on input focus (formatPlain), in tooltips,
       aria-labels, the modals, and the single-month view. */
    fmtGrid(c) {
      if (this.effectiveMonthCount() <= 1) return this.formatCents(c);
      return Math.round((c || 0) / 100).toLocaleString("en-US", {
        style: "currency", currency: "USD", maximumFractionDigits: 0,
      });
    },

    /* Blurred display value — full currency formatting so row Assigned
       lines up visually with the group total and the Available column
       (both formatted as $X,XXX.XX). On focus we swap to formatPlain
       so the user types bare digits without fighting the $ / comma. */
    formatAssigned(c) {
      return this.fmtGrid(c);
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


    commitAssign(catId, month, raw) {
      var cents = this.parseDollars(raw);
      this.$store.budget.assign(catId, month || this.$store.budget.currentMonth, cents);
    },

    categoryAvailable(catId, month) {
      void this.$store.budget._listVersion;
      return this.$store.budget.categoryRow(catId, month).available;
    },

    /* Pill color for the Available column:
       - red    : overspent (v < 0)
       - zero   : muted gray (v === 0)
       - green  : funded toward a goal (goal exists and met)
       - blue   : positive but no goal threshold (default funded)
    */
    availablePillClass(catId, month) {
      var v = this.categoryAvailable(catId, month);
      if (v < 0) return "available-pill--red";
      if (v === 0) return "available-pill--zero";
      var goal = this.$store.budget.findGoal(catId);
      if (goal) {
        var status = this.$store.budget.goalStatus(catId, month);
        if (status === "funded" || status === "over") return "available-pill--green";
      }
      return "available-pill--blue";
    },
    /* Touching _listVersion forces these aggregations to re-evaluate
       on any store mutation, even when the dependency chain crosses
       a function boundary that Alpine's proxy traversal might not
       catch (categoryRow -> assigned across multiple months). */
    groupTotalAssigned(cats, month) {
      void this.$store.budget._listVersion;
      var self = this;
      return cats.reduce(function (sum, c) { return sum + self.$store.budget.assignedFor(c.id, month); }, 0);
    },

    groupTotalActivity(cats, month) {
      void this.$store.budget._listVersion;
      var self = this;
      return cats.reduce(function (sum, c) { return sum + self.$store.budget.activityFor(c.id, month); }, 0);
    },

    groupTotalAvailable(cats, month) {
      void this.$store.budget._listVersion;
      var self = this;
      return cats.reduce(function (sum, c) { return sum + self.$store.budget.categoryRow(c.id, month).available; }, 0);
    },

    /* Month-wide totals for the bottom summary row. */
    monthlyOutflowTotal(month) {
      void this.$store.budget._listVersion;
      var p = this.$store.budget.profile;
      if (!p) return 0;
      var self = this;
      return p.categories.reduce(function (sum, c) { return sum + self.$store.budget.activityFor(c.id, month); }, 0);
    },
    monthlyAvailableTotal(month) {
      void this.$store.budget._listVersion;
      var p = this.$store.budget.profile;
      if (!p) return 0;
      var self = this;
      return p.categories.reduce(function (sum, c) { return sum + self.$store.budget.categoryRow(c.id, month).available; }, 0);
    },

    goalLabel(catId) {
      var n = this.$store.budget.goalNeeded(catId);
      if (n === 0) return "Funded";
      return "Need " + this.formatCents(n);
    },

    /* Goal progress bar — derived from goalNeeded, the SAME measure
       the badge uses, so "Funded" always sits beside a full bar. A
       row previously mixed two measures (badge from goalNeeded, bar
       from assigned/target) and could read "Funded" over an 80% bar
       for refill goals. */
    goalPercent(catId, month) {
      void this.$store.budget._listVersion;
      var g = this.$store.budget.findGoal(catId);
      if (!g || !g.target) return 0;
      var needed = this.$store.budget.goalNeeded(catId, month) || 0;
      var pct = (1 - needed / g.target) * 100;
      if (!isFinite(pct) || pct < 0) pct = 0;
      return Math.round(Math.min(100, pct));
    },
    goalBarClass(catId, month) {
      var pct = this.goalPercent(catId, month);
      if (pct >= 100) return "goal-bar--funded";
      if (pct >= 50)  return "goal-bar--accent";
      return "goal-bar--muted";
    },
    goalBarTooltip(catId) {
      var g = this.$store.budget.findGoal(catId);
      if (!g || !g.target) return "";
      var needed = this.$store.budget.goalNeeded(catId) || 0;
      var pct = this.goalPercent(catId);
      if (needed <= 0) return "Goal met for this month.";
      return pct + "% funded: " + this.formatCents(needed) + " still needed";
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
