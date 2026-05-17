/* Income vs expense — supports bar (paired), line, area, and stacked
   variants. The picker UI sets window.__pbChartType.incomeExpense; the
   bootstrap calls render(el, data) on every redraw which reads the
   current type and rebuilds the Chart.js config accordingly. */

import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";
import { colors } from "./theme-colors.js";

function readType() {
  return (window.pbReadChartType && window.pbReadChartType("incomeExpense", "bar")) || "bar";
}

export function render(el, data) {
  if (!el || !window.Chart) return;
  if (!data || !data.length) {
    el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No data yet.</p>";
    return;
  }
  var c = colors();
  var type = readType();
  var income  = data.map(function (d) { return d.income; });
  var expense = data.map(function (d) { return d.expense; });
  var net     = data.map(function (d) { return d.net; });
  var labels  = data.map(function (d) { return d.month; });

  /* Per-type dataset shape. Bar = paired columns; Line = two strokes;
     Area = two filled strokes; Stack = stacked bars by sign. */
  var datasets;
  var isStacked = false;
  if (type === "line" || type === "area") {
    var fill = type === "area";
    datasets = [
      {
        label: "Income", data: income,
        borderColor: c["chart-1"],
        backgroundColor: fill ? "rgba(192, 57, 43, 0.18)" : "transparent",
        fill: fill, tension: 0.25, pointRadius: 3, pointHoverRadius: 6,
        borderWidth: 2,
      },
      {
        label: "Expense", data: expense,
        borderColor: c["chart-5"],
        backgroundColor: fill ? "rgba(91, 84, 74, 0.18)" : "transparent",
        fill: fill, tension: 0.25, pointRadius: 3, pointHoverRadius: 6,
        borderWidth: 2,
      },
    ];
  } else if (type === "stack") {
    isStacked = true;
    datasets = [
      { label: "Income",  data: income,  backgroundColor: c["chart-1"], borderRadius: 0, borderSkipped: false },
      { label: "Expense", data: expense.map(function (v) { return -v; }), backgroundColor: c["chart-5"], borderRadius: 0, borderSkipped: false },
    ];
  } else {
    datasets = [
      { label: "Income",  data: income,  backgroundColor: c["chart-1"], borderRadius: 0, borderSkipped: false },
      { label: "Expense", data: expense, backgroundColor: c["chart-5"], borderRadius: 0, borderSkipped: false },
    ];
  }

  upsert(el, {
    type: (type === "line" || type === "area") ? "line" : "bar",
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          stacked: isStacked,
          grid: { display: false },
          ticks: { callback: function (i) { return String(this.getLabelForValue(i)).slice(5); } },
        },
        y: {
          stacked: isStacked,
          beginAtZero: true,
          grid: { color: c["border"] },
          ticks: { callback: function (v) { return fmtCents(v); } },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (ctx) { return ctx.dataset.label + ": " + fmtCentsPrecise(Math.abs(ctx.parsed.y)); },
            footer: function (items) {
              if (!items || !items.length) return "";
              var d = data[items[0].dataIndex];
              return "Net: " + fmtCentsPrecise(d.net);
            },
          },
        },
      },
    },
  });
}
