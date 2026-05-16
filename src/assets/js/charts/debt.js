/* Debt overview — Chart.js horizontal bars per account, sorted by
   balance descending. */

import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";
import { colors } from "./theme-colors.js";

export function render(el, rows) {
  if (!el || !window.Chart) return;
  if (!rows || !rows.length) {
    el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No debt accounts.</p>";
    return;
  }
  var c = colors();
  var sorted = rows.slice().sort(function (a, b) { return b.balance - a.balance; });
  /* Container needs height proportional to rows since this chart is
     row-major. Each row gets ~36px. */
  el.style.minHeight = Math.max(120, sorted.length * 44 + 24) + "px";
  upsert(el, {
    type: "bar",
    data: {
      labels: sorted.map(function (r) { return r.account; }),
      datasets: [{
        label: "Balance",
        data: sorted.map(function (r) { return r.balance; }),
        backgroundColor: c["chart-5"],
        borderRadius: 0,
        borderSkipped: false,
      }],
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
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var r = sorted[ctx.dataIndex];
              var lines = [fmtCentsPrecise(ctx.parsed.x)];
              if (r.monthsToPayoff) lines.push("Payoff: " + r.monthsToPayoff + " months");
              else lines.push("No recent payments");
              return lines;
            },
          },
        },
      },
    },
  });
}
