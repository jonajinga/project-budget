/* Helper for report pages — wires a chart module to the Alpine store and
   re-renders on theme change and on profile mutation. Defers the first
   render until the chart's container scrolls into view, so a page packed
   with charts doesn't pay the D3 cost for off-screen ones up front. */

import { onThemeChange } from "./theme-colors.js";

export function mountChart(selectorOrEl, render, getData) {
  var el = typeof selectorOrEl === "string" ? document.querySelector(selectorOrEl) : selectorOrEl;
  if (!el) return { redraw: function () {}, dispose: function () {} };

  var hasDrawn = false;

  function draw() {
    try { render(el, getData()); hasDrawn = true; }
    catch (e) { el.textContent = "Chart error."; console.error(e); }
  }

  function redraw() {
    /* Only re-render once visible — avoids work for theme/data changes
       while the chart is still off-screen. */
    if (hasDrawn) draw();
  }

  /* Defer the first draw until the element scrolls into view. If
     IntersectionObserver is unavailable, fall back to immediate draw. */
  if (typeof IntersectionObserver === "function") {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          draw();
          io.disconnect();
        }
      });
    }, { rootMargin: "100px" });
    io.observe(el);
  } else {
    draw();
  }

  var unsub = onThemeChange(redraw);
  return { redraw: redraw, dispose: function () { unsub && unsub(); el.innerHTML = ""; } };
}
