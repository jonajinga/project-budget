/* Category / group history page. Reads ?cat=ID or ?group=ID. */
function categoryView() {
  return {
    kind: "category",
    id: null,
    range: 12,
    txnLimit: 12,

    init() {
      var q = new URLSearchParams(location.search);
      if (q.get("group")) { this.kind = "group"; this.id = q.get("group"); }
      else { this.kind = "category"; this.id = q.get("cat"); }
      if (q.get("range")) this.range = Number(q.get("range")) || 12;
    },

    get s() { return this.$store.budget; },
    fmt(c) {
      var n = Math.round(Math.abs(c || 0));
      var str = "$" + Math.floor(n / 100).toLocaleString("en-US") + "." + String(n % 100).padStart(2, "0");
      return (c < 0 ? "-" : "") + str;
    },
    monthLabel(m, short) {
      if (!m) return "";
      var p = m.split("-").map(Number);
      var d = new Date(p[0], p[1] - 1, 1);
      return d.toLocaleDateString("en-US", short ? { month: "short", year: "2-digit" } : { month: "long", year: "numeric" });
    },
    setRange(n) {
      this.range = n;
      var u = new URL(location.href); u.searchParams.set("range", String(n)); history.replaceState(null, "", u.toString());
    },

    /* Subject */
    entity() {
      void this.s._listVersion;
      if (!this.id) return null;
      return this.kind === "group" ? this.s.findCategoryGroup(this.id) : this.s.findCategory(this.id);
    },
    found() { return !!this.entity(); },
    title() { var e = this.entity(); return e ? e.name : "Not found"; },
    eyebrow() {
      var e = this.entity();
      if (!e) return "";
      if (this.kind === "group") return "Category group";
      var g = e.groupId ? this.s.findCategoryGroup(e.groupId) : null;
      return g ? g.name : "Category";
    },
    groupHref() {
      var e = this.entity();
      if (!e || this.kind === "group" || !e.groupId) return "";
      return "/app/category/?group=" + encodeURIComponent(e.groupId);
    },
    isIncome() {
      if (!this.entity()) return false;
      return this.kind === "group" ? !!(this.s.isIncomeGroup && this.s.isIncomeGroup(this.id)) : !!this.s.isIncomeCategory(this.id);
    },
    memberCategories() {
      void this.s._listVersion;
      if (this.kind !== "group") return [];
      var s = this.s;
      return (s.profile.categories || []).filter(function (c) { return c.groupId === this.id && !(s.isPaymentCategory && s.isPaymentCategory(c.id)); }, this);
    },

    /* Series */
    series() {
      void this.s._listVersion;
      if (!this.found()) return [];
      return this.kind === "group" ? this.s.groupSeries(this.id, this.range) : this.s.categorySeries(this.id, this.range);
    },
    stats() { return this.s.seriesStats(this.series()); },
    now() { var r = this.series(); return r[r.length - 1] || { assigned: 0, outflow: 0, available: 0, activity: 0, inflow: 0 }; },
    flowKey() { return this.isIncome() ? "inflow" : "outflow"; },
    flowWord() { return this.isIncome() ? "Received" : "Spent"; },
    trend() {
      var t = this.stats().trendPct;
      if (t == null) return { text: "Not enough history", cls: "" };
      var up = t > 0;
      var word = this.isIncome() ? (up ? "up" : "down") : (up ? "up" : "down");
      var good = this.isIncome() ? up : !up;
      return { text: Math.abs(t) + "% " + word + " vs the 3 months before", cls: t === 0 ? "" : (good ? "kpi__delta--up" : "kpi__delta--down") };
    },
    availableClass() {
      var a = this.now().available;
      return a < 0 ? "kpi--danger" : (a > 0 ? "kpi--ok" : "kpi--muted");
    },

    /* Charts */
    flowChart() {
      var rows = this.series();
      var self = this, key = this.flowKey();
      return window.PBMini.bars({
        values: rows.map(function (r) { return r[key]; }),
        line: rows.map(function (r) { return r.assigned; }),
        labels: rows.map(function (r) { return self.monthLabel(r.month, true); }),
        highlight: rows.length - 1, height: 200,
        aria: this.flowWord() + " per month with assigned",
        valueClass: function (v, i) { return !self.isIncome() && rows[i].available < 0 ? "is-over" : ""; },
      });
    },
    availableChart() {
      var rows = this.series();
      var self = this;
      return window.PBMini.lines({
        labels: rows.map(function (r) { return self.monthLabel(r.month, true); }),
        series: [{ values: rows.map(function (r) { return r.available; }), cls: "is-accent", area: true }],
        height: 160, aria: "Available at the end of each month",
      });
    },

    /* Goal */
    goal() {
      void this.s._listVersion;
      if (this.kind !== "category" || !this.found()) return null;
      return this.s.findGoal(this.id);
    },
    goalTypeLabel(g) {
      var t = (this.s.GOAL_TYPES || []).find(function (x) { return x.value === g.type; });
      return t ? t.label : g.type;
    },
    goalStatusNow() { return this.goal() ? this.s.goalStatus(this.id) : null; },
    goalNeededNow() { return this.goal() ? this.s.goalNeeded(this.id) : 0; },
    goalHistory() {
      if (!this.goal()) return [];
      var self = this;
      return this.series().map(function (r) {
        var st = self.s.goalStatus(self.id, r.month);
        return { month: r.month, status: st, assigned: r.assigned };
      });
    },
    goalFundedCount() { return this.goalHistory().filter(function (r) { return r.status === "funded"; }).length; },
    goalPillClass(st) {
      return st === "funded" ? "hist__pill--ok" : (st === "partial" ? "hist__pill--warn" : (st === "over" ? "hist__pill--muted" : "hist__pill--danger"));
    },

    /* Cut */
    cut() {
      void this.s._listVersion;
      if (this.kind !== "category" || !this.found()) return null;
      return this.s.cutForCategory(this.id);
    },
    cutSeries() { var c = this.cut(); return c ? this.s.cutSeries(c.id) : null; },
    cutNow() { var s = this.cutSeries(); return s && s.rows.length ? s.rows[s.rows.length - 1] : null; },
    cutLabel() {
      var c = this.cut();
      if (!c) return "";
      return c.mode === "percent" ? (c.value / 100) + "% less than before" : this.fmt(c.value) + " less each month";
    },
    cutChart() {
      var s = this.cutSeries();
      if (!s) return "";
      var rows = s.rows.slice(-this.range);
      var self = this;
      return window.PBMini.bars({
        values: rows.map(function (r) { return r.saved > 0 ? r.saved : 0; }),
        line: rows.map(function (r) { return r.target; }),
        labels: rows.map(function (r) { return self.monthLabel(r.month, true); }),
        highlight: rows.length - 1, height: 140, aria: "Saved each month against the cut target",
        valueClass: function (v, i) { return rows[i].met ? "" : "is-over"; },
      });
    },

    /* Group breakdown */
    breakdown() {
      if (this.kind !== "group") return [];
      var self = this;
      var key = this.flowKey();
      var rows = this.memberCategories().map(function (c) {
        var ser = self.s.categorySeries(c.id, self.range);
        var total = ser.reduce(function (a, r) { return a + r[key]; }, 0);
        var last = ser[ser.length - 1] || { assigned: 0, outflow: 0, inflow: 0, available: 0 };
        return { id: c.id, name: c.name, total: total, avg: ser.length ? Math.round(total / ser.length) : 0, now: last[key], available: last.available, assigned: last.assigned, hidden: !!c.hidden };
      });
      var grand = rows.reduce(function (a, r) { return a + r.total; }, 0) || 1;
      rows.forEach(function (r) { r.share = Math.round((r.total / grand) * 1000) / 10; });
      rows.sort(function (a, b) { return b.total - a.total; });
      return rows;
    },
    maxShare() { var b = this.breakdown(); return b.length ? Math.max.apply(null, b.map(function (r) { return r.share; })) || 1 : 1; },

    /* Transactions */
    transactions() {
      void this.s._listVersion;
      if (!this.found()) return [];
      var s = this.s, id = this.id, kind = this.kind;
      var ids = kind === "group" ? this.memberCategories().map(function (c) { return c.id; }) : [id];
      var set = {};
      ids.forEach(function (x) { set[x] = true; });
      var out = [];
      (s.profile.transactions || []).forEach(function (t) {
        if (t.deletedAt) return;
        if (t.splits && t.splits.length) {
          t.splits.forEach(function (sp) { if (set[sp.categoryId]) out.push({ id: t.id + ":" + sp.categoryId, date: t.date, payee: s.payeeName(t.payeeId), amount: sp.amount, memo: sp.memo || t.memo || "", accountId: t.accountId, categoryId: sp.categoryId }); });
        } else if (set[t.categoryId]) {
          out.push({ id: t.id, date: t.date, payee: s.payeeName(t.payeeId), amount: t.amount, memo: t.memo || "", accountId: t.accountId, categoryId: t.categoryId });
        }
      });
      out.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
      return out;
    },
    recentTransactions() { return this.transactions().slice(0, this.txnLimit); },
    accountName(id) { var a = this.s.findAccount(id); return a ? a.name : ""; },
    catName(id) { return this.s.categoryName ? this.s.categoryName(id) : ""; },
    topPayees() {
      var totals = {};
      var key = this.isIncome() ? 1 : -1;
      var months = this.series().map(function (r) { return r.month; });
      var first = months[0] || "";
      this.transactions().forEach(function (t) {
        if (t.date.slice(0, 7) < first) return;
        var v = t.amount * key;
        if (v <= 0) return;
        var name = t.payee || "(no payee)";
        totals[name] = (totals[name] || 0) + v;
      });
      var arr = Object.keys(totals).map(function (k) { return { name: k, total: totals[k] }; });
      arr.sort(function (a, b) { return b.total - a.total; });
      var grand = arr.reduce(function (a, r) { return a + r.total; }, 0) || 1;
      arr.forEach(function (r) { r.share = Math.round((r.total / grand) * 1000) / 10; });
      return arr.slice(0, 6);
    },
    note() { var e = this.entity(); return e && e.note ? e.note : ""; },
    budgetHref() { return "/app/budget/?month=" + this.s.currentMonth; },
    registerHref() { return "/app/register/?q=" + encodeURIComponent(this.title()); },
    cutsHref() { return "/app/cuts/"; },
    memberHref(id) { return "/app/category/?cat=" + encodeURIComponent(id); },
  };
}
