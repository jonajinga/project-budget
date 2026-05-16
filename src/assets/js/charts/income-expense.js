/* Income vs expense paired bars per month, rendered with Chart.js.
   D3 was previously used here; Chart.js gets us interactive tooltips,
   legend toggling, and theme-aware defaults out of the box. */

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
    type: "bar",
    data: {
      labels: data.map(function (d) { return d.month; }),
      datasets: [
        {
          label: "Income",
          data: data.map(function (d) { return d.income; }),
          backgroundColor: c["chart-1"],
          borderRadius: 0,
          borderSkipped: false,
        },
        {
          label: "Expense",
          data: data.map(function (d) { return d.expense; }),
          backgroundColor: c["chart-5"],
          borderRadius: 0,
          borderSkipped: false,
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
          beginAtZero: true,
          grid: { color: c["border"] },
          ticks: { callback: function (v) { return fmtCents(v); } },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (ctx) { return ctx.dataset.label + ": " + fmtCentsPrecise(ctx.parsed.y); },
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
