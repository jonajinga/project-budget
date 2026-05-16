/* Forward cashflow — Chart.js line with shaded low/high band. */

import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";
import { colors } from "./theme-colors.js";

export function render(el, data) {
  if (!el || !window.Chart) return;
  if (!data || !data.length) {
    el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No data yet.</p>";
    return;
  }
  var c = colors();
  /* Three datasets: low (transparent line, hidden from legend), high
     (transparent line that fills back down to low — shading the band),
     and expected (the headline line on top). */
  upsert(el, {
    type: "line",
    data: {
      labels: data.map(function (d) { return d.month; }),
      datasets: [
        {
          label: "Low",
          data: data.map(function (d) { return d.low; }),
          borderColor: "transparent",
          pointRadius: 0,
          fill: false,
          /* skip legend for the helper */
          hidden: false,
          tension: 0.25,
        },
        {
          label: "High",
          data: data.map(function (d) { return d.high; }),
          borderColor: "transparent",
          backgroundColor: "rgba(192, 57, 43, 0.15)",
          fill: "-1",  /* fill to the previous (Low) dataset = shaded band */
          pointRadius: 0,
          tension: 0.25,
        },
        {
          label: "Expected",
          data: data.map(function (d) { return d.expected; }),
          borderColor: c["chart-1"],
          backgroundColor: c["chart-1"],
          fill: false,
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
      ],
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
        legend: {
          labels: { filter: function (item) { return item.text === "Expected"; } },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) { return ctx.dataset.label + ": " + fmtCentsPrecise(ctx.parsed.y); },
          },
        },
      },
    },
  });
}
