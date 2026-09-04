/* Net worth over time — supports line, area, and bar chart types.
   The picker UI sets window.__pbChartType.netWorth; the bootstrap
   calls render(el, data) on every redraw which reads the current
   type and rebuilds the Chart.js config accordingly. */

import { upsert, fmtCents, fmtCentsPrecise } from "./chartjs.js";
import { colors } from "./theme-colors.js";

function readType() {
  return (window.pbReadChartType && window.pbReadChartType("netWorth", "line")) || "line";
}

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
      onClick: function (_evt, els) {
        if (!els || !els.length) return;
        var m = labels[els[0].index];
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
        pbBrush: {
          enabled: true,
          onChange: function (range) {
            if (window.pbOnBrush && window.pbOnBrush.netWorth) {
              window.pbOnBrush.netWorth(range, data);
            }
          },
        },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) { return fmtCentsPrecise(ctx.parsed.y) + " · click to open"; },
          },
        },
      },
    },
  });
}
