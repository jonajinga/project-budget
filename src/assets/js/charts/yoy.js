/* Year-over-year — Chart.js paired bars (current vs prior) for one of
 * three views: byMonth | byCategory | byPayee.
 *
 * Data shape (from yearOverYear()):
 *   {
 *     paired: [{ index, currentIncome, currentExpense, priorIncome, priorExpense, currentMonth, priorMonth }, ...],
 *     categoryRows: [{ category, current, prior, delta }, ...],
 *     payeeRows:    [{ payee, current, prior, delta }, ...],
 *     deltas: { income, expense, net, savingsRate, biggestSwing },
 *     current: { ... }, prior: { ... },
 *   }
 *
 * Each view picks a slice of the data + a chart-type config. The
 * picker UI lives on the page; we just render whichever view is
 * passed in. */

import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";
import { colors } from "./theme-colors.js";

function readView() {
  return (window.__pbChartType && window.__pbChartType.yoy) || "byMonth";
}

export function render(el, data) {
  if (!el || !window.Chart) return;
  if (!data || !data.paired) {
    el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No data yet.</p>";
    return;
  }
  var c = colors();
  var view = readView();
  var currentColor = c["chart-2"] || c.accent;
  var priorColor   = c["chart-5"] || c["fg-muted"];

  if (view === "byCategory" || view === "byPayee") {
    var src = view === "byCategory" ? (data.categoryRows || []) : (data.payeeRows || []);
    var top = src.slice(0, 20);
    upsert(el, {
      type: "bar",
      pbSubType: "yoy-" + view,
      data: {
        labels: top.map(function (r) { return view === "byCategory" ? r.category : r.payee; }),
        datasets: [
          { label: "Current",      data: top.map(function (r) { return r.current; }), backgroundColor: currentColor, borderRadius: 0 },
          { label: "Prior period", data: top.map(function (r) { return r.prior;   }), backgroundColor: priorColor,  borderRadius: 0 },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: c["border"] },
            ticks: { callback: function (v) { return fmtCents(v); } },
          },
          y: { grid: { display: false } },
        },
        plugins: {
          legend: { display: true, position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (ctx) { return ctx.dataset.label + ": " + fmtCentsPrecise(ctx.parsed.x); },
            },
          },
        },
      },
    });
    return;
  }

  /* By month (default): two stacked sets of paired bars — current
     income/expense vs prior income/expense for each chronological
     month index (1..12). Income above the axis, expense below. */
  var labels = data.paired.map(function (p) {
    return p.currentMonth ? p.currentMonth.slice(5) : ("M" + p.index);
  });
  var datasets = [
    { label: "Current income",   data: data.paired.map(function (p) { return p.currentIncome; }),   backgroundColor: c["chart-1"] || currentColor, stack: "current", borderRadius: 0 },
    { label: "Current expense",  data: data.paired.map(function (p) { return -p.currentExpense; }), backgroundColor: c["chart-5"] || c.danger,     stack: "current", borderRadius: 0 },
    { label: "Prior income",     data: data.paired.map(function (p) { return p.priorIncome; }),     backgroundColor: c["chart-3"] || priorColor,   stack: "prior",   borderRadius: 0, hidden: false },
    { label: "Prior expense",    data: data.paired.map(function (p) { return -p.priorExpense; }),   backgroundColor: c["chart-4"] || c["fg-subtle"], stack: "prior", borderRadius: 0, hidden: false },
  ];
  upsert(el, {
    type: "bar",
    pbSubType: "yoy-byMonth",
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: c["border"] }, ticks: { callback: function (v) { return fmtCents(v); } } },
      },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: function (ctx) { return ctx.dataset.label + ": " + fmtCentsPrecise(Math.abs(ctx.parsed.y)); },
          },
        },
      },
    },
  });
}
