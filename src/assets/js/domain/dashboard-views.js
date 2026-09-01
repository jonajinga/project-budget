/* How a widget is drawn.
 *
 * dashboard-sources.js says where the data comes from; this says what to do
 * with it. A widget pairs one of each, and `accepts` is what stops the pairing
 * being nonsense -- a sankey renderer cannot draw a flat list of payees, so it
 * declares that it only accepts a graph.
 *
 * FOUR KINDS:
 *
 *   chart   one of the eleven renderers in assets/js/charts/. They all share
 *           the signature render(el, data), which is the reason this registry
 *           needs nothing from them but a module name.
 *   table   generic. Driven entirely by the source's `fields`.
 *   list    generic. A ranked read of the same fields.
 *   stat    generic. One big number plus a caption.
 *   panel   the thirteen bespoke cards, each accepting only its own shape.
 *
 * table, list and stat have NO JavaScript renderer -- they are Nunjucks macros
 * over `fields`. That is why adding a source costs one entry here and nothing
 * else, and why fourteen sources times four views is not fifty files.
 *
 * minW / minH live on the VIEW, not the source, because readability is a
 * property of the drawing: a big-number stat is legible at 2x2 where the same
 * data as a chart is a smudge.
 */

export const VIEWS = [
  /* ---- generic, no renderer module needed ---- */
  {
    id: "table",
    kind: "table",
    title: "Table",
    accepts: ["series", "rows"],
    minW: 3, minH: 3,
    pdf: "table",
  },
  {
    id: "list",
    kind: "list",
    title: "Ranked list",
    accepts: ["rows"],
    minW: 3, minH: 3,
    pdf: "table",
  },
  {
    id: "stat",
    kind: "stat",
    title: "Big number",
    accepts: ["series", "rows"],
    minW: 2, minH: 2,
    pdf: "stat",
    /* Which field to aggregate, and how. Offered in the builder from the
       source's numeric fields rather than hardcoded here. */
    settings: [
      { key: "agg", type: "enum", label: "Show", default: "sum",
        options: [
          { value: "sum", label: "Total" },
          { value: "avg", label: "Average" },
          { value: "last", label: "Latest" },
          { value: "max", label: "Highest" },
        ] },
    ],
  },

  /* ---- charts: assets/js/charts/<module>.js, all render(el, data) ---- */
  { id: "chart:income-expense", kind: "chart", title: "Chart", module: "income-expense",
    accepts: ["series"], minW: 4, minH: 4, pdf: "chart" },
  { id: "chart:net-worth", kind: "chart", title: "Chart", module: "net-worth",
    accepts: ["series"], minW: 4, minH: 4, pdf: "chart" },
  { id: "chart:spending-category", kind: "chart", title: "Chart", module: "spending-category",
    accepts: ["rows"], minW: 4, minH: 4, pdf: "chart", needs: ["d3"] },
  { id: "chart:monthly-trends", kind: "chart", title: "Chart", module: "monthly-trends",
    accepts: ["series"], minW: 4, minH: 4, pdf: "chart" },
  { id: "chart:debt", kind: "chart", title: "Chart", module: "debt",
    accepts: ["rows"], minW: 4, minH: 4, pdf: "chart" },
  { id: "chart:assignment-history", kind: "chart", title: "Chart", module: "assignment-history",
    accepts: ["series"], minW: 4, minH: 4, pdf: "chart" },
  { id: "chart:projection", kind: "chart", title: "Chart", module: "projection",
    accepts: ["series"], minW: 4, minH: 4, pdf: "chart" },
  { id: "chart:sankey", kind: "chart", title: "Flow diagram", module: "sankey",
    accepts: ["graph"], minW: 6, minH: 5, pdf: "chart", needs: ["d3", "d3-sankey"] },
  { id: "chart:heatmap", kind: "chart", title: "Heatmap", module: "heatmap",
    accepts: ["matrix"], minW: 6, minH: 5, pdf: "chart", needs: ["d3"] },
  { id: "chart:yoy", kind: "chart", title: "Chart", module: "yoy",
    accepts: ["object"], minW: 4, minH: 4, pdf: "chart" },
];

/* The thirteen panel views are generated from the panel sources so the two
   registries cannot drift: a panel source and its view are the same fact
   stated once. Each accepts only its own synthetic shape, which is what
   mechanically prevents someone pairing "Alerts" with a spending report. */
import { SOURCES } from "./dashboard-sources.js";

SOURCES.filter(function (s) { return s.family === "panels"; }).forEach(function (s) {
  VIEWS.push({
    id: s.defaultView,
    kind: "panel",
    title: s.title,
    module: null,
    accepts: [s.shape],
    minW: s.minW, minH: s.minH,
    pdf: "panel",
    legacyType: s.legacyType,
    chart: s.chart,
  });
});

var _byId = null;
export function viewSpec(id) {
  if (!_byId) {
    _byId = Object.create(null);
    for (var i = 0; i < VIEWS.length; i++) _byId[VIEWS[i].id] = VIEWS[i];
  }
  return _byId[id] || null;
}

/* Which views can legitimately draw this source. The builder offers exactly
   this list, so an invalid pairing is not reachable through the UI -- and
   normalizeWidget re-checks it, because an imported file has not been through
   the UI at all. */
export function viewsForSource(source) {
  if (!source) return [];
  return (source.views || []).filter(function (id) {
    var v = viewSpec(id);
    return v && v.accepts.indexOf(source.shape) !== -1;
  });
}
