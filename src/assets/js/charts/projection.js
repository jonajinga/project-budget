/* Forward cashflow — Chart.js line with shaded low/high band. */

import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";
import { colors } from "./theme-colors.js";

/* "2025-10" on an axis reads as a number, not a month, and a bare "10"
   is ambiguous across a window that spans two years. */
function axisMonth(m) {
  var s = String(m || "");
  if (!/^\d{4}-\d{2}/.test(s)) return s;
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var p = s.slice(0, 7).split("-");
  return months[Number(p[1]) - 1] + " " + p[0].slice(2);
}

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
      onClick: function (_evt, els) {
        if (!els || !els.length) return;
        var m = data[els[0].index] && data[els[0].index].month;
        if (m) location.href = "/app/calendar/?m=" + m;
      },
      onHover: function (evt, els) {
        if (!evt.native || !evt.native.target) return;
        evt.native.target.style.cursor = els.length ? "pointer" : "default";
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { callback: function (i) { return axisMonth(this.getLabelForValue(i)); } },
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
