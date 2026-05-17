/* Spending by category — supports treemap (D3), bar (Chart.js),
   and donut (Chart.js) variants. Picker UI sets
   window.__pbChartType.spending; this renderer dispatches per type
   on every redraw. */

import { colors } from "./theme-colors.js";
import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";

function readType() {
  return (window.pbReadChartType && window.pbReadChartType("spending", "treemap")) || "treemap";
}

export function render(el, data) {
  if (!el) return;
  if (!data || !data.length) { el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No spending in this range.</p>"; return; }
  var type = readType();
  if (type === "bar" || type === "donut") {
    renderChartJs(el, data, type);
  } else {
    renderTreemap(el, data);
  }
}

/* ---- Treemap (D3) ---- */
function renderTreemap(el, data) {
  if (!window.d3) return;
  var d3 = window.d3;
  /* If a Chart.js instance was previously mounted (e.g. user
     switched bar → treemap), destroy it before clearing the
     container — otherwise the orphan instance leaks event
     listeners and may keep firing redraws on resize. */
  var canvas = el.querySelector(":scope > canvas");
  if (canvas && canvas.__pbChart) {
    try { canvas.__pbChart.destroy(); } catch (_e) {}
    canvas.__pbChart = null;
  }
  el.innerHTML = "";
  var c = colors();
  var rect = el.getBoundingClientRect();
  var width = Math.max(320, rect.width || 600);
  var height = 360;

  var svg = d3.select(el).append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("class", "chart__svg")
    .attr("role", "img")
    .attr("aria-label", "Spending by category");

  var root = d3.hierarchy({ children: data })
    .sum(function (d) { return d.value || 0; })
    .sort(function (a, b) { return (b.value || 0) - (a.value || 0); });

  d3.treemap().size([width, height]).paddingInner(2)(root);

  var leaves = root.leaves();
  var palette = c.palette;

  var cells = svg.selectAll("g").data(leaves).enter().append("g")
    .attr("transform", function (d) { return "translate(" + d.x0 + "," + d.y0 + ")"; });

  cells.append("rect")
    .attr("width", function (d) { return d.x1 - d.x0; })
    .attr("height", function (d) { return d.y1 - d.y0; })
    .attr("fill", function (_d, i) { return palette[i % palette.length]; })
    .attr("fill-opacity", 0.85)
    .attr("stroke", c["border"])
    .attr("stroke-width", 1);

  cells.append("text")
    .attr("x", 6).attr("y", 16)
    .attr("fill", "#fff")
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .each(function (d) {
      var w = d.x1 - d.x0;
      var h = d.y1 - d.y0;
      if (w < 40 || h < 20) return;
      var sel = d3.select(this);
      sel.append("tspan").text(d.data.category);
      sel.append("tspan")
        .attr("x", 6).attr("dy", 14).attr("font-weight", 400).attr("font-size", 11)
        .text("$" + (d.data.value / 100).toFixed(0));
    });
}

/* ---- Chart.js variants (bar + donut) ---- */
function renderChartJs(el, data, type) {
  if (!window.Chart) return;
  var c = colors();
  var palette = c.palette || [c["chart-1"], c["chart-2"], c["chart-3"], c["chart-4"], c["chart-5"], c["chart-6"]];
  /* Show top 15 categories; group the rest into "Other" so the
     chart doesn't become an unreadable thicket of tiny slices/bars. */
  var top = data.slice(0, 15);
  var rest = data.slice(15);
  var labels = top.map(function (d) { return d.category; });
  var values = top.map(function (d) { return d.value; });
  if (rest.length) {
    var otherSum = rest.reduce(function (s, r) { return s + r.value; }, 0);
    labels.push("Other (" + rest.length + ")");
    values.push(otherSum);
  }
  var bgColors = labels.map(function (_l, i) { return palette[i % palette.length]; });

  var isBar = type === "bar";
  upsert(el, {
    type: isBar ? "bar" : "doughnut",
    pbSubType: type,
    data: {
      labels: labels,
      datasets: [{
        label: "Spent",
        data: values,
        backgroundColor: bgColors,
        borderColor: c["bg"],
        borderWidth: isBar ? 0 : 2,
        borderRadius: 0,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: isBar ? "y" : "x",
      plugins: {
        legend: { display: !isBar, position: "bottom" },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var v = ctx.parsed && (ctx.parsed.x != null ? ctx.parsed.x : (ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed));
              return ctx.label + ": " + fmtCentsPrecise(v);
            },
          },
        },
      },
      scales: isBar ? {
        x: {
          beginAtZero: true,
          grid: { color: c["border"] },
          ticks: { callback: function (v) { return fmtCents(v); } },
        },
        y: { grid: { display: false } },
      } : {},
    },
  });
}
