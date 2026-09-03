/* Cuts page: the whole portfolio of planned cuts, with history and
   impact. Alpine factory; needs window.PBMini for the charts. */
function cutsView() {
  return {
    editOpen: false,
    editId: null,
    form: { categoryId: "", mode: "percent", value: "", startMonth: "", goalLabel: "", targetMonth: "" },
    formError: "",
    range: 12,

    init() {
      var self = this;
      var ready = function () {
        if (self.$store.budget.loading) return false;
        return true;
      };
      var t = setInterval(function () { if (ready()) clearInterval(t); }, 100);
    },

    get s() { return this.$store.budget; },
    fmt(c) {
      var n = Math.round(Math.abs(c || 0));
      var str = "$" + Math.floor(n / 100).toLocaleString("en-US") + "." + String(n % 100).padStart(2, "0");
      return (c < 0 ? "-" : "") + str;
    },
    fmtWhole(c) { return (c < 0 ? "-" : "") + "$" + Math.round(Math.abs(c) / 100).toLocaleString("en-US"); },
    monthLabel(m, short) {
      if (!m) return "";
      var p = m.split("-").map(Number);
      var d = new Date(p[0], p[1] - 1, 1);
      return d.toLocaleDateString("en-US", short ? { month: "short", year: "2-digit" } : { month: "long", year: "numeric" });
    },
    portfolio() {
      void this.s._listVersion;
      return this.s.cutsPortfolio(this.s.currentMonth);
    },
    hasCuts() { return this.portfolio().cuts.length > 0; },
    totals() { return this.portfolio().totals; },
    timeline() {
      var tl = this.portfolio().timeline;
      return this.range ? tl.slice(-this.range) : tl;
    },
    ageNow() { var a = this.s.ageOfMoneyStat(); return typeof a === "number" ? a : null; },
    ageProjected() { var a = this.s.projectedAgeOfMoneyStat(this.s.currentMonth); return typeof a === "number" ? a : null; },
    inflowShare() {
      /* Planned monthly savings against the average income of the last
         three closed months, to one decimal. */
      var idx = this.s._monthIndex();
      var m = this.s.currentMonth, total = 0;
      for (var i = 0; i < 3; i++) { m = prevOf(m); total += (idx.inflow && idx.inflow[m]) || 0; }
      var avg = total / 3;
      return avg > 0 ? Math.round(this.totals().planned / avg * 1000) / 10 : null;
      function prevOf(x) { var p = x.split("-").map(Number); var d = new Date(p[0], p[1] - 2, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
    },
    yearsToSave(cents) {
      var annual = this.totals().annual;
      if (!annual) return null;
      return cents / annual;
    },

    /* Charts */
    cumulativeChart() {
      var tl = this.timeline();
      if (!tl.length) return window.PBMini.lines({ series: [], labels: [] });
      var self = this;
      return window.PBMini.lines({
        labels: tl.map(function (r) { return self.monthLabel(r.month, true); }),
        series: [
          { values: tl.map(function (r) { return r.cumPlanned; }), cls: "is-muted" },
          { values: tl.map(function (r) { return r.cumSaved; }), cls: "is-ok", area: true },
        ],
        height: 200, aria: "Cumulative saved versus planned",
      });
    },
    monthlyChart() {
      var tl = this.timeline();
      var self = this;
      return window.PBMini.bars({
        values: tl.map(function (r) { return Math.max(0, r.saved); }),
        line: tl.map(function (r) { return r.planned; }),
        labels: tl.map(function (r) { return self.monthLabel(r.month, true); }),
        highlight: tl.length - 1, height: 180, aria: "Saved per month versus planned",
      });
    },
    cutChart(c) {
      var rows = c.series.rows.slice(-this.range);
      var self = this;
      return window.PBMini.bars({
        values: rows.map(function (r) { return r.actual; }),
        line: rows.map(function (r) { return r.target > 0 ? r.baseline - r.target : r.baseline; }),
        labels: rows.map(function (r) { return self.monthLabel(r.month, true); }),
        highlight: rows.length - 1, height: 150, aria: "Spending versus the cut target",
        valueClass: function (v, i) { return rows[i].met ? "" : "is-over"; },
      });
    },

    /* Per-cut helpers */
    cutLabel(c) {
      return c.cut.mode === "percent" ? (c.cut.value / 100) + "% less" : this.fmt(c.cut.value) + " less per month";
    },
    hitRate(c) { return c.series.monthsActive ? Math.round((c.series.monthsMet / c.series.monthsActive) * 100) : 0; },
    statusPill(c) {
      if (!c.series.monthsActive) return { cls: "hist__pill--muted", text: "Not started" };
      if (c.now.target <= 0) return { cls: "hist__pill--muted", text: "No target" };
      if (c.now.saved >= c.now.target) return { cls: "hist__pill--ok", text: "On track" };
      if (c.now.saved > 0) return { cls: "hist__pill--warn", text: "Partly met" };
      return { cls: "hist__pill--danger", text: "Missed" };
    },
    pctOfTarget(c) {
      if (c.now.target <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((c.now.saved / c.now.target) * 100)));
    },
    toward(c) {
      if (!c.cut.goalLabel && !c.cut.targetMonth) return "";
      var out = c.cut.goalLabel || "goal";
      if (c.cut.targetMonth) out += " by " + this.monthLabel(c.cut.targetMonth);
      return out;
    },
    categoryHref(c) { return "/app/category/?cat=" + encodeURIComponent(c.cut.categoryId); },

    /* Add / edit */
    categoryOptions() {
      void this.s._listVersion;
      var s = this.s;
      var groups = s.categoryGroupsView ? s.categoryGroupsView() : [];
      var out = [];
      groups.forEach(function (g) {
        if (s.isIncomeGroup && s.isIncomeGroup(g.id)) return;
        (g.categories || []).forEach(function (c) {
          if (s.isPaymentCategory && s.isPaymentCategory(c.id)) return;
          if (c.hidden) return;
          out.push({ id: c.id, label: g.name + " / " + c.name });
        });
      });
      return out;
    },
    baselinePreview() {
      if (!this.form.categoryId) return 0;
      var idx = this.s._monthIndex();
      var m = this.s.currentMonth;
      var total = 0, n = 0;
      var mm = m;
      for (var i = 0; i < 3; i++) {
        mm = this.s.prevMonthOf ? this.s.prevMonthOf(mm) : prevOf(mm);
        var a = idx.act && idx.act[mm] ? (idx.act[mm][this.form.categoryId] || 0) : 0;
        total += Math.max(0, -a); n += 1;
      }
      return n ? Math.round(total / n) : 0;
      function prevOf(x) { var p = x.split("-").map(Number); var d = new Date(p[0], p[1] - 2, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
    },
    targetPreview() {
      var b = this.baselinePreview();
      var v = Number(this.form.value) || 0;
      if (this.form.mode === "percent") return Math.round(b * v / 100);
      return Math.min(b, Math.round(v * 100));
    },
    openAdd(catId) {
      this.editId = null;
      this.form = { categoryId: catId || "", mode: "percent", value: "10", startMonth: this.s.currentMonth, goalLabel: "", targetMonth: "" };
      this.formError = "";
      this.editOpen = true;
    },
    openEdit(c) {
      this.editId = c.cut.id;
      this.form = {
        categoryId: c.cut.categoryId, mode: c.cut.mode,
        value: c.cut.mode === "percent" ? String(c.cut.value / 100) : (c.cut.value / 100).toFixed(2),
        startMonth: c.cut.startMonth, goalLabel: c.cut.goalLabel || "", targetMonth: c.cut.targetMonth || "",
      };
      this.formError = "";
      this.editOpen = true;
    },
    submit() {
      var f = this.form;
      var v = Number(f.value);
      if (!f.categoryId) { this.formError = "Pick a category."; return; }
      if (!(v > 0)) { this.formError = "Enter how much to cut."; return; }
      if (f.mode === "percent" && v > 100) { this.formError = "A percent cut cannot exceed 100."; return; }
      if (!/^\d{4}-\d{2}$/.test(f.startMonth || "")) { this.formError = "Pick a start month."; return; }
      var payload = {
        categoryId: f.categoryId, mode: f.mode,
        value: Math.round(v * 100),
        startMonth: f.startMonth, goalLabel: f.goalLabel.trim(), targetMonth: f.targetMonth || null,
      };
      if (this.editId) this.s.updateCut(this.editId, payload);
      else this.s.addCut(payload);
      this.editOpen = false;
    },
    remove(c) {
      var self = this;
      var name = c.name;
      var go = function () { self.s.removeCut(c.cut.id); };
      if (window.PBDialog && window.PBDialog.confirm) {
        window.PBDialog.confirm({ title: "Remove this cut?", message: "The plan for " + name + " is removed. Nothing about your transactions changes.", confirmLabel: "Remove" }).then(function (ok) { if (ok) go(); });
      } else if (window.confirm("Remove the cut on " + name + "?")) go();
    },
  };
}
