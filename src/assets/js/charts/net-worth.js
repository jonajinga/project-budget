/* Net worth over time — Chart.js line with soft fill. */

import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";
import { colors } from "./theme-colors.js";

export function render(el, data) {
  if (!el || !window.Chart) return;
  if (!data || !data.length) {
    el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No data yet.</p>";
    return;
  }
  var c = colors();
  upsert(el, {
    type: "line",
    data: {
      labels: data.map(function (d) { return d.month; }),
      datasets: [{
        label: "Net worth",
        data: data.map(function (d) { return d.value; }),
        borderColor: c["chart-2"],
        backgroundColor: "rgba(44, 95, 138, 0.12)",
        fill: true,
        tension: 0.25,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: c["chart-2"],
      }],
    },
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
