/* Alpine x-data factory for /app/register/.
   Extracted from register.njk so the template stays focused on
   markup. Exposed as a window-level global because Alpine reads
   x-data attributes via Function() and needs the symbol to be
   reachable from window. Load order in app.njk puts this script
   BEFORE alpine.min.js (both defer), so Alpine binds the factory
   on its first init. */
(function () {
  "use strict";

function registerView() {
  return {
    filterAccountId: "",
    search: "",
    showTransfer: false,
    showReconcile: false,
    editingId: null,
    payeeSuggestions: [],
    splitTxnId: null,
    splitForm: [],
    isMobile: false,
    expandedTxnId: null,
    showAdd: false,
    /* Multi-select state for bulk operations. selectMode gates the
       checkbox column; selectedTxnIds is the working set across page
       interactions. Exiting select mode clears the set. */
    selectMode: false,
    selectedTxnIds: [],
    /* Searchable account-filter combobox state. acctQuery is the
       typed search; acctComboOpen toggles the dropdown panel. */
    acctComboOpen: false,
    acctQuery: "",
    showBulkRecat: false,
    showBulkRename: false,
    showBulkShift: false,
    bulkRecatTarget: "",
    bulkRenameTarget: "",
    bulkShiftDelta: 0,

    form: { date: "", payeeName: "", amount: "", accountId: "", categoryId: "", memo: "", cleared: false },
    edit: { date: "", accountId: "", payeeName: "", categoryId: "", memo: "", amount: "", cleared: false },
    transferForm: { fromAccountId: "", toAccountId: "", amount: "", date: "", memo: "" },
    reconcileForm: { statementBalance: "", checked: false, diff: 0 },
    showMakeRecurring: false,
    recurringForm: {
      sourceId: null, accountId: "", payeeName: "", payeeId: null, categoryId: null,
      amount: 0, memo: "", cleared: false,
      frequency: "monthly", customInterval: 1, customUnit: "months", nextDate: "",
    },

    init() {
      var params = new URL(window.location.href).searchParams;
      var acct = params.get("account");
      if (acct) this.filterAccountId = acct;
      /* ?q=<text> — sent from report drill-throughs (e.g. "click a
         payee bar to see all its transactions"). Pre-fills the search
         box; Fuse.js then handles fuzzy matching at render time. */
      var q = params.get("q");
      if (q) this.search = q;
      var today = new Date().toISOString().slice(0, 10);
      this.form.date = today;
      this.transferForm.date = today;
      this.form.accountId = this.filterAccountId || (this.openAccounts[0]?.id || "");
      this.refreshDue();
      /* Mobile/desktop split — below 600px the table is unusable
         (8 columns at 360px). Render compact cards instead. */
      var self = this;
      /* Card-mode threshold matches the table's min-width media query
         in register.css — under 768px the table forces horizontal
         scroll, so we render the card view instead. */
      var mq = window.matchMedia("(max-width: 767px)");
      this.isMobile = mq.matches;
      var onChange = function (e) { self.isMobile = e.matches; };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);

      /* ?focus=<txnId> — sent from the budget drill-down. Find the
         row and scroll + flash it once Alpine has rendered. The
         row matches via data-txn-id (added on the <tr>). */
      var focusId = params.get("focus");
      if (focusId) {
        this.$nextTick(function () {
          /* Defer one more tick so visibleTransactions() has populated. */
          setTimeout(function () {
            var row = document.querySelector('[data-txn-id="' + focusId + '"]');
            if (!row) return;
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            row.classList.add("register__row--focus");
            setTimeout(function () { row.classList.remove("register__row--focus"); }, 2200);
          }, 60);
        });
      }
    },

    get hasAccounts() {
      return !!(this.$store.budget.profile && this.$store.budget.profile.accounts.some(a => !a.closedAt));
    },

    get openAccounts() {
      /* Touch _listVersion so Alpine re-runs this getter when the
         profile finishes loading from Dexie. Without the tripwire,
         the <select> populated by this getter stays empty on first
         paint, and the URL's ?account=<id> filter falls back to
         the default "All accounts" option even though filterAccountId
         is set on init(). */
      void this.$store.budget._listVersion;
      var p = this.$store.budget.profile;
      if (!p) return [];
      return p.accounts.filter(a => !a.closedAt).sort((a, b) => a.name.localeCompare(b.name));
    },

    /* Hide payment categories from the dropdown — they're derived, not
       directly selectable. */
    get selectableCategories() {
      var self = this;
      return this.$store.budget.categoriesFlat().filter(c => !self.$store.budget.isPaymentCategory(c.id));
    },

    /* `due` was a local snapshot populated by refreshDue() at init —
       so when scheduled txns finished loading asynchronously (Dexie
       restore), the "due transactions" banner stayed empty. Read
       live from the store via _listVersion tracking; mutators no
       longer need to call refreshDue(). */
    get due() {
      void this.$store.budget._listVersion;
      return this.$store.budget.dueScheduled();
    },
    refreshDue() { /* no-op shim — kept for callsites; getter is live. */ },
    postNow(id) { this.$store.budget.postScheduled(id); },

    /* Roll the source transaction's date forward by one occurrence to
       seed the "Next occurrence" picker. The user can override before
       submitting. */
    _nextDateFor(srcDate, freq, interval, unit) {
      var d = srcDate ? new Date(srcDate + "T00:00:00") : new Date();
      var step = function (n, u) {
        if (u === "days")   d.setDate(d.getDate() + n);
        if (u === "weeks")  d.setDate(d.getDate() + n * 7);
        if (u === "months") d.setMonth(d.getMonth() + n);
        if (u === "years")  d.setFullYear(d.getFullYear() + n);
      };
      if (freq === "daily")    step(1, "days");
      else if (freq === "weekly")   step(1, "weeks");
      else if (freq === "biweekly") step(2, "weeks");
      else if (freq === "monthly")  step(1, "months");
      else if (freq === "yearly")   step(1, "years");
      else if (freq === "custom")   step(interval || 1, unit || "months");
      return d.toISOString().slice(0, 10);
    },

    openMakeRecurring(t) {
      var payeeName = (this.$store.budget.payeeName(t.payeeId) || "").trim();
      this.recurringForm = {
        sourceId: t.id,
        accountId: t.accountId,
        payeeName: payeeName,
        payeeId: t.payeeId || null,
        categoryId: t.categoryId || null,
        amount: t.amount,
        memo: t.memo || "",
        cleared: false,
        frequency: "monthly",
        customInterval: 1,
        customUnit: "months",
        nextDate: this._nextDateFor(t.date, "monthly"),
        sourceDate: t.date,
      };
      this.showMakeRecurring = true;
    },
    onRecurringFreqChange() {
      this.recurringForm.nextDate = this._nextDateFor(
        this.recurringForm.sourceDate,
        this.recurringForm.frequency,
        this.recurringForm.customInterval,
        this.recurringForm.customUnit
      );
    },
    submitMakeRecurring() {
      var f = this.recurringForm;
      if (!f.accountId || !f.nextDate) return;
      var template = {
        accountId: f.accountId,
        payeeId: f.payeeId || null,
        payeeName: f.payeeName || "",
        categoryId: f.categoryId || null,
        amount: f.amount,
        memo: f.memo || "",
        cleared: false,
      };
      var s = this.$store.budget.addSchedule({
        template: template,
        frequency: f.frequency,
        customInterval: f.frequency === "custom" ? (f.customInterval || 1) : null,
        customUnit:     f.frequency === "custom" ? (f.customUnit || "months") : null,
        nextDate: f.nextDate,
      });
      if (s) {
        this.$store.budget.pushToast("Recurring template created. Manage at /app/scheduled/.", "ok");
        this.refreshDue();
      } else {
        this.$store.budget.pushToast("Could not create recurring template.", "danger");
      }
      this.showMakeRecurring = false;
    },

    /* Memoization: visibleTransactions() is called from many x-* bindings
       per row (x-for + x-if + x-show + x-text). With 1,399 sample txns
       running Fuse + the per-row payee/category lookups on every Alpine
       tick chewed the main thread, especially on mobile. Cache keyed
       on the store's _listVersion + the current filter + search so
       legitimate mutations still invalidate, but the dozen reads per
       tick collapse to one compute. */
    _vtxCache: null,
    _vtxKey: null,
    visibleTransactions() {
      var s = this.$store.budget;
      var key = (s._listVersion || 0) + "|" + (this.filterAccountId || "") + "|" + (this.search || "");
      if (this._vtxKey === key && this._vtxCache) return this._vtxCache;
      var p = s.profile;
      if (!p) { this._vtxKey = key; this._vtxCache = []; return this._vtxCache; }
      var q = (this.search || "").trim();
      var self = this;
      var pool = p.transactions
        .filter(t => !self.filterAccountId || t.accountId === self.filterAccountId);
      var result;
      if (!q) {
        result = pool.sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : 0));
      } else if (typeof window.Fuse === "function") {
        var docs = pool.map(t => ({
          t: t,
          payee: self.$store.budget.payeeName(t.payeeId) || "",
          category: self.$store.budget.categoryName(t.categoryId) || "",
          memo: t.memo || "",
          amount: ((t.amount || 0) / 100).toFixed(2),
        }));
        var fuse = new window.Fuse(docs, {
          includeScore: true,
          threshold: 0.35,
          ignoreLocation: true,
          minMatchCharLength: 2,
          keys: [
            { name: "payee",    weight: 3 },
            { name: "category", weight: 1.5 },
            { name: "memo",     weight: 1 },
            { name: "amount",   weight: 0.5 },
          ],
        });
        result = fuse.search(q).map(r => r.item.t)
          .sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : 0));
      } else {
        var ql = q.toLowerCase();
        result = pool.filter(t => {
          var payee = (self.$store.budget.payeeName(t.payeeId) || "").toLowerCase();
          return payee.indexOf(ql) !== -1 || (t.memo || "").toLowerCase().indexOf(ql) !== -1;
        }).sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : 0));
      }
      this._vtxKey = key;
      this._vtxCache = result;
      return result;
    },

    otherSide(t) {
      if (!t.transferTxnId) return t;
      return this.$store.budget.profile.transactions.find(x => x.id === t.transferTxnId) || t;
    },

    formatCents(c) { return ((c || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" }); },

    /* "May 15" big + "2026" muted on one line. Keeps the column narrow
       and easy to scan, while exposing the full ISO via the row's
       data-tip. Uses a span structure so we can style each part. */
    fmtDateCell(iso) {
      if (!iso) return "";
      var parts = iso.split("-").map(Number);
      var d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
      var md = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      var y  = d.getFullYear();
      return "<strong>" + md + "</strong> " + y;
    },

    parseDollars(s) {
      /* Prefer the YNAB-style calculator parser if it's loaded — lets
         users type "12.50 + 8.99", "100 - 25 * 2", "(50)" etc. and have
         them evaluate before save. Falls back to the simple parser if
         PBCalc hasn't booted (e.g. degraded JS environment). */
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
    /* "= $X.XX" hint when the user types a math expression in an
       amount input. Empty when no operator is present. */
    calcPreview(s) { return (window.PBCalc ? window.PBCalc.formatExpressionPreview(s) : ""); },

    updateUrl() {
      var base = window.location.pathname;
      var parts = [];
      if (this.filterAccountId) parts.push("account=" + encodeURIComponent(this.filterAccountId));
      if (this.search && this.search.trim()) parts.push("q=" + encodeURIComponent(this.search.trim()));
      var qs = parts.length ? ("?" + parts.join("&")) : "";
      history.replaceState(null, "", base + qs);
    },
    saveCurrentView() {
      this.updateUrl();
      this.$dispatch("pb:save-view", { kind: "register", name: "" });
    },

    submitAdd() {
      if (!this.form.accountId) return;
      this.$store.budget.addTransaction({
        accountId: this.form.accountId,
        date: this.form.date,
        payeeName: this.form.payeeName,
        categoryId: this.form.categoryId || null,
        amount: this.parseDollars(this.form.amount),
        memo: this.form.memo,
        cleared: this.form.cleared,
      });
      var keepAccount = this.form.accountId;
      var today = new Date().toISOString().slice(0, 10);
      this.form = { date: today, payeeName: "", amount: "", accountId: keepAccount, categoryId: "", memo: "", cleared: false };
      this.payeeSuggestions = [];
    },

    updatePayeeSuggestions() {
      this.payeeSuggestions = this.$store.budget.suggestPayees(this.form.payeeName, 6);
      /* If a known payee, pre-fill category from its last assignment. */
      var match = this.payeeSuggestions.find(p => p.name.toLowerCase() === (this.form.payeeName || "").toLowerCase());
      if (match && match.lastCategoryId && !this.form.categoryId) {
        this.form.categoryId = match.lastCategoryId;
      }
    },

    pickPayee(p) {
      this.form.payeeName = p.name;
      if (p.lastCategoryId && !this.form.categoryId) this.form.categoryId = p.lastCategoryId;
      this.payeeSuggestions = [];
    },

    startEdit(t) {
      this.editingId = t.id;
      this.edit = {
        date: t.date,
        accountId: t.accountId,
        payeeName: this.$store.budget.payeeName(t.payeeId),
        categoryId: t.categoryId || "",
        memo: t.memo,
        amount: ((t.amount || 0) / 100).toFixed(2),
        cleared: t.cleared,
      };
    },

    saveEdit() {
      if (!this.editingId) return;
      this.$store.budget.updateTransaction(this.editingId, {
        date: this.edit.date,
        accountId: this.edit.accountId,
        payeeName: this.edit.payeeName,
        categoryId: this.edit.categoryId || null,
        memo: this.edit.memo,
        amount: this.parseDollars(this.edit.amount),
        cleared: this.edit.cleared,
      });
      this.editingId = null;
    },

    cancelEdit() { this.editingId = null; },

    toggleCleared(t) {
      if (t.reconciled) return;
      this.$store.budget.updateTransaction(t.id, { cleared: !t.cleared });
    },

    unlock(t) {
      var self = this;
      window.PBDialog.confirm({
        title: "Unlock this reconciled transaction?",
        message: "Reconciled entries are locked so the cleared balance stays in sync with your statement. Unlocking means you'll need to reconcile the account again to re-lock it.",
        confirmLabel: "Unlock transaction",
        danger: true,
      }).then(function (ok) {
        if (ok) self.$store.budget.unlockReconciled(t.id);
      });
    },

    del(t) {
      var self = this;
      window.PBDialog.confirm({
        title: "Delete this transaction?",
        message: "This permanently removes the entry from the register and adjusts the account balance. You can recover it from a profile backup if needed.",
        confirmLabel: "Delete transaction",
        danger: true,
      }).then(function (ok) {
        if (ok) self.$store.budget.deleteTransaction(t.id);
      });
    },

    /* ---- Splits ---- */
    openSplits(t) {
      this.splitTxnId = t.id;
      if (t.splits && t.splits.length) {
        this.splitForm = t.splits.map(s => ({
          categoryId: s.categoryId || "",
          memo: s.memo || "",
          amount: ((s.amount || 0) / 100).toFixed(2),
        }));
      } else {
        this.splitForm = [
          { categoryId: t.categoryId || "", memo: "", amount: ((t.amount || 0) / 100).toFixed(2) },
          { categoryId: "", memo: "", amount: "0.00" },
        ];
      }
    },

    splitSum() {
      var self = this;
      return this.splitForm.reduce(function (sum, s) { return sum + self.parseDollars(s.amount); }, 0);
    },

    saveSplits() {
      if (!this.splitTxnId) return;
      var self = this;
      var splits = this.splitForm
        .filter(s => self.parseDollars(s.amount) !== 0)
        .map(s => ({ categoryId: s.categoryId || null, amount: self.parseDollars(s.amount), memo: s.memo || "" }));
      this.$store.budget.setSplits(this.splitTxnId, splits.length >= 2 ? splits : null);
      this.splitTxnId = null;
    },

    /* ---- Transfer ---- */
    submitTransfer() {
      var f = this.transferForm;
      if (!f.fromAccountId || !f.toAccountId || f.fromAccountId === f.toAccountId) return;
      this.$store.budget.transfer({
        fromAccountId: f.fromAccountId,
        toAccountId: f.toAccountId,
        amount: this.parseDollars(f.amount),
        date: f.date,
        memo: f.memo,
      });
      this.transferForm = { fromAccountId: "", toAccountId: "", amount: "", date: new Date().toISOString().slice(0, 10), memo: "" };
      this.showTransfer = false;
    },

    /* ---- Reconciliation ---- */
    checkReconcile() {
      var cents = this.parseDollars(this.reconcileForm.statementBalance);
      var status = this.$store.budget.reconcileStatus(this.filterAccountId, cents);
      this.reconcileForm.diff = status.diff;
      this.reconcileForm.checked = true;
    },

    finishReconcile() {
      this.$store.budget.applyReconcile(this.filterAccountId);
      this.reconcileForm = { statementBalance: "", checked: false, diff: 0 };
      this.showReconcile = false;
    },

    addAdjustmentAndReconcile() {
      this.$store.budget.addAdjustment(
        this.filterAccountId,
        this.reconcileForm.diff,
        new Date().toISOString().slice(0, 10),
        "Reconciliation adjustment"
      );
      this.$store.budget.applyReconcile(this.filterAccountId);
      this.reconcileForm = { statementBalance: "", checked: false, diff: 0 };
      this.showReconcile = false;
    },

    /* ---- Account stats strip ---- */
    /* Count of non-trashed transactions in the currently filtered
       account. Touches _listVersion so the tile re-renders after
       any add/edit/delete. */
    acctTxnCount() {
      void this.$store.budget._listVersion;
      var id = this.filterAccountId;
      if (!id) return 0;
      var p = this.$store.budget.profile;
      if (!p || !p.transactions) return 0;
      return p.transactions.filter(function (t) { return t.accountId === id; }).length;
    },
    /* Sum of POSITIVE transaction amounts in the currently filtered
       account for the active month — i.e. inflow / income / deposits
       posted in YYYY-MM. */
    acctMonthInflow() {
      void this.$store.budget._listVersion;
      var id = this.filterAccountId;
      if (!id) return 0;
      var m = this.$store.budget.currentMonth;
      var p = this.$store.budget.profile;
      if (!p || !p.transactions || !m) return 0;
      var sum = 0;
      p.transactions.forEach(function (t) {
        if (t.accountId !== id) return;
        if (!t.date || t.date.slice(0, 7) !== m) return;
        if ((t.amount || 0) > 0) sum += t.amount;
      });
      return sum;
    },
    /* Absolute sum of NEGATIVE transaction amounts for the same
       window — returned as a positive cents number so the tile
       displays "$1,234.56" rather than "-$1,234.56". */
    acctMonthOutflow() {
      void this.$store.budget._listVersion;
      var id = this.filterAccountId;
      if (!id) return 0;
      var m = this.$store.budget.currentMonth;
      var p = this.$store.budget.profile;
      if (!p || !p.transactions || !m) return 0;
      var sum = 0;
      p.transactions.forEach(function (t) {
        if (t.accountId !== id) return;
        if (!t.date || t.date.slice(0, 7) !== m) return;
        if ((t.amount || 0) < 0) sum += -t.amount;
      });
      return sum;
    },

    /* ---- Account-filter combobox ---- */
    /* Label shown in the input — the currently-selected account's
       name, or empty so the placeholder ("All accounts") shows. */
    acctFilterLabel() {
      if (this.acctComboOpen) return this.acctQuery;
      if (!this.filterAccountId) return "";
      var a = this.$store.budget.findAccount(this.filterAccountId);
      return a ? a.name : "";
    },
    acctComboFiltered() {
      var q = (this.acctQuery || "").trim().toLowerCase();
      if (!q) return this.openAccounts;
      return this.openAccounts.filter(function (a) {
        return a.name.toLowerCase().indexOf(q) !== -1;
      });
    },

    /* ---- Bulk select + bulk operations ---- */
    toggleSelectMode() {
      this.selectMode = !this.selectMode;
      if (!this.selectMode) this.selectedTxnIds = [];
    },
    isTxnSelected(id) { return this.selectedTxnIds.indexOf(id) !== -1; },
    toggleTxnSelected(id) {
      var i = this.selectedTxnIds.indexOf(id);
      if (i === -1) this.selectedTxnIds.push(id);
      else this.selectedTxnIds.splice(i, 1);
      /* Auto-arm select mode the moment a row is selected. The Select
         button still works as an explicit toggle, but users who click
         a row first don't need a separate step to reveal the bulk
         actions bar / checkbox column. */
      if (this.selectedTxnIds.length) this.selectMode = true;
    },
    /* Whole-row click → toggle selection. Skips clicks that came from
       a real action (buttons, links, inputs, the inline edit form,
       the cleared toggle, the split badge). Reconciled rows opt out
       entirely since they're locked from bulk operations. */
    onRowClick(t, evt) {
      if (!t || t.reconciled) return;
      if (this.editingId === t.id) return;
      var target = evt && evt.target;
      if (target && target.closest && target.closest("button,a,input,select,textarea,label,[data-tippy-bound]")) return;
      this.toggleTxnSelected(t.id);
    },
    clearTxnSelection() {
      this.selectedTxnIds = [];
      this.selectMode = false;
    },
    /* Header checkbox helpers — operate only on the currently visible
       (filtered + searched) rows, skipping reconciled rows since they
       can't be bulk-edited anyway. */
    _selectableVisibleIds() {
      return this.visibleTransactions()
        .filter(function (t) { return !t.reconciled; })
        .map(function (t) { return t.id; });
    },
    allVisibleSelected() {
      var ids = this._selectableVisibleIds();
      if (!ids.length) return false;
      var self = this;
      return ids.every(function (id) { return self.isTxnSelected(id); });
    },
    someVisibleSelected() {
      var ids = this._selectableVisibleIds();
      var self = this;
      return ids.some(function (id) { return self.isTxnSelected(id); });
    },
    toggleSelectAllVisible() {
      var ids = this._selectableVisibleIds();
      var self = this;
      if (this.allVisibleSelected()) {
        this.selectedTxnIds = this.selectedTxnIds.filter(function (id) { return ids.indexOf(id) === -1; });
      } else {
        ids.forEach(function (id) { if (!self.isTxnSelected(id)) self.selectedTxnIds.push(id); });
      }
    },

    openBulkRecategorize() {
      this.bulkRecatTarget = "";
      this.showBulkRecat = true;
    },
    applyBulkRecategorize() {
      var ids = this.selectedTxnIds.slice();
      if (!ids.length) { this.showBulkRecat = false; return; }
      var n = this.$store.budget.bulkRecategorize(ids, this.bulkRecatTarget || null);
      this.$store.budget.pushToast(
        "Recategorized " + n + " transaction" + (n === 1 ? "" : "s") + ".",
        "ok"
      );
      this.showBulkRecat = false;
      this.clearTxnSelection();
    },

    openBulkRename() {
      this.bulkRenameTarget = "";
      this.showBulkRename = true;
      var self = this;
      this.$nextTick(function () {
        var el = document.getElementById("bulk-rename-input");
        if (el) el.focus();
      });
    },
    applyBulkRename() {
      var name = (this.bulkRenameTarget || "").trim();
      if (!name) return;
      var ids = this.selectedTxnIds.slice();
      if (!ids.length) { this.showBulkRename = false; return; }
      var n = this.$store.budget.bulkRenamePayee(ids, name);
      this.$store.budget.pushToast(
        "Renamed payee on " + n + " transaction" + (n === 1 ? "" : "s") + ".",
        "ok"
      );
      this.showBulkRename = false;
      this.clearTxnSelection();
    },

    openBulkShift() {
      this.bulkShiftDelta = 0;
      this.showBulkShift = true;
      var self = this;
      this.$nextTick(function () {
        var el = document.getElementById("bulk-shift-input");
        if (el) el.focus();
      });
    },
    applyBulkShift() {
      var d = Number(this.bulkShiftDelta);
      if (!Number.isFinite(d) || d === 0) return;
      var ids = this.selectedTxnIds.slice();
      if (!ids.length) { this.showBulkShift = false; return; }
      var n = this.$store.budget.bulkShiftDates(ids, d);
      this.$store.budget.pushToast(
        "Shifted " + n + " transaction" + (n === 1 ? "" : "s") + " by " + d + " day" + (Math.abs(d) === 1 ? "" : "s") + ".",
        "ok"
      );
      this.showBulkShift = false;
      this.clearTxnSelection();
    },

    bulkDelete() {
      var ids = this.selectedTxnIds.slice();
      if (!ids.length) return;
      var self = this;
      window.PBDialog.confirm({
        title: "Delete " + ids.length + " transaction" + (ids.length === 1 ? "" : "s") + "?",
        message: "Selected entries move to Trash and can be restored from /app/trash/ for 30 days. Reconciled rows are skipped.",
        confirmLabel: "Delete " + ids.length,
        danger: true,
      }).then(function (ok) {
        if (!ok) return;
        var n = self.$store.budget.bulkDeleteTransactions(ids);
        self.$store.budget.pushToast(
          "Moved " + n + " transaction" + (n === 1 ? "" : "s") + " to Trash.",
          "ok"
        );
        self.clearTxnSelection();
      });
    },
  };
}

  window.registerView = registerView;
})();
