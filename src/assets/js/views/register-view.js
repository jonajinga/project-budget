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
    /* Single-cell inline editor — drives a per-cell click-to-edit
       UX on the register table. `cellEdit.txnId === t.id &&
       cellEdit.field === 'date'` means the Date cell on that row
       renders an input instead of static text. `cellEdit.draft`
       holds the in-progress value so blur/Enter commit it and
       Escape reverts. `cellEdit.sign` only applies to the amount
       cell ("outflow" | "inflow") so mobile keypads (no minus key)
       can still flip a positive number to negative. Only one cell
       is editable at a time. */
    cellEdit: { txnId: null, field: null, draft: "", sign: "outflow" },
    splitTxnId: null,
    splitForm: [],
    isMobile: false,
    expandedTxnId: null,
    /* Bulk-select state — checkboxes are now always visible, so
       selectMode is gone. The bulk action bar appears whenever
       selectedTxnIds has anything in it. */
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
    /* Virtualized rendering — only DOM-mount the first
       `pageSize * (visiblePage + 1)` rows. The full visibleTransactions
       array is still computed (for counts + bulk ops), but the
       table/cards only mount a slice. Auto-bumps via an
       IntersectionObserver on the bottom sentinel; users can also
       click "Load more". */
    pageSize: 50,
    visiblePage: 0,

    /* edit — full-form state used by the kebab → Edit modal. The
       inline cell editor uses cellEdit instead. `amount` stays
       positive; `type` drives the sign on save. */
    edit: { date: "", accountId: "", payeeName: "", categoryId: "", memo: "", amount: "", cleared: false, type: "outflow" },
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

      /* Infinite-scroll observer: watch any sentinel button with
         [data-load-more-sentinel] currently in the DOM and auto-bump
         the visible page when one scrolls into view. Re-attaches on
         Alpine re-render via a tiny MutationObserver that re-binds
         whenever sentinel buttons appear or disappear. */
      this._loadMoreIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && self.hasMoreToShow()) self.showMore();
        });
      }, { root: null, rootMargin: "300px", threshold: 0 });
      var sentinelMO = new MutationObserver(function () {
        document.querySelectorAll("[data-load-more-sentinel]").forEach(function (el) {
          if (el.__pbSentinelBound) return;
          el.__pbSentinelBound = true;
          self._loadMoreIO.observe(el);
        });
      });
      sentinelMO.observe(document.body, { childList: true, subtree: true });
      this._sentinelMO = sentinelMO;
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

    /* Variant of selectableCategories filtered by transaction type:
       outflow → all expense-group categories (default), inflow →
       only categories whose group has kind: "income". The toggle in
       the add + edit forms drives this so the dropdown only ever
       shows categories that match the user's intent. */
    selectableCategoriesForType(type) {
      var self = this;
      var s = this.$store.budget;
      return this.selectableCategories.filter(function (c) {
        var isIncome = s.isIncomeCategory(c.id);
        if (type === "inflow")  return isIncome;
        /* Outflow + null/unset both show expense categories. */
        return !isIncome;
      });
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

    /* Two-tier cache.
       Tier 1 (_vtxIndex): the pool + Fuse index, keyed on
         _listVersion + filterAccountId. Building Fuse over 1,399
         docs is the expensive step — it only re-runs when the data
         or account filter actually changes.
       Tier 2 (_vtxCache): the final sorted result, keyed on the
         tier-1 key plus the search query. Searching the prebuilt
         Fuse index for a new query is O(N), not the index-build
         cost. Typing in the search box only re-runs tier 2. */
    _vtxIndex: null,        // { pool, fuse, key }
    _vtxCache: null,
    _vtxCacheKey: null,
    visibleTransactions() {
      var s = this.$store.budget;
      var dataKey = (s._listVersion || 0) + "|" + (this.filterAccountId || "");
      var fullKey = dataKey + "|" + (this.search || "");
      if (this._vtxCacheKey === fullKey && this._vtxCache) return this._vtxCache;
      var p = s.profile;
      if (!p) { this._vtxCacheKey = fullKey; this._vtxCache = []; return this._vtxCache; }
      var self = this;
      /* Tier 1: rebuild pool + Fuse only when dataKey changed. */
      if (!this._vtxIndex || this._vtxIndex.key !== dataKey) {
        var pool = p.transactions
          .filter(t => !self.filterAccountId || t.accountId === self.filterAccountId);
        var fuse = null;
        if (typeof window.Fuse === "function") {
          var docs = pool.map(t => ({
            t: t,
            payee: self.$store.budget.payeeName(t.payeeId) || "",
            category: self.$store.budget.categoryName(t.categoryId) || "",
            memo: t.memo || "",
            amount: ((t.amount || 0) / 100).toFixed(2),
          }));
          fuse = new window.Fuse(docs, {
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
        }
        this._vtxIndex = { pool: pool, fuse: fuse, key: dataKey };
      }
      /* Tier 2: search the prebuilt index. */
      var q = (this.search || "").trim();
      var pool2 = this._vtxIndex.pool;
      var result;
      if (!q) {
        result = pool2.slice().sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : 0));
      } else if (this._vtxIndex.fuse) {
        result = this._vtxIndex.fuse.search(q).map(r => r.item.t)
          .sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : 0));
      } else {
        var ql = q.toLowerCase();
        result = pool2.filter(t => {
          var payee = (self.$store.budget.payeeName(t.payeeId) || "").toLowerCase();
          return payee.indexOf(ql) !== -1 || (t.memo || "").toLowerCase().indexOf(ql) !== -1;
        }).sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : 0));
      }
      this._vtxCacheKey = fullKey;
      this._vtxCache = result;
      /* Filter / search changed → reset to first page so the user
         always sees the freshest matches at the top. */
      if (this._vtxLastFullKey !== fullKey) {
        this.visiblePage = 0;
        this._vtxLastFullKey = fullKey;
      }
      return result;
    },

    /* Windowed view: only DOM-mount the first N rows. The full
       visibleTransactions() is still computed for counts + bulk
       ops + Phase B's otherSide lookup. */
    pagedTransactions() {
      var all = this.visibleTransactions();
      var n = (this.visiblePage + 1) * this.pageSize;
      return all.length > n ? all.slice(0, n) : all;
    },
    hasMoreToShow() { return this.pagedTransactions().length < this.visibleTransactions().length; },
    showMore() { this.visiblePage += 1; },
    /* IntersectionObserver hook — wire it from the sentinel row's
       x-intersect to auto-page-bump when the user scrolls near the
       end of the visible window. */
    onSentinelIntersect() {
      if (this.hasMoreToShow()) this.visiblePage += 1;
    },

    /* O(1) transfer-pair lookup via the tier-1 index Map. Falls back
       to a linear find if the index isn't built yet (very early
       render). */
    _txnByIdCache: null,
    _txnByIdKey: null,
    otherSide(t) {
      if (!t.transferTxnId) return t;
      var s = this.$store.budget;
      if (!s.profile) return t;
      var key = (s._listVersion || 0);
      if (this._txnByIdKey !== key) {
        var m = new Map();
        (s.profile.transactions || []).forEach(function (x) { m.set(x.id, x); });
        this._txnByIdCache = m;
        this._txnByIdKey = key;
      }
      return this._txnByIdCache.get(t.transferTxnId) || t;
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

    startEdit(t) {
      this.editingId = t.id;
      /* Derive the toggle from the existing amount sign; amount field
         shows the absolute value so the toggle is unambiguous. */
      var amt = t.amount || 0;
      this.edit = {
        date: t.date,
        accountId: t.accountId,
        payeeName: this.$store.budget.payeeName(t.payeeId),
        categoryId: t.categoryId || "",
        memo: t.memo,
        amount: (Math.abs(amt) / 100).toFixed(2),
        cleared: t.cleared,
        type: amt >= 0 ? "inflow" : "outflow",
      };
    },

    saveEdit() {
      if (!this.editingId) return;
      /* Both inline (desktop) and mobile card edit use the toggle +
         positive amount pattern. parse → abs → flip sign by toggle. */
      var raw = this.parseDollars(this.edit.amount);
      var signed = Math.abs(raw) * (this.edit.type === "inflow" ? 1 : -1);
      this.$store.budget.updateTransaction(this.editingId, {
        date: this.edit.date,
        accountId: this.edit.accountId,
        payeeName: this.edit.payeeName,
        categoryId: this.edit.categoryId || null,
        memo: this.edit.memo,
        amount: signed,
        cleared: this.edit.cleared,
      });
      this.editingId = null;
    },

    cancelEdit() { this.editingId = null; },

    /* ---- Single-cell inline edit ---- */
    /* Click a cell → that cell becomes an editable input/select; the
       rest of the row stays read-only. Blur or Enter commits via
       updateTransaction; Escape reverts. Skips reconciled rows and
       transfer pairs (those route through the full-row editor in the
       kebab → Edit menu). */
    isEditingCell(t, field) {
      return this.cellEdit.txnId === t.id && this.cellEdit.field === field;
    },
    startCellEdit(t, field, initialValue) {
      if (t.reconciled || t.transferTxnId) return;
      var sign = (t.amount < 0) ? "outflow" : "inflow";
      this.cellEdit = {
        txnId: t.id,
        field: field,
        draft: initialValue == null ? "" : String(initialValue),
        sign: sign,
      };
      var self = this;
      this.$nextTick(function () {
        var input = document.querySelector('[data-cell-input="' + t.id + ':' + field + '"]');
        if (input) {
          input.focus();
          if (input.select) input.select();
        }
      });
    },
    /* Flip the sign while editing the amount cell — keeps the input
       focused so the user can keep typing. Used by the inline
       Outflow/Inflow toggle. */
    setCellSign(sign) {
      if (this.cellEdit.field !== "amount") return;
      this.cellEdit.sign = sign;
      var txnId = this.cellEdit.txnId;
      this.$nextTick(function () {
        var input = document.querySelector('[data-cell-input="' + txnId + ':amount"]');
        if (input) input.focus();
      });
    },
    commitCell(t) {
      if (this.cellEdit.txnId !== t.id || !this.cellEdit.field) return;
      var field = this.cellEdit.field;
      var raw = this.cellEdit.draft;
      var patch = {};
      switch (field) {
        case "date":
          if (!raw) { this.cancelCellEdit(); return; }
          patch.date = raw;
          break;
        case "accountId":
          patch.accountId = raw || t.accountId;
          break;
        case "payeeName":
          patch.payeeName = (raw || "").trim();
          break;
        case "categoryId":
          patch.categoryId = raw || null;
          break;
        case "memo":
          patch.memo = raw || "";
          break;
        case "amount":
          /* Sign comes from the inline Outflow/Inflow toggle so
             mobile keypads (no minus key) can still flip the sign.
             Default seeded from the row's existing sign in
             startCellEdit. */
          var n = Number(String(raw).replace(/[$,\s]/g, ""));
          if (!isFinite(n)) { this.cancelCellEdit(); return; }
          var cents = Math.round(Math.abs(n) * 100);
          patch.amount = this.cellEdit.sign === "outflow" ? -cents : cents;
          break;
        default:
          this.cancelCellEdit();
          return;
      }
      this.$store.budget.updateTransaction(t.id, patch);
      this.cancelCellEdit();
    },
    cancelCellEdit() {
      this.cellEdit = { txnId: null, field: null, draft: "", sign: "outflow" };
    },

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

    /* ---- Account stats strip ----
       Memoized via the store's _memo so a single render of the stats
       strip walks transactions exactly once per stat, and follow-up
       renders reuse the cache until the next store mutation. Cache
       keys include filterAccountId + currentMonth so a profile / month
       switch invalidates cleanly. */
    acctTxnCount() {
      var s = this.$store.budget;
      var id = this.filterAccountId;
      if (!id) return 0;
      var p = s.profile;
      if (!p || !p.transactions) return 0;
      return s._memo("acctTxnCount:" + id, function () {
        return p.transactions.filter(function (t) { return t.accountId === id; }).length;
      });
    },
    acctMonthInflow() {
      var s = this.$store.budget;
      var id = this.filterAccountId;
      if (!id) return 0;
      var m = s.currentMonth;
      var p = s.profile;
      if (!p || !p.transactions || !m) return 0;
      return s._memo("acctMonthInflow:" + id + ":" + m, function () {
        var sum = 0;
        p.transactions.forEach(function (t) {
          if (t.accountId !== id) return;
          if (!t.date || t.date.slice(0, 7) !== m) return;
          if ((t.amount || 0) > 0) sum += t.amount;
        });
        return sum;
      });
    },
    acctMonthOutflow() {
      var s = this.$store.budget;
      var id = this.filterAccountId;
      if (!id) return 0;
      var m = s.currentMonth;
      var p = s.profile;
      if (!p || !p.transactions || !m) return 0;
      return s._memo("acctMonthOutflow:" + id + ":" + m, function () {
        var sum = 0;
        p.transactions.forEach(function (t) {
          if (t.accountId !== id) return;
          if (!t.date || t.date.slice(0, 7) !== m) return;
          if ((t.amount || 0) < 0) sum += -t.amount;
        });
        return sum;
      });
    },

    /**
     * 30-day end-of-day balance trail for the filtered account, projected
     * into a 100x30 viewBox SVG polyline path. Returns null when no account
     * is selected so the template can hide the sparkline cleanly. Memoized
     * per (account, today) so re-renders during the same day are free.
     * @returns {{ path: string, min: number, max: number, last: number, trend: 'up'|'down'|'flat' }|null}
     */
    acctSparkline() {
      var s = this.$store.budget;
      var id = this.filterAccountId;
      if (!id) return null;
      var p = s.profile;
      if (!p || !p.accounts || !p.transactions) return null;
      var today = new Date().toISOString().slice(0, 10);
      return s._memo("acctSparkline:" + id + ":" + today, function () {
        var acct = p.accounts.find(function (a) { return a.id === id; });
        if (!acct) return null;
        var DAYS = 30;
        /* Build the 30-day window of ISO dates ending today. */
        var dates = [];
        var d = new Date(today);
        for (var i = 0; i < DAYS; i++) {
          dates.unshift(d.toISOString().slice(0, 10));
          d.setDate(d.getDate() - 1);
        }
        var startISO = dates[0];
        /* Opening balance carried into the window: sum every txn strictly
           before startISO. We walk transactions ONCE: anything before the
           window contributes to baseline; anything inside increments the
           per-day delta. */
        var baseline = acct.openingBalance || 0;
        var dayIdx = Object.create(null);
        dates.forEach(function (iso, n) { dayIdx[iso] = n; });
        var deltas = new Array(DAYS).fill(0);
        p.transactions.forEach(function (t) {
          if (t.accountId !== id) return;
          if (!t.date) return;
          if (t.date < startISO) { baseline += (t.amount || 0); return; }
          if (t.date > today) return;
          var n = dayIdx[t.date];
          if (n != null) deltas[n] += (t.amount || 0);
        });
        /* Roll deltas into end-of-day balances. */
        var balances = new Array(DAYS);
        var running = baseline;
        for (var j = 0; j < DAYS; j++) { running += deltas[j]; balances[j] = running; }
        var min = balances[0], max = balances[0];
        for (var k = 1; k < DAYS; k++) {
          if (balances[k] < min) min = balances[k];
          if (balances[k] > max) max = balances[k];
        }
        /* Project into 100×30 viewBox. Flat series → flat midline. */
        var span = max - min;
        var points = balances.map(function (b, ii) {
          var x = (ii / (DAYS - 1)) * 100;
          var y = span === 0 ? 15 : 28 - ((b - min) / span) * 26;
          return x.toFixed(2) + "," + y.toFixed(2);
        });
        var last = balances[DAYS - 1];
        var first = balances[0];
        var trend = "flat";
        if (last > first) trend = "up";
        else if (last < first) trend = "down";
        return {
          path: "M" + points.join(" L"),
          min: min,
          max: max,
          last: last,
          trend: trend,
        };
      });
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
    isTxnSelected(id) { return this.selectedTxnIds.indexOf(id) !== -1; },
    toggleTxnSelected(id) {
      var i = this.selectedTxnIds.indexOf(id);
      if (i === -1) this.selectedTxnIds.push(id);
      else this.selectedTxnIds.splice(i, 1);
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
