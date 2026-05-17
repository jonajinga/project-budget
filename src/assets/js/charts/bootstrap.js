/* Helper for report pages — wires a chart module to the Alpine store and
   re-renders on theme change and on profile mutation.

   Renders eagerly. (An earlier version used IntersectionObserver to defer
   the first draw, but each report page only has one chart and the saving
   isn't worth the timing fragility — especially in headless rendering
   contexts where the IO callback would race the screenshot capture.) */

import { onThemeChange } from "./theme-colors.js";

/* Mark this module as resolved + dispatch a one-shot event so any
   poll loop waiting for window.pbMountChart can resolve immediately
   instead of timing out. Older report pages still rely on the poll
   so leave that intact; new ones can listen for "pb:chart-bootstrap"
   and skip the poll entirely. */
if (typeof window !== "undefined") {
  window.__pbChartBootstrapReady = true;
  try { document.dispatchEvent(new CustomEvent("pb:chart-bootstrap")); }
  catch (_e) {}
}

/* Track every mounted chart so the print listeners can bump
   devicePixelRatio across all of them at once. WeakSet is fine since
   we want garbage collection when the chart is disposed. */
var mountedDraws = [];

export function mountChart(selectorOrEl, render, getData) {
  var el = typeof selectorOrEl === "string" ? document.querySelector(selectorOrEl) : selectorOrEl;
  if (!el) return { redraw: function () {}, dispose: function () {} };

  function draw() {
    try { render(el, getData()); }
    catch (e) { el.textContent = "Chart error."; console.error(e); }
  }

  draw();
  var unsub = onThemeChange(draw);
  mountedDraws.push(draw);
  return {
    redraw: draw,
    dispose: function () {
      unsub && unsub();
      el.innerHTML = "";
      var i = mountedDraws.indexOf(draw);
      if (i !== -1) mountedDraws.splice(i, 1);
    },
  };
}

/* Browser-print fallback: Chart.js canvas renders at screen DPI by
   default, which produces a soft / pixelated chart when the browser
   rasterizes the canvas into a print job. Bumping
   Chart.defaults.devicePixelRatio to 3 before print and forcing every
   mounted chart to redraw gives us a crisp 3x raster that survives
   "Save as PDF" cleanly. The afterprint listener restores the screen
   DPI so we're not wasting GPU during normal use.

   This is a complement to the per-report Export PDF button (which
   uses Chart.toBase64Image(2) directly) — those who Cmd/Ctrl+P
   instead of clicking Export PDF still get sharp output. */
if (typeof window !== "undefined") {
  var prevDPR = null;
  window.addEventListener("beforeprint", function () {
    if (!window.Chart || !window.Chart.defaults) return;
    if (prevDPR == null) prevDPR = window.Chart.defaults.devicePixelRatio || window.devicePixelRatio || 1;
    window.Chart.defaults.devicePixelRatio = 3;
    mountedDraws.forEach(function (d) { try { d(); } catch (_e) {} });
  });
  window.addEventListener("afterprint", function () {
    if (!window.Chart || !window.Chart.defaults) return;
    if (prevDPR != null) {
      window.Chart.defaults.devicePixelRatio = prevDPR;
      prevDPR = null;
      mountedDraws.forEach(function (d) { try { d(); } catch (_e) {} });
    }
  });
}
