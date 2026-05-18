/* Alpine x-data factory for /app/calendar/.
   Extracted from calendar.njk so the template stays focused on
   markup. Exposed as window.calendarView so Alpine can find it
   when binding x-data. Load order in app.njk puts this BEFORE
   alpine.min.js (both defer). */
(function () {
  "use strict";

function calendarView() {
  /* Initialize anchorISO synchronously to today — if left as "" until
     init() runs, Alpine's first render computes monthCells with NaN
     dates (every cell keyed "NaN-NaN-NaN"). x-for collapses identical
     keys to one element, and the subsequent init() update can't
     re-hydrate the missing 41 cells. Symptom: calendar renders empty
     and a hard refresh (which somehow primed cached state) was the
     only fix. Mobile browsers hit this 100% of the time because their
     init pacing leaves the first render visible long enough to stick. */
  var _today = new Date();
  var _todayISO = _today.getFullYear() + "-" +
    String(_today.getMonth() + 1).padStart(2, "0") + "-" +
    String(_today.getDate()).padStart(2, "0");

  return {
    view: "month",     // 'day' | 'week' | 'month' | 'year'
    anchorISO: _todayISO, // selected day OR a YYYY-MM-DD anchor for month/week/year
    selectedISO: null, // month-view click selection

    searchQuery: "",
    filterAccountId: "",
    filterKind: "all", // 'all' | 'posted' | 'scheduled' | 'inflow' | 'outflow'
    /* Mobile-only filter disclosure — defaults open at tablet+ via
     a matchMedia check in init(), closed on <600px viewports. */
    filtersOpen: true,

    /* Transaction edit modal state — opened by clicking a posted row. */
    txnEditId: null,
    txnForm: { date: "", accountId: "", payeeName: "", amount: "", categoryId: "", memo: "", cleared: false },
    /* Year-view day modal — click any day in a mini-grid to see its
       In/Out/Net summary + the full transaction list for that day.
       Each row in the modal is clickable to open the txn edit modal. */
    yearDayISO: null,
    /* Period transactions modal — opened by clicking the In / Out /
       Entries stat on any period header (main week, extra week,
       extra month, etc.). Holds a precomputed list since callers
       already know the relevant cells. */
    periodModalOpen: false,
    periodModalTitle: "",
    periodModalSubtitle: "",
    periodModalKind: "all",
    periodModalCells: null,
    /* Confirm-delete modal state — replaces the browser-native confirm()
       dialog that bleeds the page's chrome ("Code" title bar, OS buttons). */
    confirmDeleteId: null,

    views: [
      { value: "day",   label: "Day" },
      { value: "week",  label: "Week" },
      { value: "month", label: "Month" },
      { value: "year",  label: "Year" },
    ],
    /* Span = how many consecutive months / weeks / days render
       stacked beneath each other. 1 = single (current behavior);
       2-N adds extra periods after the anchor. */
    monthSpan: 1,
    weekSpan: 1,
    daySpan: 1,
    /* Whether to show the per-day In/Out/Net rollup at the bottom
       of each cell (Month view) and inside each day card (Week
       view). Persisted to localStorage so the preference sticks
       across sessions. */
    showDayTotals: true,
    /* Year-view only: when true, the mini-grid cells display each
       day's net $ instead of the date number (and the week-number
       column hides). Lets users scan a 12-month heat-map of cash
       flow at a glance. */
    yearShowNet: false,
    monthSpanPresets: [{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 6, label: "6" }],
    weekSpanPresets:  [{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 4, label: "4" }, { value: 8, label: "8" }],
    daySpanPresets:   [{ value: 1, label: "1" }, { value: 3, label: "3" }, { value: 7, label: "7" }, { value: 14, label: "14" }],
    setSpan(n) {
      var clean = Math.max(1, Math.min(60, parseInt(n, 10) || 1));
      if (this.view === "month") this.monthSpan = clean;
      else if (this.view === "week") this.weekSpan = clean;
      else if (this.view === "day") this.daySpan = clean;
    },
    /* monthsToRender / weeksToRender return [{ label, anchorISO,
       startISO }] arrays the template iterates over. Each entry is a
       complete period the existing builders can target. */
    monthsToRender() {
      var out = [];
      var d = this._parseISO(this.anchorISO);
      var year = d.getFullYear();
      var month = d.getMonth();
      for (var i = 0; i < (this.monthSpan || 1); i++) {
        var cur = new Date(year, month + i, 1);
        var iso = this._isoDay(cur);
        out.push({
          anchorISO: iso,
          monthISO: this._isoMonth(cur),
          label: cur.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        });
      }
      return out;
    },
    weeksToRender() {
      var out = [];
      var start = this._startOfWeek(this._parseISO(this.anchorISO));
      for (var i = 0; i < (this.weekSpan || 1); i++) {
        var s = new Date(start); s.setDate(start.getDate() + 7 * i);
        var e = new Date(s); e.setDate(s.getDate() + 6);
        out.push({
          anchorISO: this._isoDay(s),
          startISO: this._isoDay(s),
          endISO: this._isoDay(e),
          label: s.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
                 " – " +
                 e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        });
      }
      return out;
    },
    daysToRender() {
      var out = [];
      var start = this._parseISO(this.anchorISO);
      for (var i = 0; i < (this.daySpan || 1); i++) {
        var d = new Date(start); d.setDate(start.getDate() + i);
        var iso = this._isoDay(d);
        out.push({
          iso: iso,
          label: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
          short: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        });
      }
      return out;
    },
    /* Cell builders that target a specific period instead of the
       global anchorISO. Existing monthCells() / weekCells() still
       use anchorISO and are the single-span code path. */
    monthCellsFor(anchorISO) {
      var prev = this.anchorISO;
      this.anchorISO = anchorISO;
      var cells = this.monthCells();
      this.anchorISO = prev;
      return cells;
    },
    weekCellsFor(startISO) {
      var prev = this.anchorISO;
      this.anchorISO = startISO;
      var cells = this.weekCells();
      this.anchorISO = prev;
      return cells;
    },
    _periodTotalsFor(cells) { return this._periodTotals(cells); },

    init() {
      this.anchorISO = this._isoDay(new Date());
      /* Filters closed by default on phones to save vertical space. */
      try {
        if (window.matchMedia && window.matchMedia("(max-width: 599px)").matches) {
          this.filtersOpen = false;
        }
      } catch (_e) {}
      /* Honor URL params from drill-through links — `?m=YYYY-MM` lands
         on Month view for that month; `?v=year|week|day` switches
         view. Reports' month-cell links pass these. */
      try {
        var params = new URL(window.location.href).searchParams;
        var mParam = params.get("m");
        if (mParam && /^\d{4}-\d{2}$/.test(mParam)) {
          this.anchorISO = mParam + "-01";
        }
        var vParam = params.get("v");
        if (vParam && ["day","week","month","year"].indexOf(vParam) !== -1) {
          this.view = vParam;
        }
      } catch (_e) {}
      /* Read persisted display preferences (default ON for day-
         totals, OFF for year-net). Watch + write back on change. */
      try {
        var saved = localStorage.getItem("projectbudget:cal-show-day-totals");
        if (saved !== null) this.showDayTotals = saved === "1";
        var savedNet = localStorage.getItem("projectbudget:cal-year-show-net");
        if (savedNet !== null) this.yearShowNet = savedNet === "1";
      } catch (_e) {}
      this.$watch("showDayTotals", function (v) {
        try { localStorage.setItem("projectbudget:cal-show-day-totals", v ? "1" : "0"); }
        catch (_e) {}
      });
      this.$watch("yearShowNet", function (v) {
        try { localStorage.setItem("projectbudget:cal-year-show-net", v ? "1" : "0"); }
        catch (_e) {}
      });
      /* Sync filter state back to the URL so the page is shareable +
         saveable as a view. anchorISO is per-day; we round to the
         month for the ?m= param to match what the page reads on load. */
      var self = this;
      this.$watch("anchorISO", function () { self._syncUrl(); });
      this.$watch("view",      function () { self._syncUrl(); });
    },

    _syncUrl() {
      try {
        var month = (this.anchorISO || "").slice(0, 7);
        var parts = [];
        if (month) parts.push("m=" + month);
        if (this.view && this.view !== "month") parts.push("v=" + this.view);
        var qs = parts.length ? ("?" + parts.join("&")) : "";
        history.replaceState(null, "", window.location.pathname + qs);
      } catch (_e) {}
    },
    saveCurrentView() {
      this._syncUrl();
      this.$dispatch("pb:save-view", { kind: "calendar", name: "" });
    },

    /* ---------- date helpers ---------- */
    _pad(n) { return String(n).padStart(2, "0"); },
    _isoDay(d) { return d.getFullYear() + "-" + this._pad(d.getMonth() + 1) + "-" + this._pad(d.getDate()); },
    _isoMonth(d) { return d.getFullYear() + "-" + this._pad(d.getMonth() + 1); },
    _parseISO(s) {
      var parts = (s || "").split("-").map(Number);
      return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    },
    _startOfWeek(d) {
      var copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      copy.setDate(copy.getDate() - copy.getDay()); // Sun = 0
      return copy;
    },
    _addDaysISO(iso, n) {
      var d = this._parseISO(iso);
      d.setDate(d.getDate() + n);
      return this._isoDay(d);
    },

    /* Projection window: any visible day inside [today - 365d, today + 90d]
       gets its recurring entries inferred via occurrencesIn(). Past beyond
       a year is rare; future beyond 90d is intentionally not projected
       because that's where users should manually post or skip the queue. */
    _projectionEnd() { return this._addDaysISO(this._isoDay(new Date()), 90); },

    /* Build a { iso: [scheduledTpl...] } map for all schedules over the
       projection window. Read _listVersion as the reactivity tripwire so
       the calendar re-renders whenever a schedule is added/posted/skipped. */
    /* _scheduledByISO walks every scheduled template and expands its
       occurrences up to the projection horizon — pure function of
       profile.scheduled. Memoized via the store's _memo so the
       calendar's per-cell reads don't re-expand on every render
       (was the hottest unmemoized walker in the calendar view). */
    _scheduledByISO() {
      var s = this.$store.budget;
      var p = s.profile;
      if (!p || !p.scheduled || !p.scheduled.length) return {};
      var endISO = this._projectionEnd();
      var occurrencesIn = s.occurrencesIn;
      return s._memo("calScheduledByISO:" + endISO, function () {
        var out = {};
        p.scheduled.forEach(function (sch) {
          if (!sch || !sch.nextDate) return;
          var occ = occurrencesIn(sch, "1970-01-01", endISO);
          occ.forEach(function (iso) {
            (out[iso] = out[iso] || []).push(sch);
          });
        });
        return out;
      });
    },

    anchorMonthISO() { return this._isoMonth(this._parseISO(this.anchorISO)); },
    anchorYear()     { return this._parseISO(this.anchorISO).getFullYear(); },

    anchorLabel() {
      var d = this._parseISO(this.anchorISO);
      if (this.view === "day") {
        return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      }
      if (this.view === "week") {
        var start = this._startOfWeek(d);
        var end = new Date(start); end.setDate(start.getDate() + 6);
        return start.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
               " – " +
               end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      if (this.view === "month") {
        return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      }
      return String(d.getFullYear());
    },

    monthLabel(iso) {
      var parts = (iso || "").split("-");
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    },

    dayLabel(iso) {
      if (!iso) return "";
      var d = this._parseISO(iso);
      return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    },

    /* ---------- navigation ---------- */
    jumpToday() {
      /* Move the visible range so it includes today. We deliberately
         do NOT set selectedISO — selecting a day opens the day-detail
         modal, which isn't what the user wants from a navigation
         action. Matches the step() behavior of clearing selection on
         non-month views; in month view, prior selection is preserved. */
      this.anchorISO = this._isoDay(new Date());
      if (this.view !== "month") this.selectedISO = null;
    },
    step(delta) {
      var d = this._parseISO(this.anchorISO);
      if (this.view === "day")   d.setDate(d.getDate() + delta);
      if (this.view === "week")  d.setDate(d.getDate() + (7 * delta));
      if (this.view === "month") d.setMonth(d.getMonth() + delta);
      if (this.view === "year")  d.setFullYear(d.getFullYear() + delta);
      this.anchorISO = this._isoDay(d);
      if (this.view !== "month") this.selectedISO = null;
    },

    /* ---------- data ---------- */
    formatCents(c) {
      return ((c || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    },
    /* Compact dollar string for the tight month-grid cells:
       12345 -> "$123", 123456 -> "$1.2k", 1234567 -> "$12k". */
    /* Magnitude-aware compact format — matches the sidebar +
       dashboard helpers. 1 decimal when the leading value is 1-99,
       0 decimals once it hits 100 so big readings ($754k, $1.2M)
       don't imply false precision. Math.round = half-up. */
    fmtCompact(cents) {
      var n = (cents || 0) / 100;
      var sign = n < 0 ? "-" : "";
      var abs = Math.abs(n);
      var out;
      if (abs >= 1000000) {
        var m = abs / 1000000;
        out = (m >= 100 ? Math.round(m) : (Math.round(m * 10) / 10)) + "M";
      } else if (abs >= 1000) {
        var k = abs / 1000;
        out = (k >= 100 ? Math.round(k) : (Math.round(k * 10) / 10)) + "k";
      } else {
        out = Math.round(abs).toString();
      }
      return sign + "$" + out;
    },
    /* Builds the In / Out / Net summary segment used by both the
       month and week cell tooltips. */
    _periodSummary(cell) {
      if (!cell) return "";
      var inflow  = cell.totalInflow  || 0;
      var outflow = cell.totalOutflow || 0;
      var net     = inflow + outflow;
      var parts = [];
      if (inflow > 0)  parts.push("In "  + this.formatCents(inflow));
      if (outflow < 0) parts.push("Out " + this.formatCents(outflow));
      parts.push("Net " + this.formatCents(net));
      return parts.join(" · ");
    },
    /* Month-grid cell tooltip — just the In/Out/Net summary. The
       individual entries are already visible inline on the cell, so
       the tooltip's job is the day-level rollup, not a duplicate list. */
    cellTooltip(cell) {
      if (!cell || cell.blank) return "";
      var n = (cell.posted || []).length + (cell.scheduled || []).length;
      if (!n) return "";
      return this._periodSummary(cell);
    },
    /* Week-day cell tooltip — same shape (summary only). The entries
       are already visible as cards in the column. */
    weekCellTooltip(cell) {
      if (!cell) return "";
      var n = (cell.posted || []).length + (cell.scheduled || []).length;
      if (!n) return "";
      return this._periodSummary(cell);
    },
    /* Year-view mini cell tooltip. Lists actual payees + amounts so
       the user gets useful context on hover — the date is already
       visible on the cell. Caps at 5 entries with a "+N more" tail
       so the tooltip stays compact. */
    miniTooltip(cell) {
      if (!cell || cell.blank || !cell.count) return "";
      var self = this;
      var lines = [];
      (cell.posted || []).slice(0, 5).forEach(function (t) {
        var name = self.$store.budget.payeeName(t.payeeId) || (t.transferTxnId ? "Transfer" : "—");
        lines.push(name + "  " + self.formatCents(t.amount));
      });
      (cell.scheduled || []).slice(0, Math.max(0, 5 - lines.length)).forEach(function (s) {
        var name = self.$store.budget.payeeName(s.template.payeeId) || s.template.payeeName || "—";
        lines.push(name + "  " + self.formatCents(s.template.amount) + " (scheduled)");
      });
      var extra = cell.count - lines.length;
      if (extra > 0) lines.push("+ " + extra + " more");
      return lines.join(" • ");
    },

    openAccounts() {
      var p = this.$store.budget.profile;
      if (!p) return [];
      return p.accounts.filter(function (a) { return !a.closedAt; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    },
    selectableCategories() {
      var s = this.$store.budget;
      if (!s.profile) return [];
      return s.categoriesFlat().filter(function (c) { return !s.isPaymentCategory(c.id); });
    },

    /* ---------- period transactions modal ----------
       Generic: any caller passes a cells array + a kind filter
       ('in' / 'out' / 'all') + a title + a subtitle. The modal
       flattens cells → transactions, filters by kind, sorts by
       date desc, and renders the same clickable .cal-day__row
       list used by the year-day modal. */
    openPeriodModal(title, subtitle, kind, cells) {
      this.periodModalTitle = title || "Transactions";
      this.periodModalSubtitle = subtitle || "";
      this.periodModalKind = kind || "all";
      this.periodModalCells = cells || [];
      this.periodModalOpen = true;
    },
    closePeriodModal() { this.periodModalOpen = false; },
    periodModalTxns() {
      var cells = this.periodModalCells || [];
      var kind = this.periodModalKind;
      var posted = [];
      var scheduled = [];
      cells.forEach(function (c) {
        if (!c || c.blank) return;
        (c.posted || []).forEach(function (t) {
          if (kind === "in"  && !(t.amount > 0)) return;
          if (kind === "out" && !(t.amount < 0)) return;
          posted.push(t);
        });
        (c.scheduled || []).forEach(function (s) {
          if (kind === "in"  && !(s.template.amount > 0)) return;
          if (kind === "out" && !(s.template.amount < 0)) return;
          scheduled.push(s);
        });
      });
      posted.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      scheduled.sort(function (a, b) { return (a.nextDate || "").localeCompare(b.nextDate || ""); });
      return { posted: posted, scheduled: scheduled, count: posted.length + scheduled.length };
    },
    /* Full-period totals (regardless of the modal's kind filter) so
       the header stats always show the same In/Out/Net/Entries as
       the period header that opened the modal. */
    periodModalTotals() {
      var cells = this.periodModalCells || [];
      var inflow = 0, outflow = 0, count = 0;
      cells.forEach(function (c) {
        if (!c || c.blank) return;
        inflow  += c.totalInflow  || 0;
        outflow += c.totalOutflow || 0;
        count   += (c.posted ? c.posted.length : 0) + (c.scheduled ? c.scheduled.length : 0);
      });
      return { inflow: inflow, outflow: outflow, net: inflow + outflow, count: count };
    },

    /* ---------- year-day modal ----------
       Single-day summary popup triggered from any cell in the
       year-view mini-grids. Reuses dayData() for the rollup +
       transaction list. */
    openYearDay(iso) {
      if (!iso) return;
      this.yearDayISO = iso;
    },
    closeYearDay() { this.yearDayISO = null; },
    yearDayData() {
      if (!this.yearDayISO) return { posted: [], scheduled: [], totalInflow: 0, totalOutflow: 0, count: 0 };
      return this.dayData(this.yearDayISO);
    },

    /* ---------- drag to reschedule ---------- */
    /* The cell currently under the dragged item — drives the drop-
       target highlight ring. Reset on dragleave or drop. */
    dragOverISO: null,
    /* The id of the transaction picked up — stored on this.$root
       rather than dataTransfer alone so the @drop handler can
       reach it without re-parsing dataTransfer (works around
       Safari quirks where getData() returns "" on drop). */
    _dragTxnId: null,

    onDragStart(t, evt) {
      if (!t || t.reconciled || t.transferTxnId) {
        if (evt && evt.preventDefault) evt.preventDefault();
        return;
      }
      this._dragTxnId = t.id;
      try {
        evt.dataTransfer.effectAllowed = "move";
        evt.dataTransfer.setData("text/plain", t.id);
      } catch (_e) {}
    },

    dropOnDate(iso, evt) {
      this.dragOverISO = null;
      var id = this._dragTxnId || (evt && evt.dataTransfer && evt.dataTransfer.getData("text/plain"));
      this._dragTxnId = null;
      if (!id || !iso) return;
      var p = this.$store.budget.profile;
      if (!p) return;
      var t = (p.transactions || []).find(function (x) { return x.id === id; });
      if (!t) return;
      if (t.date === iso) return; /* dropped on same day — no-op */
      var result = this.$store.budget.updateTransaction(id, { date: iso });
      if (result) {
        this.$store.budget.pushToast("Moved transaction to " + iso + ".", "ok");
      } else {
        this.$store.budget.pushToast("Couldn't move — transaction may be reconciled.", "warn");
      }
    },

    /* ---------- transaction modal ---------- */
    openTxn(id) {
      var p = this.$store.budget.profile;
      if (!p) return;
      var t = (p.transactions || []).find(function (x) { return x.id === id; });
      if (!t) return;
      this.txnEditId = id;
      this.txnForm = {
        date: t.date,
        accountId: t.accountId,
        payeeName: this.$store.budget.payeeName(t.payeeId) || "",
        amount: ((t.amount || 0) / 100).toFixed(2),
        categoryId: t.categoryId || "",
        memo: t.memo || "",
        cleared: !!t.cleared,
      };
    },
    closeTxn() { this.txnEditId = null; },
    _parseDollars(s) {
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
    saveTxn() {
      if (!this.txnEditId) return;
      this.$store.budget.updateTransaction(this.txnEditId, {
        date: this.txnForm.date,
        accountId: this.txnForm.accountId,
        payeeName: this.txnForm.payeeName,
        amount: this._parseDollars(this.txnForm.amount),
        categoryId: this.txnForm.categoryId || null,
        memo: this.txnForm.memo,
        cleared: this.txnForm.cleared,
      });
      this.$store.budget.pushToast("Transaction updated.");
      this.closeTxn();
    },
    deleteTxn() {
      if (!this.txnEditId) return;
      /* Open custom confirm modal instead of native browser confirm()
         (which renders a chrome dialog titled "Code" / OS buttons). */
      this.confirmDeleteId = this.txnEditId;
    },
    confirmDeleteTxn() {
      var id = this.confirmDeleteId;
      if (!id) return;
      this.$store.budget.deleteTransaction(id);
      this.$store.budget.pushToast("Transaction deleted.");
      this.confirmDeleteId = null;
      this.closeTxn();
    },
    cancelDeleteTxn() { this.confirmDeleteId = null; },

    /* True when a posted or scheduled item passes all active filters. */
    _matchTxn(t) {
      if (this.filterAccountId && t.accountId !== this.filterAccountId) return false;
      if (this.filterKind === "scheduled") return false;
      if (this.filterKind === "inflow" && !(t.amount > 0)) return false;
      if (this.filterKind === "outflow" && !(t.amount < 0)) return false;
      return this._matchSearch(
        this.$store.budget.payeeName(t.payeeId),
        t.memo,
        this.$store.budget.categoryName(t.categoryId)
      );
    },
    _matchSched(s) {
      if (this.filterAccountId && s.template.accountId !== this.filterAccountId) return false;
      if (this.filterKind === "posted") return false;
      if (this.filterKind === "inflow"  && !(s.template.amount > 0)) return false;
      if (this.filterKind === "outflow" && !(s.template.amount < 0)) return false;
      return this._matchSearch(
        this.$store.budget.payeeName(s.template.payeeId) || s.template.payeeName,
        s.template.memo,
        this.$store.budget.categoryName(s.template.categoryId)
      );
    },
    _matchSearch(payee, memo, category) {
      var q = (this.searchQuery || "").trim().toLowerCase();
      if (!q) return true;
      var hay = ((payee || "") + " " + (memo || "") + " " + (category || "")).toLowerCase();
      return hay.indexOf(q) !== -1;
    },

    /* Computed shorthands so views can read .anchorDay / .selectedDay
       without a nested x-data (nested scope loses `this` for the
       projection memo helpers). */
    get anchorDay() { return this.dayData(this.anchorISO); },
    get selectedDay() { return this.dayData(this.selectedISO); },

    /* Returns { posted, scheduled, totalInflow, totalOutflow, count }.
       Scheduled entries come from the projection map so recurring
       templates surface on every future occurrence within the window.

       Indexed for speed: _txnsByDay() pre-buckets all transactions
       by ISO date in ONE pass, then dayData() does an O(1) lookup +
       a per-day filter walk (usually ≤5 rows). Previously walked all
       transactions per cell — at 1,399 txns × 35 month cells = ~49K
       iterations per render. Now: 1,399 once, 5 per cell. */
    _txnsByDayCache: null,
    _txnsByDayKey: null,
    _txnsByDay() {
      var s = this.$store.budget;
      var key = (s._listVersion || 0) + "|" + (this.filterAccountId || "") + "|" + (this.filterKind || "") + "|" + (this.searchQuery || "");
      if (this._txnsByDayKey === key && this._txnsByDayCache) return this._txnsByDayCache;
      var p = s.profile;
      var by = {};
      if (p && p.transactions) {
        var self = this;
        p.transactions.forEach(function (t) {
          if (!self._matchTxn(t)) return;
          var d = (t.date || "").slice(0, 10);
          if (!d) return;
          (by[d] = by[d] || []).push(t);
        });
      }
      this._txnsByDayCache = by;
      this._txnsByDayKey = key;
      return by;
    },

    dayData(iso) {
      var p = this.$store.budget.profile;
      var out = { posted: [], scheduled: [], totalInflow: 0, totalOutflow: 0, count: 0 };
      if (!p || !iso) return out;
      var dayPosted = this._txnsByDay()[iso] || [];
      out.posted = dayPosted;
      for (var i = 0; i < dayPosted.length; i++) {
        var amt = dayPosted[i].amount || 0;
        if (amt > 0) out.totalInflow  += amt;
        if (amt < 0) out.totalOutflow += amt;
      }
      var projected = (this._cachedProjected || this._scheduledByISO())[iso] || [];
      var self = this;
      projected.forEach(function (s) {
        if (!self._matchSched(s)) return;
        out.scheduled.push(s);
      });
      out.count = out.posted.length + out.scheduled.length;
      return out;
    },

    /* Roll a cell-array up into period totals. Reused by Week, Month,
       and Year views so all four views show the same labeled tiles. */
    _periodTotals(cells) {
      var inflow = 0, outflow = 0, count = 0;
      (cells || []).forEach(function (c) {
        if (!c || c.blank) return;
        inflow  += c.totalInflow  || 0;
        outflow += c.totalOutflow || 0;
        count   += (c.posted ? c.posted.length : 0) + (c.scheduled ? c.scheduled.length : 0);
      });
      return { inflow: inflow, outflow: outflow, net: inflow + outflow, count: count };
    },
    weekTotals()  { return this._periodTotals(this.weekCells()); },
    monthTotals() { return this._periodTotals(this.monthCells()); },
    yearTotals() {
      /* Sum the per-day mini cells across all 12 months. */
      var self = this;
      var inflow = 0, outflow = 0, count = 0;
      this.monthsOfYear().forEach(function (mm) {
        self.miniCells(mm.iso).forEach(function (c) {
          if (!c || c.blank) return;
          inflow  += c.totalInflow  || 0;
          outflow += c.totalOutflow || 0;
          count   += c.count || 0;
        });
      });
      return { inflow: inflow, outflow: outflow, net: inflow + outflow, count: count };
    },

    /* Net (inflow + outflow) across the named month (YYYY-MM).
       Sums from the pre-bucketed _txnsByDay map so it touches only
       the matching days, not every transaction. */
    monthNet(monthISO) {
      var p = this.$store.budget.profile;
      if (!p) return 0;
      var by = this._txnsByDay();
      var sum = 0;
      Object.keys(by).forEach(function (d) {
        if (d.slice(0, 7) !== monthISO) return;
        by[d].forEach(function (t) { sum += t.amount || 0; });
      });
      return sum;
    },

    /* ---------- grid builders ----------
       Each builder caches the schedule projection map once on entry so
       the per-cell dayData() lookups don't rebuild it for every day. */
    monthCells() {
      this._cachedProjected = this._scheduledByISO();
      var anchor = this._parseISO(this.anchorISO);
      var year = anchor.getFullYear();
      var monthIdx = anchor.getMonth(); /* 0..11 */
      var firstDayWeekday = new Date(year, monthIdx, 1).getDay();
      var today = this._isoDay(new Date());
      var cells = [];
      /* Start cell #0 at the Sunday of (or before) the 1st of the month. */
      var gridStart = new Date(year, monthIdx, 1 - firstDayWeekday);
      /* Always render six full weeks = 42 cells so the grid height never
         jumps when months have different numbers of weeks. */
      for (var i = 0; i < 42; i++) {
        var cur = new Date(gridStart);
        cur.setDate(gridStart.getDate() + i);
        var iso = this._isoDay(cur);
        var d = this.dayData(iso);
        cells.push({
          blank: false,
          key: iso,
          iso: iso,
          day: cur.getDate(),
          isToday: iso === today,
          otherMonth: cur.getMonth() !== monthIdx,
          posted: d.posted,
          scheduled: d.scheduled,
          totalInflow: d.totalInflow,
          totalOutflow: d.totalOutflow,
        });
      }
      this._cachedProjected = null;
      return cells;
    },

    weekCells() {
      this._cachedProjected = this._scheduledByISO();
      var start = this._startOfWeek(this._parseISO(this.anchorISO));
      var today = this._isoDay(new Date());
      var cells = [];
      for (var i = 0; i < 7; i++) {
        var d = new Date(start); d.setDate(start.getDate() + i);
        var iso = this._isoDay(d);
        var data = this.dayData(iso);
        cells.push({
          iso: iso,
          weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
          dayMonth: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          isToday: iso === today,
          posted: data.posted,
          scheduled: data.scheduled,
          totalInflow: data.totalInflow,
          totalOutflow: data.totalOutflow,
        });
      }
      this._cachedProjected = null;
      return cells;
    },

    /* Year view: 12 month tiles. */
    monthsOfYear() {
      var year = this.anchorYear();
      var labels = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      var self = this;
      return labels.map(function (label, i) {
        var iso = year + "-" + self._pad(i + 1);
        return { iso: iso, label: label };
      });
    },

    /* Mini-grid cells for one month in the year view. Calls dayData
       per day so the tooltip can list the actual posted + scheduled
       entries (caching the projection map for the duration). */
    miniCells(monthISO) {
      var parts = monthISO.split("-");
      var year = parseInt(parts[0], 10);
      var month = parseInt(parts[1], 10);
      var firstDay = new Date(year, month - 1, 1).getDay();
      var daysInMonth = new Date(year, month, 0).getDate();
      var today = this._isoDay(new Date());

      this._cachedProjected = this._scheduledByISO();
      var cells = [];
      for (var i = 0; i < firstDay; i++) cells.push({ blank: true, key: monthISO + "-blank-" + i });

      /* Build the cells first so we know maxCount for heatmap shading. */
      var dayCells = [];
      var maxCount = 0;
      for (var day = 1; day <= daysInMonth; day++) {
        var iso = year + "-" + this._pad(month) + "-" + this._pad(day);
        var d = this.dayData(iso);
        var count = d.posted.length + d.scheduled.length;
        if (count > maxCount) maxCount = count;
        dayCells.push({
          blank: false,
          key: iso,
          iso: iso,
          day: day,
          isToday: iso === today,
          count: count,
          posted: d.posted,
          scheduled: d.scheduled,
          totalInflow: d.totalInflow,
          totalOutflow: d.totalOutflow,
        });
      }
      dayCells.forEach(function (c) {
        c.intensity = maxCount > 0 ? Math.round((c.count / maxCount) * 100) : 0;
        cells.push(c);
      });
      this._cachedProjected = null;
      return cells;
    },

    /* Group miniCells into rows of 7 + attach an ISO week number to
       each row. Used by the year-view mini-grids to render a
       clickable leading column per week. */
    miniWeeks(monthISO) {
      var cells = this.miniCells(monthISO);
      var weeks = [];
      for (var i = 0; i < cells.length; i += 7) {
        var slice = cells.slice(i, i + 7);
        if (!slice.length) continue;
        /* Find the first non-blank ISO for week-number calculation;
           fall back to the slice's first iso (might be blank padding). */
        var firstWithIso = slice.find(function (c) { return !c.blank && c.iso; });
        var anchorIso = firstWithIso ? firstWithIso.iso : null;
        weeks.push({
          weekKey: monthISO + "-w" + (i / 7),
          weekNumber: anchorIso ? this._isoWeekNumber(anchorIso) : "",
          startISO: anchorIso || "",
          cells: slice,
        });
      }
      return weeks;
    },

    /* Same grouping as miniWeeks but for the main month-view grid.
       Splits monthCells() into 6 rows of 7 with an ISO week number
       attached to each row, used by the clickable week-number column. */
    monthWeeks(anchorISO) {
      var cells = anchorISO ? this.monthCellsFor(anchorISO) : this.monthCells();
      var monthKey = anchorISO ? this._isoMonth(this._parseISO(anchorISO)) : this.anchorMonthISO();
      var weeks = [];
      for (var i = 0; i < cells.length; i += 7) {
        var slice = cells.slice(i, i + 7);
        if (!slice.length) continue;
        var firstWithIso = slice.find(function (c) { return !c.blank && c.iso; });
        var anchorIso = firstWithIso ? firstWithIso.iso : null;
        weeks.push({
          weekKey: monthKey + "-w" + (i / 7),
          weekNumber: anchorIso ? this._isoWeekNumber(anchorIso) : "",
          startISO: anchorIso || "",
          cells: slice,
        });
      }
      return weeks;
    },
    /* ISO 8601 week number (1-53). Algorithm from
       https://en.wikipedia.org/wiki/ISO_week_date — Thursday in the
       same calendar week determines the year-of-the-week. */
    _isoWeekNumber(iso) {
      var d = this._parseISO(iso);
      var target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var dayNr = (target.getDay() + 6) % 7; /* Mon=0 .. Sun=6 */
      target.setDate(target.getDate() - dayNr + 3);
      var firstThursday = new Date(target.getFullYear(), 0, 4);
      var diff = target - firstThursday;
      var oneDay = 1000 * 60 * 60 * 24;
      return 1 + Math.round((diff / oneDay - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    },
    /* Per-month In/Out/Net rollup used by the year-view tile header. */
    miniMonthTotals(monthISO) {
      var cells = this.miniCells(monthISO);
      var inflow = 0, outflow = 0, count = 0;
      cells.forEach(function (c) {
        if (!c || c.blank) return;
        inflow  += c.totalInflow  || 0;
        outflow += c.totalOutflow || 0;
        count   += c.count || 0;
      });
      return { inflow: inflow, outflow: outflow, net: inflow + outflow, count: count };
    },

    /* Header readout — only meaningful when a filter is active. */
    visibleCount() {
      if (this.view === "year") {
        var sum = 0, self = this;
        this.monthsOfYear().forEach(function (mm) {
          self.miniCells(mm.iso).forEach(function (c) { if (!c.blank) sum += c.count; });
        });
        return sum;
      }
      if (this.view === "month") {
        var sum2 = 0;
        this.monthCells().forEach(function (c) { if (!c.blank) sum2 += c.posted.length + c.scheduled.length; });
        return sum2;
      }
      if (this.view === "week") {
        var sum3 = 0;
        this.weekCells().forEach(function (c) { sum3 += c.posted.length + c.scheduled.length; });
        return sum3;
      }
      var d = this.dayData(this.anchorISO);
      return d.posted.length + d.scheduled.length;
    },
  };
}

  window.calendarView = calendarView;
})();
