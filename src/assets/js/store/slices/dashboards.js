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
 * SHARING. exportDefinition() emits layout only -- widget types, sizes,
 * order, settings -- and never touches transactions, balances or names of
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
import { DEFAULT_LAYOUT, WIDGETS, widgetSpec, clampSize } from "../../domain/dashboard-widgets.js";

function nowISO() { return new Date().toISOString(); }

function makeWidget(type) {
  var spec = widgetSpec(type);
  if (!spec) return null;
  return { id: newId(), type: type, w: spec.w, h: spec.h, settings: {} };
}

function makeDashboard(name, layout) {
  var now = nowISO();
  var types = layout || DEFAULT_LAYOUT;
  var widgets = [];
  for (var i = 0; i < types.length; i++) {
    var w = makeWidget(types[i]);
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

  /* The template needs a widget's human title, and the catalogue is an ES
     module while the page's dashboardView() is a plain script -- it cannot
     import. Exposing it through the store keeps one source of truth instead
     of a second copy on window. */
  widgetTitle(type) {
    var spec = widgetSpec(type);
    return spec ? spec.title : String(type || "Widget");
  },

  /* Types already placed on a dashboard, so the picker can grey out the
     singletons instead of letting someone add a second "Today's summary"
     and wonder why the screen looks broken. */
  widgetTypesOn(dashId) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    var out = Object.create(null);
    if (!d) return out;
    for (var i = 0; i < d.widgets.length; i++) out[d.widgets[i].type] = true;
    return out;
  },

  availableWidgets(dashId) {
    var used = this.widgetTypesOn(dashId);
    return WIDGETS.map(function (spec) {
      return {
        type: spec.type,
        title: spec.title,
        description: spec.description,
        disabled: !!(spec.singleton && used[spec.type]),
      };
    });
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

  addWidget(dashId, type) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    if (!d) return null;
    var spec = widgetSpec(type);
    if (!spec) return null;
    if (spec.singleton && this.widgetTypesOn(d.id)[type]) {
      this.pushToast("That widget is already on this dashboard");
      return null;
    }
    this._recordUndo("Add widget");
    var w = makeWidget(type);
    d.widgets.push(w);
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
    this.pushToast(spec.title + " added");
    return w;
  },

  removeWidget(dashId, widgetId) {
    var d = this.findDashboard(dashId) || this.activeDashboard();
    if (!d) return;
    var idx = d.widgets.findIndex(function (w) { return w.id === widgetId; });
    if (idx < 0) return;
    var spec = widgetSpec(d.widgets[idx].type);
    this._recordUndo("Remove widget");
    d.widgets.splice(idx, 1);
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
    this.pushToast((spec ? spec.title : "Widget") + " removed — undo to bring it back");
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
    var size = clampSize(widget.type, w, h);
    if (size.w === widget.w && size.h === widget.h) return;
    this._recordUndo("Resize widget");
    widget.w = size.w;
    widget.h = size.h;
    this._touchDashboard(d);
    this._bumpLists();
    this._save();
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
      formatVersion: 1,
      name: d.name,
      exportedAt: nowISO(),
      widgets: d.widgets.map(function (w) {
        return { type: w.type, w: w.w, h: w.h, settings: w.settings || {} };
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
      var raw = data.widgets[i] || {};
      var spec = widgetSpec(raw.type);
      if (!spec) { skipped++; continue; }
      var size = clampSize(raw.type, raw.w, raw.h);
      widgets.push({
        id: newId(),
        type: raw.type,
        w: size.w,
        h: size.h,
        settings: raw.settings && typeof raw.settings === "object" ? raw.settings : {},
      });
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
