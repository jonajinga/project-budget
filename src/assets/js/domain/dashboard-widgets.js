/* Widget validation and the v1 -> v2 upgrade.
 *
 * Everything that can put a widget into a dashboard comes through here:
 * addWidget, updateWidget, importDefinition, the lazy upgrade on read, and the
 * builder's live preview. That is deliberate. Two of those five handle input
 * this app did not create -- an exported file someone was sent, or a record
 * written by an older version -- so "validate at the edge" would mean
 * validating in several edges and eventually missing one.
 *
 * The rule is: a widget that reaches the renderer is already known-good, or it
 * does not reach the renderer at all.
 *
 * UNKNOWN KEYS ARE STRIPPED, and that is load-bearing rather than tidiness.
 * The layout model is an ordered list with a column span, argued at length in
 * store/slices/dashboards.js. An imported file carrying x/y coordinates would
 * quietly introduce a second, free-positioning layout model that nothing else
 * in the app understands. Rebuilding the record from declared fields only is
 * what makes that unrepresentable.
 */

import { SOURCES, sourceSpec, sourceIdForLegacyType, DEFAULT_LAYOUT } from "./dashboard-sources.js";
import { VIEWS, viewSpec, viewsForSource } from "./dashboard-views.js";

export { SOURCES, VIEWS, sourceSpec, viewSpec, viewsForSource, DEFAULT_LAYOUT };

export const GRID_COLUMNS = 12;
var MAX_ROWS = 24;
var MAX_TITLE = 60;

/* Sizes clamp against the VIEW's minimum, not the source's: the same data as a
   big number is readable at 2x2 where a chart is a smudge. */
export function clampSize(sourceId, viewId, w, h) {
  var src = sourceSpec(sourceId);
  var view = viewSpec(viewId);
  var minW = (view && view.minW) || 2;
  var minH = (view && view.minH) || 2;
  var defW = (src && src.w) || 6;
  var defH = (src && src.h) || 4;
  var nw = Math.round(Number(w));
  var nh = Math.round(Number(h));
  if (!isFinite(nw) || nw <= 0) nw = defW;
  if (!isFinite(nh) || nh <= 0) nh = defH;
  return {
    w: Math.max(minW, Math.min(GRID_COLUMNS, nw)),
    h: Math.max(minH, Math.min(MAX_ROWS, nh)),
  };
}

function coerceParam(decl, raw) {
  if (decl.type === "int") {
    var n = Math.round(Number(raw));
    if (!isFinite(n)) return decl.default;
    if (typeof decl.min === "number") n = Math.max(decl.min, n);
    if (typeof decl.max === "number") n = Math.min(decl.max, n);
    return n;
  }
  if (decl.type === "month") {
    /* null is meaningful: it means "follow the current month", which is what
       keeps a widget current instead of pinned to when it was made. */
    if (raw == null || raw === "") return null;
    return /^\d{4}-\d{2}$/.test(String(raw)) ? String(raw) : decl.default;
  }
  if (decl.type === "range") {
    if (!raw || typeof raw !== "object") return decl.default;
    var from = /^\d{4}-\d{2}$/.test(String(raw.from)) ? String(raw.from) : null;
    var to = /^\d{4}-\d{2}$/.test(String(raw.to)) ? String(raw.to) : null;
    return from && to ? { from: from, to: to } : decl.default;
  }
  if (decl.type === "enum") {
    var ok = (decl.options || []).some(function (o) { return o.value === raw; });
    return ok ? raw : decl.default;
  }
  if (decl.type === "bool") return raw === true || raw === "true";
  return raw == null ? decl.default : raw;
}

function coerceDeclared(decls, raw) {
  var out = {};
  var given = raw && typeof raw === "object" ? raw : {};
  (decls || []).forEach(function (d) { out[d.key] = coerceParam(d, given[d.key]); });
  return out;
}

/* The single gate. Returns a clean record, or null to drop the widget --
   which is what an unknown source means, since rendering a card that says
   nothing is worse than not placing it. */
export function normalizeWidget(raw, makeId) {
  if (!raw || typeof raw !== "object") return null;

  var sourceId = raw.source || (raw.type ? sourceIdForLegacyType(raw.type) : null);
  var src = sourceSpec(sourceId);
  if (!src) return null;

  /* A view the source does not accept falls back rather than dropping the
     widget: the data is still valid and the user still wants it on screen,
     they just asked to draw it a way this version cannot. */
  var allowed = viewsForSource(src);
  var viewId = raw.view && allowed.indexOf(raw.view) !== -1 ? raw.view : src.defaultView;
  var view = viewSpec(viewId);
  if (!view) return null;

  var size = clampSize(sourceId, viewId, raw.w, raw.h);
  var title = typeof raw.title === "string" ? raw.title.trim().slice(0, MAX_TITLE) : "";

  return {
    id: raw.id || (makeId ? makeId() : null),
    source: sourceId,
    params: coerceDeclared(src.params, raw.params),
    view: viewId,
    settings: coerceDeclared(view.settings, raw.settings),
    title: title,
    w: size.w,
    h: size.h,
  };
}

/* v1 records were {id, type, w, h, settings}. The upgrade runs on the read
   path, so it covers every way a profile can arrive -- a fresh seed, an older
   export, an import, the bundled sample -- rather than only the one a
   migration file would catch. It must be idempotent: it runs on every read. */
export function legacyTypeToWidget(raw, makeId) {
  if (!raw) return null;
  if (raw.source) return normalizeWidget(raw, makeId); /* already v2 */
  return normalizeWidget(
    { id: raw.id, type: raw.type, w: raw.w, h: raw.h, settings: raw.settings, title: raw.title },
    makeId
  );
}

export function isLegacyWidget(raw) {
  return !!(raw && !raw.source && raw.type);
}

/* What the builder offers. Singleton panels already on the board are marked
   rather than hidden, so the picker still explains why they are unavailable. */
export function availableSources(usedSourceIds) {
  var used = usedSourceIds || {};
  return SOURCES.map(function (s) {
    return {
      id: s.id,
      family: s.family,
      title: s.title,
      description: s.description,
      disabled: !!(s.singleton && used[s.id]),
    };
  });
}
