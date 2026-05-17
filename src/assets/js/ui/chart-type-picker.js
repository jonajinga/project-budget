/* Shared chart-type picker — segmented control that lets users flip
   between bar / line / area (time-series) or bar / donut / treemap
   (categorical) for any report chart. Persists per-report selection
   to localStorage so the user gets the same view on reload.

   Mounted as an Alpine factory: x-data="chartTypePicker('income-expense', ['bar','line','area'])"
   then reference `chartType` inside the chart's render function via a
   small window-scoped slot the chart module reads on each redraw. */
(function () {
  "use strict";

  var STORAGE_PREFIX = "projectbudget:chart-type:";

  window.chartTypePicker = function (reportId, options) {
    var opts = options || ["bar", "line"];
    var defaultType = opts[0];
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_PREFIX + reportId); } catch (_e) {}
    var initial = (saved && opts.indexOf(saved) !== -1) ? saved : defaultType;

    /* Expose the current type via a global slot the chart module reads
       so the Chart.js redraw can pick it up without coupling. */
    window.__pbChartType = window.__pbChartType || {};
    window.__pbChartType[reportId] = initial;

    return {
      chartType: initial,
      chartOptions: opts.map(function (t) { return { value: t, label: _label(t) }; }),
      setChartType: function (t) {
        if (this.chartOptions.findIndex(function (o) { return o.value === t; }) === -1) return;
        this.chartType = t;
        window.__pbChartType[reportId] = t;
        try { localStorage.setItem(STORAGE_PREFIX + reportId, t); } catch (_e) {}
        /* Tell any mounted chart for this report to redraw. */
        try {
          window.dispatchEvent(new CustomEvent("pb:chart-type", { detail: { reportId: reportId, type: t } }));
        } catch (_e) {}
      },
    };
  };

  function _label(t) {
    switch (t) {
      case "bar":     return "Bar";
      case "line":    return "Line";
      case "area":    return "Area";
      case "donut":   return "Donut";
      case "treemap": return "Treemap";
      case "stack":   return "Stacked";
      default: return t.charAt(0).toUpperCase() + t.slice(1);
    }
  }

  /* Tiny helper for chart modules — read the active type for a report,
     falling back to a default if no picker is mounted. */
  window.pbReadChartType = function (reportId, fallback) {
    var m = window.__pbChartType || {};
    return m[reportId] || fallback;
  };
})();
