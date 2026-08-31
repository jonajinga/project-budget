/* Dashboard grid interaction: move and resize widgets.
 *
 * TWO INPUT PATHS, NOT ONE. Every gesture here works from the keyboard as
 * well as the pointer, and that is the reason this is hand-written rather
 * than a drag-and-drop library. The mature options are built around mouse
 * and touch; their keyboard story is usually "you can't". A dashboard whose
 * widgets can only be rearranged by dragging is unusable for anyone who does
 * not use a pointer, and it would not survive this project's own a11y gates.
 *
 *   Pointer   grab the header to move, drag the corner to resize.
 *   Keyboard  focus the grip, Space/Enter to pick up, arrows to move or
 *             resize, Space/Enter to drop, Escape to cancel.
 *
 * The keyboard path is not a lesser fallback: it is the same store calls,
 * announced through the same live region, and cancel restores the original
 * position because a half-finished rearrangement you cannot undo is worse
 * than not being able to start one.
 *
 * MOVE IS REORDER. Position comes from list order (see slices/dashboards.js
 * for why), so a move is "put this widget at index N" and the CSS grid flows
 * the rest. Nothing is absolutely positioned, so there is nothing to collide
 * and no holes to garbage-collect.
 *
 * POINTER EVENTS, not mouse/touch pairs: one code path covers mouse, touch
 * and pen, and setPointerCapture keeps the gesture alive when the pointer
 * leaves the element -- which it will, because the widget moves out from
 * under it.
 */

(function () {
  var GRID_COLUMNS = 12;

  function announce(msg) {
    /* Reuse the app's live region if it is there; say nothing if not,
       rather than inventing a second one that screen readers would have to
       track separately. */
    var region = document.getElementById("pb-live") || document.querySelector("[data-live-region]");
    if (region) region.textContent = msg;
  }

  function widgetEls(grid) {
    return Array.prototype.slice.call(grid.querySelectorAll("[data-widget-id]"));
  }

  function indexOfEl(grid, el) {
    return widgetEls(grid).indexOf(el);
  }

  /* Which slot is the pointer over? Compares against element centres rather
     than edges: edge-based hit testing makes the drop target flicker between
     two widgets when the pointer sits on a boundary. */
  function slotFromPoint(grid, x, y, dragged) {
    var els = widgetEls(grid).filter(function (e) { return e !== dragged; });
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return indexOfEl(grid, els[i]);
      if (y <= r.bottom && x < r.left + r.width / 2) return indexOfEl(grid, els[i]);
    }
    return widgetEls(grid).length - 1;
  }

  window.PBDashGrid = {
    /* Called by the Alpine view. `api` supplies the store calls so this file
       stays free of store knowledge and can be tested on its own. */
    attach: function (grid, api) {
      if (!grid || grid.__pbGridBound) return;
      grid.__pbGridBound = true;

      var drag = null; /* { el, id, pointerId, startIndex } */
      var resize = null; /* { el, id, startX, startY, startW, startH, colPx, rowPx } */
      var kb = null; /* { el, id, mode, startIndex, startW, startH } */

      /* ---------- pointer: move ---------- */
      grid.addEventListener("pointerdown", function (e) {
        var grip = e.target.closest("[data-widget-grip]");
        var handle = e.target.closest("[data-widget-resize]");
        if (!grip && !handle) return;
        if (e.button !== undefined && e.button !== 0) return;
        var el = e.target.closest("[data-widget-id]");
        if (!el) return;
        e.preventDefault();

        if (handle) {
          var r = el.getBoundingClientRect();
          var styles = getComputedStyle(grid);
          var gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
          var colPx = (grid.clientWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
          var rowPx = parseFloat(getComputedStyle(grid).getPropertyValue("grid-auto-rows")) || 40;
          resize = {
            el: el, id: el.getAttribute("data-widget-id"),
            startX: e.clientX, startY: e.clientY,
            startW: Math.round((r.width + gap) / (colPx + gap)),
            startH: Math.max(1, Math.round((r.height + gap) / (rowPx + gap))),
            colPx: colPx + gap, rowPx: rowPx + gap,
          };
          el.setPointerCapture(e.pointerId);
          el.classList.add("is-resizing");
        } else {
          drag = {
            el: el, id: el.getAttribute("data-widget-id"),
            pointerId: e.pointerId, startIndex: indexOfEl(grid, el),
          };
          el.setPointerCapture(e.pointerId);
          el.classList.add("is-dragging");
          grid.classList.add("is-rearranging");
        }
      });

      grid.addEventListener("pointermove", function (e) {
        if (resize) {
          var dw = Math.round((e.clientX - resize.startX) / resize.colPx);
          var dh = Math.round((e.clientY - resize.startY) / resize.rowPx);
          var w = resize.startW + dw;
          var h = resize.startH + dh;
          /* Preview live so the gesture feels direct; the store call happens
             once on release rather than on every pixel, which would push a
             hundred undo entries for one drag. */
          api.previewSize(resize.el, w, h);
          return;
        }
        if (!drag) return;
        var to = slotFromPoint(grid, e.clientX, e.clientY, drag.el);
        var from = indexOfEl(grid, drag.el);
        if (to !== from && to >= 0) api.move(drag.id, to);
      });

      function endPointer(e) {
        if (resize) {
          resize.el.classList.remove("is-resizing");
          var size = api.readPreview(resize.el);
          api.resize(resize.id, size.w, size.h);
          try { resize.el.releasePointerCapture(e.pointerId); } catch (_e) {}
          resize = null;
        }
        if (drag) {
          drag.el.classList.remove("is-dragging");
          grid.classList.remove("is-rearranging");
          try { drag.el.releasePointerCapture(drag.pointerId); } catch (_e) {}
          var moved = indexOfEl(grid, drag.el) !== drag.startIndex;
          if (moved) announce("Widget moved to position " + (indexOfEl(grid, drag.el) + 1));
          drag = null;
        }
      }
      grid.addEventListener("pointerup", endPointer);
      grid.addEventListener("pointercancel", endPointer);

      /* ---------- keyboard: move and resize ----------
         Space/Enter picks up. While held, arrows move (or resize with Shift).
         Space/Enter drops, Escape cancels back to where it started. */
      grid.addEventListener("keydown", function (e) {
        var grip = e.target.closest("[data-widget-grip]");
        if (!grip) return;
        var el = e.target.closest("[data-widget-id]");
        if (!el) return;
        var id = el.getAttribute("data-widget-id");

        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (kb && kb.id === id) {
            announce("Widget dropped at position " + (indexOfEl(grid, el) + 1));
            el.classList.remove("is-keyboard-active");
            kb = null;
          } else {
            var size = api.sizeOf(id);
            kb = { el: el, id: id, startIndex: indexOfEl(grid, el), startW: size.w, startH: size.h };
            el.classList.add("is-keyboard-active");
            announce(
              "Picked up " + api.titleOf(id) + ", position " + (kb.startIndex + 1) + " of " +
                widgetEls(grid).length + ". Arrow keys move, shift and arrow keys resize, " +
                "space to drop, escape to cancel."
            );
          }
          return;
        }

        if (!kb || kb.id !== id) return;

        if (e.key === "Escape") {
          e.preventDefault();
          api.move(id, kb.startIndex);
          api.resize(id, kb.startW, kb.startH);
          el.classList.remove("is-keyboard-active");
          announce("Cancelled — widget back at position " + (kb.startIndex + 1));
          kb = null;
          return;
        }

        var arrows = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 };
        if (!(e.key in arrows)) return;
        e.preventDefault();
        var horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
        var delta = arrows[e.key];

        if (e.shiftKey) {
          var s = api.sizeOf(id);
          var nw = horizontal ? s.w + delta : s.w;
          var nh = horizontal ? s.h : s.h + delta;
          api.resize(id, nw, nh);
          var after = api.sizeOf(id);
          announce(api.titleOf(id) + " is now " + after.w + " of 12 columns, " + after.h + " rows");
        } else {
          var cur = indexOfEl(grid, el);
          /* Up/down move by a whole row where that is meaningful; with a flow
             layout the honest approximation is one slot, and saying so in the
             announcement is better than pretending to a 2-D model the layout
             does not have. */
          var next = Math.max(0, Math.min(widgetEls(grid).length - 1, cur + delta));
          if (next !== cur) {
            api.move(id, next);
            announce(api.titleOf(id) + " moved to position " + (next + 1) + " of " + widgetEls(grid).length);
            /* The element is re-rendered by Alpine; re-focus its grip so the
               gesture can continue. Without this the first arrow key ends the
               interaction and the user has to tab back. */
            requestAnimationFrame(function () {
              var again = grid.querySelector('[data-widget-id="' + id + '"] [data-widget-grip]');
              if (again) {
                again.focus();
                again.closest("[data-widget-id]").classList.add("is-keyboard-active");
              }
            });
          }
        }
      });
    },
  };
})();
