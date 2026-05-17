/* Debt overview — Chart.js horizontal bars by default, donut as an
   optional view. Picker writes window.__pbChartType.debt; this
   renderer reads it on each redraw. */

import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";
import { colors } from "./theme-colors.js";

function readType() {
  return (window.pbReadChartType && window.pbReadChartType("debt", "bar")) || "bar";
}

export function render(el, rows) {
  if (!el || !window.Chart) return;
  if (!rows || !rows.length) {
    el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No debt accounts.</p>";
    return;
  }
  var c = colors();
  var type = readType();
  var sorted = rows.slice().sort(function (a, b) { return b.balance - a.balance; });
  var palette = c.palette || [c["chart-1"], c["chart-2"], c["chart-3"], c["chart-4"], c["chart-5"], c["chart-6"]];

  if (type === "donut") {
    /* Donut needs square-ish container; lift min-height for clarity. */
    el.style.minHeight = "300px";
    upsert(el, {
      type: "doughnut",
      pbSubType: "donut",
      data: {
        labels: sorted.map(function (r) { return r.account; }),
        datasets: [{
          label: "Balance",
          data: sorted.map(function (r) { return r.balance; }),
          backgroundColor: sorted.map(function (_r, i) { return palette[i % palette.length]; }),
          borderColor: c["bg"],
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function (_evt, els) {
          if (!els || !els.length) return;
          var r = sorted[els[0].index];
          if (r && r.accountId) location.href = "/app/register/?account=" + r.accountId;
        },
        onHover: function (evt, els) {
          if (!evt.native || !evt.native.target) return;
          evt.native.target.style.cursor = els.length ? "pointer" : "default";
        },
        plugins: {
          legend: { display: true, position: "bottom" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var r = sorted[ctx.dataIndex];
                var lines = [ctx.label + ": " + fmtCentsPrecise(ctx.parsed)];
                if (r.monthsToPayoff) lines.push("Payoff: " + r.monthsToPayoff + " months");
                else lines.push("No recent payments");
                lines.push("Click to open register");
                return lines;
              },
            },
          },
          datalabels: {
            display: "auto",
            color: "#fff",
            font: { weight: "700", size: 11 },
            formatter: function (v, ctx) {
              var total = ctx.chart.data.datasets[0].data.reduce(function (s, x) { return s + (x || 0); }, 0);
              if (!total) return "";
              var pct = (v / total) * 100;
              return pct < 5 ? "" : pct.toFixed(0) + "%";
            },
          },
        },
      },
    });
    return;
  }

  /* Default horizontal-bar variant. Height scales with row count. */
  el.style.minHeight = Math.max(120, sorted.length * 44 + 24) + "px";
  upsert(el, {
    type: "bar",
    pbSubType: "bar",
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
      onClick: function (_evt, els) {
        if (!els || !els.length) return;
        var r = sorted[els[0].index];
        if (r && r.accountId) location.href = "/app/register/?account=" + r.accountId;
      },
      onHover: function (evt, els) {
        if (!evt.native || !evt.native.target) return;
        evt.native.target.style.cursor = els.length ? "pointer" : "default";
      },
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
        /* Datalabels: balance + months-to-payoff at the right of
           each horizontal bar so the user can read the figures
           without hover. */
        datalabels: {
          display: "auto",
          anchor: "end",
          align: "end",
          color: c["fg"],
          font: { weight: "600", size: 11 },
          clamp: true,
          formatter: function (v, ctx) {
            var r = sorted[ctx.dataIndex];
            var label = fmtCents(v);
            if (r && r.monthsToPayoff) label += "  ·  " + r.monthsToPayoff + " mo";
            return label;
          },
        },
      },
    },
  });
}
