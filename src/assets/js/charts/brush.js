/* Chart.js brush plugin — drag across the x-axis of any chart to
 * select a contiguous range of category-axis indexes. The page's
 * Alpine factory passes a callback that fires on every selection
 * change, and a "clear" call exposed via a window helper.
 *
 * Why a custom plugin instead of chartjs-plugin-zoom: zoom is a
 * 20+ KB dependency and ships with pan + wheel + pinch we don't
 * want. A focused 60-line brush is easier to maintain and tunes
 * the UX (shaded selection overlay, ESC to clear, semitransparent
 * shading for un-selected bars).
 *
 * Usage:
 *   import { registerBrush } from "/assets/js/charts/brush.js";
 *   registerBrush();  // call once globally; safe to re-call
 *
 *   // In your Chart.js options:
 *   options: {
 *     plugins: {
 *       pbBrush: {
 *         enabled: true,
 *         onChange: function (range) {
 *           // range = { from: index | null, to: index | null }
 *           //   null/null = no selection (cleared)
 *         },
 *       },
 *     },
 *   }
 *
 * Once enabled, the chart's canvas wrapper accepts mouse drags.
 * Click without dragging clears the brush. ESC also clears. */

export function registerBrush() {
  if (typeof window === "undefined" || !window.Chart) return;
  if (window.Chart.__pbBrushRegistered) return;
  window.Chart.__pbBrushRegistered = true;

  var Chart = window.Chart;

  /* State lives on the chart instance to keep multiple charts on a
     page independent. */
  function state(chart) {
    if (!chart.__pbBrush) chart.__pbBrush = {
      dragging: false,
      dragStartX: null,
      dragCurrentX: null,
      from: null,
      to: null,
      handlers: null,
      /* Set true briefly after a drag-release so the click event
         the browser fires next can be suppressed. Cleared on the
         next requestAnimationFrame so genuine clicks still fire. */
      suppressNextClick: false,
    };
    return chart.__pbBrush;
  }

  function pluginOpts(chart) {
    return (chart.options && chart.options.plugins && chart.options.plugins.pbBrush) || null;
  }

  /* Map an x pixel to the nearest category index (works for both
     bar and line charts where labels are categorical). */
  function xToIndex(chart, xPx) {
    var xs = chart.scales.x;
    if (!xs) return null;
    var labels = chart.data.labels || [];
    if (!labels.length) return null;
    /* getValueForPixel returns a fractional index; clamp + round. */
    var raw = xs.getValueForPixel(xPx);
    if (raw == null || isNaN(raw)) return null;
    var idx = Math.max(0, Math.min(labels.length - 1, Math.round(raw)));
    return idx;
  }

  function attach(chart) {
    var s = state(chart);
    if (s.handlers) return;
    var canvas = chart.canvas;
    if (!canvas) return;

    function onDown(evt) {
      var opts = pluginOpts(chart);
      if (!opts || !opts.enabled) return;
      var rect = canvas.getBoundingClientRect();
      var x = evt.clientX - rect.left;
      var area = chart.chartArea;
      if (!area || x < area.left || x > area.right) return;
      s.dragging = true;
      s.dragStartX = x;
      s.dragCurrentX = x;
      chart.draw();
    }
    function onMove(evt) {
      if (!s.dragging) return;
      var rect = canvas.getBoundingClientRect();
      var x = Math.max(chart.chartArea.left, Math.min(chart.chartArea.right, evt.clientX - rect.left));
      s.dragCurrentX = x;
      chart.draw();
    }
    function onUp() {
      if (!s.dragging) return;
      s.dragging = false;
      var opts = pluginOpts(chart);
      if (!opts) return;
      var a = xToIndex(chart, s.dragStartX);
      var b = xToIndex(chart, s.dragCurrentX);
      var dragDistance = Math.abs((s.dragCurrentX || 0) - (s.dragStartX || 0));
      /* Click without drag (|dx| < 4px) = clear. */
      if (dragDistance < 4) {
        s.from = null; s.to = null;
        if (opts.onChange) opts.onChange({ from: null, to: null });
        chart.draw();
        return;
      }
      if (a == null || b == null) return;
      /* The browser will fire a click event right after mouseup;
         arm the suppressor so the chart's onClick handler (often a
         drill-through to /app/calendar/?m=…) doesn't fire when the
         user only meant to brush-select a range. Cleared on the
         next animation frame so genuine clicks still work. */
      s.suppressNextClick = true;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { s.suppressNextClick = false; });
      });
      s.from = Math.min(a, b);
      s.to   = Math.max(a, b);
      if (opts.onChange) opts.onChange({ from: s.from, to: s.to });
      chart.draw();
    }
    function onClickCapture(evt) {
      if (s.suppressNextClick) {
        evt.stopPropagation();
        evt.stopImmediatePropagation();
        evt.preventDefault();
      }
    }
    function onKey(evt) {
      if (evt.key !== "Escape") return;
      var opts = pluginOpts(chart);
      if (!opts || !opts.enabled) return;
      if (s.from == null && s.to == null && !s.dragging) return;
      s.from = null; s.to = null; s.dragging = false;
      if (opts.onChange) opts.onChange({ from: null, to: null });
      chart.draw();
    }

    canvas.addEventListener("mousedown", onDown);
    /* Capture-phase click handler so we beat Chart.js's own click
       dispatcher to the canvas. Without `true` here, the chart's
       onClick fires before we can stopImmediatePropagation it. */
    canvas.addEventListener("click",     onClickCapture, true);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("keydown",   onKey);
    s.handlers = { onDown: onDown, onMove: onMove, onUp: onUp, onKey: onKey, onClickCapture: onClickCapture };
  }

  function detach(chart) {
    var s = chart.__pbBrush;
    if (!s || !s.handlers) return;
    chart.canvas && chart.canvas.removeEventListener("mousedown", s.handlers.onDown);
    chart.canvas && chart.canvas.removeEventListener("click", s.handlers.onClickCapture, true);
    window.removeEventListener("mousemove", s.handlers.onMove);
    window.removeEventListener("mouseup",   s.handlers.onUp);
    window.removeEventListener("keydown",   s.handlers.onKey);
    s.handlers = null;
  }

  Chart.register({
    id: "pbBrush",
    afterInit: function (chart) { attach(chart); },
    afterDestroy: function (chart) { detach(chart); },
    afterDraw: function (chart) {
      var opts = pluginOpts(chart);
      if (!opts || !opts.enabled) return;
      var s = state(chart);
      var ctx = chart.ctx;
      var a = chart.chartArea;
      if (!a) return;

      /* Live drag preview. */
      if (s.dragging && s.dragStartX != null && s.dragCurrentX != null) {
        var x1 = Math.min(s.dragStartX, s.dragCurrentX);
        var x2 = Math.max(s.dragStartX, s.dragCurrentX);
        ctx.save();
        ctx.fillStyle = "rgba(192, 57, 43, 0.18)";
        ctx.strokeStyle = "rgba(192, 57, 43, 0.65)";
        ctx.lineWidth = 1;
        ctx.fillRect(x1, a.top, x2 - x1, a.bottom - a.top);
        ctx.strokeRect(x1 + 0.5, a.top + 0.5, x2 - x1 - 1, a.bottom - a.top - 1);
        ctx.restore();
        return;
      }
      /* Persisted selection overlay. */
      if (s.from != null && s.to != null) {
        var xs = chart.scales.x;
        if (!xs) return;
        var px1 = xs.getPixelForValue(s.from);
        var px2 = xs.getPixelForValue(s.to);
        var L = Math.min(px1, px2) - 8;
        var R = Math.max(px1, px2) + 8;
        ctx.save();
        /* Dim the un-selected bands left + right. */
        ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
        if (L > a.left)  ctx.fillRect(a.left, a.top, L - a.left, a.bottom - a.top);
        if (R < a.right) ctx.fillRect(R, a.top, a.right - R, a.bottom - a.top);
        /* Outline the selection. */
        ctx.strokeStyle = "rgba(192, 57, 43, 0.55)";
        ctx.lineWidth = 1;
        ctx.strokeRect(L + 0.5, a.top + 0.5, R - L - 1, a.bottom - a.top - 1);
        ctx.restore();
      }
    },
  });
}

/* Convenience: imperative clear from outside (used by the page's
   Clear button). */
export function clearBrush(chart) {
  if (!chart || !chart.__pbBrush) return;
  var s = chart.__pbBrush;
  s.from = null; s.to = null;
  var opts = (chart.options && chart.options.plugins && chart.options.plugins.pbBrush) || null;
  if (opts && opts.onChange) opts.onChange({ from: null, to: null });
  chart.draw();
}
