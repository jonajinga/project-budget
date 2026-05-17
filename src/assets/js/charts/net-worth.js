/* Net worth over time — supports line, area, and bar chart types.
   The picker UI sets window.__pbChartType.netWorth; the bootstrap
   calls render(el, data) on every redraw which reads the current
   type and rebuilds the Chart.js config accordingly. */

import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";
import { colors } from "./theme-colors.js";

function readType() {
  return (window.pbReadChartType && window.pbReadChartType("netWorth", "line")) || "line";
}

export function render(el, data) {
  if (!el || !window.Chart) return;
  if (!data || !data.length) {
    el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No data yet.</p>";
    return;
  }
  var c = colors();
  var type = readType();
  var labels = data.map(function (d) { return d.month; });
  var values = data.map(function (d) { return d.value; });
  var accent = c["accent"] || c["chart-2"];

  var dataset;
  if (type === "bar") {
    dataset = {
      label: "Net worth",
      data: values,
      backgroundColor: values.map(function (v) {
        return v < 0 ? (c["danger"] || "#cf222e") : accent;
      }),
      borderRadius: 0,
      borderSkipped: false,
    };
  } else {
    var fill = type !== "line";
    dataset = {
      label: "Net worth",
      data: values,
      borderColor: accent,
      backgroundColor: fill ? (accent + "22") : "transparent",
      fill: fill,
      tension: 0.25,
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2,
      pointBackgroundColor: accent,
    };
  }

  upsert(el, {
    type: type === "bar" ? "bar" : "line",
    pbSubType: type,
    data: { labels: labels, datasets: [dataset] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: { callback: function (i) { return String(this.getLabelForValue(i)).slice(5); } },
        },
        y: {
          grid: { color: c["border"] },
          ticks: { callback: function (v) { return fmtCents(v); } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) { return fmtCentsPrecise(ctx.parsed.y); },
          },
        },
      },
    },
  });
}
