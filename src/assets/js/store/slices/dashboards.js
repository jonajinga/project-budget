/* Dashboards slice — multiple named dashboards, each an ordered list of
 * sized widgets.
 *
 * LAYOUT MODEL. A dashboard is an ORDERED LIST, not a free x/y plane. Each
 * widget carries a width in columns and a height in rows, and position comes
 * from its place in the list; the grid flows them left to right, wrapping.
 *
 * That is a deliberate constraint. Free positioning reads better in a demo
 * and behaves badly everywhere else: it needs collision resolution, it
 * strands widgets in mid-air when a neighbour shrinks, it leaves holes that
 * look like bugs, and none of it survives being reflowed to one column on a
 * phone -- where an absolute y is meaningless and every dashboard has to
 * become a list anyway. A flow model IS the phone layout at 12 columns, so
 * one arrangement works at every width and "move" means the same thing on a
 * desktop and a handset.
 *
 * SHARING. exportDefinition() emits layout only -- sources, views, params,
 * sizes and order -- and never touches transactions, balances or names of
 * accounts. That split exists so sharing a dashboard can never leak a
 * number by accident: what travels is the SHAPE of a view, and it fills with
 * the recipient's own data. A rendered snapshot with real figures is a
 * separate, explicit action (PDF), and when the Worker lands, publishing a
 * definition to it is one more target for the same payload rather than a
 * different feature.
 *
 * Every mutator records undo and saves, like every other slice.
 */

import { newId } from "../schema.js";
import {
  DEFAULT_LAYOUT, SOURCES, sourceSpec, viewSpec, viewsForSource,
  normalizeWidget, legacyTypeToWidget, isLegacyWidget, availableSources, clampSize,
} from "../../domain/dashboard-widgets.js";

function nowISO() { return new Date().toISOString(); }

/* Everything that creates a widget goes through normalizeWidget, so a record
   can never exist in a shape the renderer has to defend against. */
function makeWidget(descriptor) {
  var d = typeof descriptor === "string" ? { source: descriptor } : (descriptor || {});
  var src = sourceSpec(d.source);
  if (!src) return null;
  return normalizeWidget({
    source: d.source,
    view: d.view || src.defaultView,
    params: d.params,
    settings: d.settings,
    title: d.title,
    w: d.w != null ? d.w : src.w,
    h: d.h != null ? d.h : src.h,
  }, newId);
}

function makeDashboard(name, layout) {
  var now = nowISO();
  var ids = layout || DEFAULT_LAYOUT;
  var widgets = [];
  for (var i = 0; i < ids.length; i++) {
    var w = makeWidget(ids[i]);
    if (w) widgets.push(w);
  }
  return {
    id: newId(),
    name: name || "Dashboard",
    widgets: widgets,
    createdAt: now,
    updatedAt: now,
    version: 1,
    deletedAt: null,
  };
}

export const dashboardsSlice = {
  /* ---- reading ---- */

  /* Live dashboards, oldest first. Seeds the default one on first read
     rather than in a migration: a profile can arrive from an older export,
     an import, or the bundled sample, and all three paths converge here.
     normalizeShape() guarantees the array exists. */
  dashboardList() {
    if (!this.profile) return [];
    if (!Array.isArray(this.profile.dashboards)) this.profile.dashboards = [];
    if (!this.profile.dashboards.length) {
      this.profile.dashboards.push(makeDashboard("Overview"));
      /* No undo entry and no toast: this is not something the user did. */
      this._save();
    }
    /* Upgrade v1 records where they are read, not in a migration file.
       Profiles arrive from four directions -- newProfile, an older export, an
       import, and the bundled sample -- and the read path is the only one all
       four share. Idempotent by construction: normalizeWidget returns a v2
       record unchanged, so this can run on every read. */
    var upgraded = false;
    for (var di = 0; di < this.profile.dashboards.length; di++) {
      var dash = this.profile.dashboards[di];
      if (!dash || !Array.isArray(dash.widgets)) continue;
      if (!dash.widgets.some(isLegacyWidget)) continue;
      var next = [];
      for (var wi = 0; wi < dash.widgets.length; wi++) {
        var up = legacyTypeToWidget(dash.widgets[wi], newId);
        if (up) next.push(up);
      }
      dash.widgets = next;
      upgraded = true;
    }
    if (upgraded) this._save();

    return this.profile.dashboards.filter(function (d) { return !d.deletedAt; });
  },

  activeDashboardId() {
    var list = this.dashboardList();
    if (!list.length) return null;
    var want = this.profile && this.profile.settings ? this.profile.settings.activeDashboardId : null;
    for (var i = 0; i < list.length; i++) if (list[i].id === want) return want;
    return list[0].id;
  },

  activeDashboard() {
    var id = this.activeDashboardId();
    var list = this.dashboardList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || null;
  },

  findDashboard(id) {
    var list = this.dashboardList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  },

  /* A user-supplied title always wins; otherwise the source names itself.
     Titles are why two widgets from one source with different ranges are
     tellable apart, so this is not cosmetic. */
  widgetTitle(widget) {
    if (widget && typeof widget.title === "string" && widget.title) return widget.title;
    var spec = sourceSpec(widget && widget.source);
    return spec ? spec.title : "Widget";
  },

  /* The height policy differs by kind: a chart needs a fixed box because
     Chart.js sizes to its container, everything else grows to its content. */
  widgetKind(widget) {
    var v = viewSpec(widget && widget.view);
    if (!v) return "panel";
    if (v.kind === "panel") return v.chart ? "chart" : "panel";
    return v.kind;
  },

  /* Types already placed on a dashboard, so the picker can grey out the
     singletons instead of letting someone add a second "Today's summary"
     and wonder why the screen looks broken. */
  widgetTypesOn(dashId) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    var out = Object.create(null);
    if (!d) return out;
    for (var i = 0; i < d.widgets.length; i++) out[d.widgets[i].source] = true;
    return out;
  },

  availableWidgets(dashId) {
    var used = this.widgetTypesOn(dashId);
    return availableSources(used);
  },

  /* ---- dashboard CRUD ---- */

  setActiveDashboard(id) {
    if (!this.profile) return;
    if (!this.profile.settings || typeof this.profile.settings !== "object") this.profile.settings = {};
    this.profile.settings.activeDashboardId = id;
    /* Switching which dashboard you are looking at is navigation, not an
       edit: no undo entry, and no version bump on the dashboard itself. */
    this._save();
    this._bumpLists();
  },

  createDashboard(name, layout) {
    if (!this.profile) return null;
    this._recordUndo("Create dashboard");
    if (!Array.isArray(this.profile.dashboards)) this.profile.dashboards = [];
    var d = makeDashboard(name || "New dashboard", layout || []);
    this.profile.dashboards.push(d);
    this.setActiveDashboard(d.id);
    this._bumpLists();
    this._save();
    this.pushToast("Dashboard created");
    return d;
  },

  renameDashboard(id, name) {
    var d = this.findDashboard(id);
    if (!d) return;
    var clean = String(name || "").trim();
    if (!clean) return;
    this._recordUndo("Rename dashboard");
    d.name = clean;
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
  },

  duplicateDashboard(id) {
    var d = this.findDashboard(id);
    if (!d) return null;
    this._recordUndo("Duplicate dashboard");
    var copy = JSON.parse(JSON.stringify(d));
    copy.id = newId();
    copy.name = d.name + " copy";
    copy.createdAt = copy.updatedAt = nowISO();
    copy.version = 1;
    /* Fresh widget ids: sharing ids between two dashboards means editing one
       widget could address the other's. */
    for (var i = 0; i < copy.widgets.length; i++) copy.widgets[i].id = newId();
    this.profile.dashboards.push(copy);
    this.setActiveDashboard(copy.id);
    this._bumpLists();
    this._save();
    this.pushToast("Dashboard duplicated");
    return copy;
  },

  /* Soft delete, per the project's rule about never hard-deleting user data.
     Refuses the last one: a dashboard screen with no dashboard is a dead end
     that needs its own empty state and a way back, and "you cannot delete
     the only one" is the simpler promise. */
  deleteDashboard(id) {
    var live = this.dashboardList();
    if (live.length <= 1) {
      this.pushToast("That's your only dashboard — rename or reset it instead");
      return false;
    }
    var d = this.findDashboard(id);
    if (!d) return false;
    this._recordUndo("Delete dashboard");
    d.deletedAt = nowISO();
    if (this.activeDashboardId() === id) {
      var remaining = this.dashboardList();
      if (remaining.length) this.setActiveDashboard(remaining[0].id);
    }
    this._bumpLists();
    this._save();
    this.pushToast("Dashboard deleted — undo to bring it back");
    return true;
  },

  resetDashboard(id) {
    var d = this.findDashboard(id);
    if (!d) return;
    this._recordUndo("Reset dashboard");
    var fresh = makeDashboard(d.name);
    d.widgets = fresh.widgets;
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
    this.pushToast("Layout reset");
  },

  /* ---- widget operations ---- */

  addWidget(dashId, descriptor) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    if (!d) return null;
    var sourceId = typeof descriptor === "string" ? descriptor : (descriptor && descriptor.source);
    var spec = sourceSpec(sourceId);
    if (!spec) return null;
    if (spec.singleton && this.widgetTypesOn(d.id)[sourceId]) {
      this.pushToast("That widget is already on this dashboard");
      return null;
    }
    var w = makeWidget(descriptor);
    if (!w) return null;
    this._recordUndo("Add widget");
    d.widgets.push(w);
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
    this.pushToast((w.title || spec.title) + " added");
    return w;
  },

  removeWidget(dashId, widgetId) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    if (!d) return;
    var idx = d.widgets.findIndex(function (w) { return w.id === widgetId; });
    if (idx < 0) return;
    var label = this.widgetTitle(d.widgets[idx]);
    this._recordUndo("Remove widget");
    d.widgets.splice(idx, 1);
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
    this.pushToast(label + " removed - undo to bring it back");
  },

  /* Order IS position, so moving a widget is a splice. Index is clamped
     rather than rejected: drag handlers routinely compute one past the end,
     and dropping a widget into nothing is worse than dropping it last. */
  moveWidget(dashId, widgetId, toIndex) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    if (!d) return;
    var from = d.widgets.findIndex(function (w) { return w.id === widgetId; });
    if (from < 0) return;
    var to = Math.max(0, Math.min(d.widgets.length - 1, parseInt(toIndex, 10)));
    if (to === from) return;
    this._recordUndo("Move widget");
    var moved = d.widgets.splice(from, 1)[0];
    d.widgets.splice(to, 0, moved);
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
  },

  resizeWidget(dashId, widgetId, w, h) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    if (!d) return;
    var widget = d.widgets.find(function (x) { return x.id === widgetId; });
    if (!widget) return;
    var size = clampSize(widget.source, widget.view, w, h);
    if (size.w === widget.w && size.h === widget.h) return;
    this._recordUndo("Resize widget");
    widget.w = size.w;
    widget.h = size.h;
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
  },

  /* ONE undo entry for a whole reconfiguration. The settings dialog can change
     the title, the view, several params and several view settings at once;
     that is one decision by the user and must be one step in history. */
  updateWidget(dashId, widgetId, patch) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    if (!d) return null;
    var idx = d.widgets.findIndex(function (x) { return x.id === widgetId; });
    if (idx < 0) return null;
    var current = d.widgets[idx];
    var merged = normalizeWidget({
      id: current.id,
      source: (patch && patch.source) || current.source,
      view: patch && patch.view !== undefined ? patch.view : current.view,
      params: patch && patch.params !== undefined ? patch.params : current.params,
      settings: patch && patch.settings !== undefined ? patch.settings : current.settings,
      title: patch && patch.title !== undefined ? patch.title : current.title,
      w: patch && patch.w !== undefined ? patch.w : current.w,
      h: patch && patch.h !== undefined ? patch.h : current.h,
    }, newId);
    if (!merged) return null;
    this._recordUndo("Configure widget");
    d.widgets[idx] = merged;
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
    return merged;
  },

  /* The fastest route to the capability this rebuild exists for: the same
     source twice, with different params, side by side. */
  duplicateWidget(dashId, widgetId) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    if (!d) return null;
    var idx = d.widgets.findIndex(function (x) { return x.id === widgetId; });
    if (idx < 0) return null;
    var src = sourceSpec(d.widgets[idx].source);
    if (src && src.singleton) {
      this.pushToast("That widget can only appear once");
      return null;
    }
    this._recordUndo("Duplicate widget");
    var copy = normalizeWidget(JSON.parse(JSON.stringify(d.widgets[idx])), newId);
    copy.id = newId();
    d.widgets.splice(idx + 1, 0, copy);
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
    return copy;
  },

  /* The one data path every non-panel widget renders through. Panels return
     null and read the store from their own markup, as they always have. */
  widgetData(widget) {
    void this._listVersion;
    var spec = sourceSpec(widget && widget.source);
    if (!spec || !spec.method || typeof this[spec.method] !== "function") return null;
    var params = this._resolveParams(spec, widget.params || {});
    var args = (spec.args || []).map(function (k) { return params[k]; });
    try {
      return this[spec.method].apply(this, args);
    } catch (err) {
      /* A report that throws must not take the page with it. Every route is
         gated by router-all-routes.spec.js on ANY console.error, and one bad
         widget should degrade to an empty card rather than failing a build or
         blanking a dashboard. warn, deliberately, not error. */
      console.warn("widget data failed for", widget.source, err);
      return null;
    }
  },

  /* A null param means "follow the app", which is what keeps a widget current
     instead of pinned to whenever it was created. Most methods already treat
     null that way. Ranges do not: reportYearOverYear dereferences .from
     immediately, so a null range is a TypeError rather than a default. The
     range is resolved here, anchored on currentMonth, matching what
     /app/reports/year-over-year/ computes for its own initial state. */
  _resolveParams(spec, params) {
    var out = {};
    var self = this;
    (spec.params || []).forEach(function (decl) {
      var v = params[decl.key];
      if (decl.type === "month" && !v && decl.resolveBack) {
        out[decl.key] = self._monthsBack(
          self.currentMonth || new Date().toISOString().slice(0, 7), decl.resolveBack);
        return;
      }
      if (decl.type === "range" && !v) {
        var anchor = self.currentMonth || new Date().toISOString().slice(0, 7);
        var isPrior = decl.key === "priorRange";
        out[decl.key] = {
          from: self._monthsBack(anchor, isPrior ? 23 : 11),
          to: self._monthsBack(anchor, isPrior ? 12 : 0),
        };
        return;
      }
      out[decl.key] = v;
    });
    return out;
  },

  _monthsBack(month, n) {
    var parts = String(month).split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1 - n, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  },

  /* ---- what the generic views read ----
     table, list and stat have no renderer of their own: they are markup over
     a source's declared fields. That is the whole reason adding a source costs
     one registry entry and nothing else. */

  widgetFields(widget) {
    var spec = sourceSpec(widget && widget.source);
    return (spec && spec.fields) || [];
  },

  /* Rows for a table or list. `series` and `rows` are both arrays of objects,
     so one path serves both; anything else (a graph, a matrix) has no tabular
     reading and returns empty rather than rendering nonsense. */
  widgetRows(widget) {
    void this._listVersion;
    var spec = sourceSpec(widget && widget.source);
    if (!spec || (spec.shape !== "series" && spec.shape !== "rows")) return [];
    var data = this.widgetData(widget);
    return Array.isArray(data) ? data : [];
  },

  /* One number plus a caption. Aggregates the source's first money field,
     because that is what a person means by "the number" for a spending or
     income report; the aggregation itself is a view setting. */
  widgetStat(widget) {
    void this._listVersion;
    var fields = this.widgetFields(widget);
    var field = null;
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].numeric) { field = fields[i]; break; }
    }
    if (!field) return null;
    var rows = this.widgetRows(widget);
    var values = [];
    for (var r = 0; r < rows.length; r++) {
      var v = Number(rows[r][field.key]);
      if (isFinite(v)) values.push(v);
    }
    if (!values.length) return { value: 0, label: field.label, money: !!field.money, empty: true };
    var agg = (widget.settings && widget.settings.agg) || "sum";
    var value;
    if (agg === "avg") value = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    else if (agg === "last") value = values[values.length - 1];
    else if (agg === "max") value = Math.max.apply(null, values);
    else value = values.reduce(function (a, b) { return a + b; }, 0);
    var caption = { sum: "Total", avg: "Average", last: "Latest", max: "Highest" }[agg] || "Total";
    return {
      value: Math.round(value),
      label: caption + " " + field.label.toLowerCase(),
      money: !!field.money,
      percent: !!field.percent,
      count: values.length,
    };
  },

  /* The chart module a widget's view names, for the chart controller. */
  widgetModule(widget) {
    var v = viewSpec(widget && widget.view);
    return v && v.module ? v.module : "";
  },

  /* Libraries a widget's view needs before it can draw. D3 is 280KB and only
     three of the eleven renderers want it, so a dashboard with no D3 chart
     should never pay for it. */
  widgetNeeds(widget) {
    var v = viewSpec(widget && widget.view);
    var s = sourceSpec(widget && widget.source);
    var out = [];
    [(v && v.needs) || [], (s && s.needs) || []].forEach(function (list) {
      list.forEach(function (n) { if (out.indexOf(n) === -1) out.push(n); });
    });
    return out;
  },

  /* ---- what the builder asks for ---- */

  paramsFor(sourceId) {
    var spec = sourceSpec(sourceId);
    return (spec && spec.params) || [];
  },

  sourceTitle(sourceId) {
    var spec = sourceSpec(sourceId);
    return spec ? spec.title : "";
  },

  /* Default geometry for a source/view pair. The view's minimum wins where it
     is larger, so switching a chart to a big number does not leave a 4-row
     hole where a two-row figure now sits. */
  defaultSizeFor(sourceId, viewId) {
    var spec = sourceSpec(sourceId);
    return clampSize(sourceId, viewId, spec ? spec.w : 6, spec ? spec.h : 4);
  },

  /* A draft, normalised exactly as it would be if stored, so the preview
     shows the widget you are actually going to get - clamped size, coerced
     params, fallback view and all - rather than an idealised version of it. */
  previewWidget(draft) {
    var w = normalizeWidget(draft, newId);
    if (!w) return null;
    w.id = "preview";
    return w;
  },

  /* Which views the builder may offer for a source. */
  viewsFor(sourceId) {
    return viewsForSource(sourceSpec(sourceId)).map(function (id) {
      var v = viewSpec(id);
      return { id: id, title: v.title, kind: v.kind };
    });
  },

  setWidgetSettings(dashId, widgetId, settings) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    if (!d) return;
    var widget = d.widgets.find(function (x) { return x.id === widgetId; });
    if (!widget) return;
    this._recordUndo("Change widget settings");
    widget.settings = Object.assign({}, widget.settings, settings || {});
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
  },

  /* ---- portability ----
     Layout only. See the header: this payload is safe to hand to anyone
     because it contains no figures, and it is the same payload a future
     Worker would publish. */
  exportDefinition(id) {
    var d = this.findDashboard(id) || this.activeDashboard();
    if (!d) return null;
    return {
      kind: "projectbudget.dashboard",
      formatVersion: 2,
      name: d.name,
      exportedAt: nowISO(),
      widgets: d.widgets.map(function (w) {
        return {
          source: w.source, view: w.view, params: w.params || {},
          settings: w.settings || {}, title: w.title || "", w: w.w, h: w.h,
        };
      }),
    };
  },

  /* Untrusted input: a file someone was sent, or hand-edited. Unknown widget
     types are dropped rather than rendered as a blank card, sizes are
     clamped, and anything that is not this format is refused outright --
     importing a transactions export as a dashboard should say so, not
     produce an empty screen. */
  importDefinition(payload) {
    if (!this.profile) return null;
    var data = payload;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (_e) { this.pushToast("That file isn't a dashboard"); return null; }
    }
    if (!data || data.kind !== "projectbudget.dashboard" || !Array.isArray(data.widgets)) {
      this.pushToast("That file isn't a dashboard");
      return null;
    }
    var widgets = [];
    var skipped = 0;
    for (var i = 0; i < data.widgets.length; i++) {
      /* v1 files carry `type`, v2 carry `source`; legacyTypeToWidget accepts
         either, and normalizeWidget strips anything not declared -- which is
         what stops a hand-edited file introducing an x/y layout model the rest
         of the app does not implement. */
      var w = legacyTypeToWidget(data.widgets[i], newId);
      if (!w) { skipped++; continue; }
      widgets.push(w);
    }
    if (!widgets.length) { this.pushToast("That dashboard had no widgets this version understands"); return null; }
    this._recordUndo("Import dashboard");
    var d = makeDashboard(String(data.name || "Imported dashboard"), []);
    d.widgets = widgets;
    this.profile.dashboards.push(d);
    this.setActiveDashboard(d.id);
    this._bumpLists();
    this._save();
    this.pushToast(skipped ? "Dashboard imported — " + skipped + " unknown widget(s) skipped" : "Dashboard imported");
    return d;
  },

  _touchDashboard(d) {
    d.updatedAt = nowISO();
    d.version = (d.version || 1) + 1;
  },
};
