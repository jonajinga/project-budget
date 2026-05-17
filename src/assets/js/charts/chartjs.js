/* Chart.js helpers — instance reuse + theme-aware defaults + reduced
   motion. Each report-page chart module calls upsert(el, config) on
   render; this either creates a new Chart in a <canvas> inside the
   container element, or updates the existing one in place. Avoids the
   visual flash + DOM churn of destroying on every re-render. */

import { colors } from "./theme-colors.js";

const HOLDER_KEY = "__pbChart";

function ensureCanvas(el) {
  if (el.tagName === "CANVAS") return el;
  /* If a canvas already exists inside, reuse it. */
  var existing = el.querySelector(":scope > canvas");
  if (existing) return existing;
  el.innerHTML = "";
  var c = document.createElement("canvas");
  c.style.width = "100%";
  c.style.height = "100%";
  el.appendChild(c);
  return c;
}

function reducedMotion() {
  try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (_e) { return false; }
}

/* Apply the active app palette to the global Chart defaults so legends,
   tooltips, axes, and grid lines pick up dark / light mode automatically.
   Called on first mount + whenever the theme flips. */
export function applyChartDefaults() {
  if (!window.Chart) return;
  var c = colors();
  var Chart = window.Chart;
  Chart.defaults.font.family = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-ui").trim() || "system-ui, sans-serif";
  Chart.defaults.color = c["fg-muted"];
  Chart.defaults.borderColor = c["border"];
  Chart.defaults.animation = reducedMotion() ? false : { duration: 350 };
  /* Tooltip styling — matches Tippy's projectbudget theme: inverted
     fg-on-bg so it always reads as a dark popover (white text) in
     light themes and a light popover (dark text) in dark themes.
     Previously titleColor + bodyColor were pinned to #fff, which
     became invisible on the light `--fg` background in GitHub Dark
     / Solarized Dark themes. Pairing background=fg with text=bg
     keeps contrast >= 7:1 in every theme. */
  Chart.defaults.plugins.tooltip.backgroundColor = c["fg"];
  Chart.defaults.plugins.tooltip.titleColor = c["bg"];
  Chart.defaults.plugins.tooltip.bodyColor = c["bg"];
  Chart.defaults.plugins.tooltip.footerColor = c["bg"];
  Chart.defaults.plugins.tooltip.borderColor = c["fg"];
  Chart.defaults.plugins.tooltip.padding = { top: 8, right: 12, bottom: 8, left: 12 };
  Chart.defaults.plugins.tooltip.cornerRadius = 4;
  Chart.defaults.plugins.tooltip.titleFont = { weight: "700", size: 13 };
  Chart.defaults.plugins.tooltip.bodyFont = { weight: "400", size: 13 };
  Chart.defaults.plugins.tooltip.boxPadding = 6;
  Chart.defaults.plugins.tooltip.usePointStyle = true;
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.tooltip.intersect = false;
  Chart.defaults.plugins.tooltip.mode = "index";
  Chart.defaults.plugins.legend.labels.color = c["fg-muted"];
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.position = "bottom";
}

/* Build (or refresh) a Chart instance inside `el` using `config`.
   config is a standard Chart.js config object; only data + plugins
   that change need to be re-supplied. */
export function upsert(el, config) {
  if (!window.Chart) {
    el.textContent = "Chart library not loaded.";
    return null;
  }
  applyChartDefaults();
  var canvas = ensureCanvas(el);
  var existing = canvas[HOLDER_KEY];
  if (existing) {
    /* Update the same instance — preserves animation context + avoids
       canvas re-allocation. */
    existing.data = config.data;
    existing.options = config.options || existing.options;
    existing.update();
    return existing;
  }
  var inst = new window.Chart(canvas, config);
  canvas[HOLDER_KEY] = inst;
  return inst;
}

/* Standard currency tick + tooltip formatter for money-axis charts. */
export function fmtCents(cents) {
  return ((cents || 0) / 100).toLocaleString("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
}
export function fmtCentsPrecise(cents) {
  return ((cents || 0) / 100).toLocaleString("en-US", {
    style: "currency", currency: "USD",
  });
}
