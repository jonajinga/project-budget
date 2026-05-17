/* Chart.js helpers — instance reuse + theme-aware defaults + reduced
   motion. Each report-page chart module calls upsert(el, config) on
   render; this either creates a new Chart in a <canvas> inside the
   container element, or updates the existing one in place. Avoids the
   visual flash + DOM churn of destroying on every re-render. */

import { colors } from "./theme-colors.js";
import { registerBrush } from "./brush.js";

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
  /* Register the datalabels plugin if vendored on this page. Default
     to display:false so existing charts opt in explicitly via their
     options.plugins.datalabels block — no surprise labels on every
     bar of every chart. */
  if (window.ChartDataLabels && !Chart._pbDataLabelsRegistered) {
    Chart.register(window.ChartDataLabels);
    Chart._pbDataLabelsRegistered = true;
  }
  if (Chart.defaults.plugins && Chart.defaults.plugins.datalabels) {
    Chart.defaults.plugins.datalabels.display = false;
  }
  /* Brush plugin — registers once globally; charts opt in by setting
     options.plugins.pbBrush.enabled = true and supplying an onChange. */
  registerBrush();
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
  /* Tooltip dismisses cleanly on mouseleave. Earlier attempt set
     Chart.defaults.interaction + Chart.defaults.hover together,
     which created a hover-driven redraw feedback loop that froze
     the report pages. Leave global interaction/hover defaults
     alone; per-tooltip mode/intersect is enough. */
  Chart.defaults.plugins.tooltip.intersect = true;
  Chart.defaults.plugins.tooltip.mode = "nearest";
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
    /* Chart.js can't change instance type via .update() — switching
       bar → doughnut → line silently kept the original type if we
       just patched data+options. Also: sub-types that map to the
       same Chart.js type (bar↔stack, line↔area) need a recreate
       too because .update() doesn't pick up structural option
       changes (scales.x.stacked, dataset.fill, borderRadius). The
       render fn passes `pbSubType` so we can detect those swaps. */
    var existingType    = existing.config && existing.config.type;
    var existingSubType = canvas.__pbSubType;
    var subTypeChanged  = (config.pbSubType != null) && (existingSubType !== config.pbSubType);
    if ((existingType && existingType !== config.type) || subTypeChanged) {
      existing.destroy();
      canvas[HOLDER_KEY] = null;
    } else {
      existing.data = config.data;
      existing.options = config.options || existing.options;
      existing.update();
      if (config.pbSubType != null) canvas.__pbSubType = config.pbSubType;
      return existing;
    }
  }
  /* Strip the marker before handing the config to Chart.js so it
     doesn't warn about an unknown top-level key. */
  var subType = config.pbSubType;
  if ("pbSubType" in config) delete config.pbSubType;
  var inst = new window.Chart(canvas, config);
  canvas[HOLDER_KEY] = inst;
  if (subType != null) canvas.__pbSubType = subType;
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
