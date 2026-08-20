/* Screen-reader announcements.
 *
 * Why this exists rather than aria-live on the visible toast stack:
 * .toast-stack was x-show + x-cloak gated, so it was display:none when the
 * live region was registered and became visible in the SAME tick its content
 * arrived. A region that appears and fills simultaneously is the classic
 * pattern that announces nothing. aria-atomic="true" on the stack compounded
 * it by re-reading every toast on each change, and the per-toast
 * role="status" nested a live region inside a live region.
 *
 * The fix separates the two jobs. Two announcers live permanently in the
 * document, never display:none -- .visually-hidden CLIPS rather than hides,
 * which is exactly why it works here. The toast stack goes back to being
 * purely visual.
 */
(function () {
  "use strict";

  var POLITE = "pb-live-polite";
  var ASSERTIVE = "pb-live-assertive";

  function region(id) {
    return document.getElementById(id);
  }

  /* Clearing then setting on the next frame is what makes a repeated
     identical string announce again -- assistive tech only reacts to a
     CHANGE in the region's text, so "Saved." twice in a row would otherwise
     be silent the second time. */
  function announce(message, opts) {
    if (!message) return;
    var el = region(opts && opts.assertive ? ASSERTIVE : POLITE);
    if (!el) return;
    el.textContent = "";
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () { el.textContent = String(message); });
    } else {
      setTimeout(function () { el.textContent = String(message); }, 16);
    }
  }

  window.PBAnnounce = { announce: announce };
})();
