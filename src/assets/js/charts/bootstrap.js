/* Helper for report pages — wires a chart module to the Alpine store and
   re-renders on theme change and on profile mutation.

   Renders eagerly. (An earlier version used IntersectionObserver to defer
   the first draw, but each report page only has one chart and the saving
   isn't worth the timing fragility — especially in headless rendering
   contexts where the IO callback would race the screenshot capture.) */

import { onThemeChange } from "./theme-colors.js";

export function mountChart(selectorOrEl, render, getData) {
  var el = typeof selectorOrEl === "string" ? document.querySelector(selectorOrEl) : selectorOrEl;
  if (!el) return { redraw: function () {}, dispose: function () {} };

  function draw() {
    try { render(el, getData()); }
    catch (e) { el.textContent = "Chart error."; console.error(e); }
  }

  draw();
  var unsub = onThemeChange(draw);
  return { redraw: draw, dispose: function () { unsub && unsub(); el.innerHTML = ""; } };
}
