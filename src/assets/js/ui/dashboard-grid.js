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
 * ONE GESTURE IS ONE UNDO ENTRY. This is the rule the first version broke,
 * and it broke it expensively: _recordUndo deep-clones the WHOLE profile
 * (723KB on the bundled sample), and move was committed from pointermove and
 * from every arrow keypress. Dragging across eight slots cloned most of a
 * megabyte eight times and evicted eight entries of real history from a
 * 50-entry stack; Escape then replayed a move AND a resize, so abandoning a
 * drag cost more than finishing one.
 *
 * So the gesture is previewed in CSS and committed once on release:
 *
 *   pointermove / arrow  ->  rewrite inline `order`, no store call
 *   pointerup / Space    ->  api.move(...) exactly once
 *   Escape               ->  drop the preview, zero store calls
 *
 * PREVIEW WITH `order`, NEVER insertBefore. .dash-grid is a CSS grid, so
 * items honour `order` and the visual arrangement can be changed without
 * touching DOM structure. Moving the nodes instead would mutate an x-for's
 * children out from under Alpine, which is precisely how _x_lookup
 * desynchronises -- the failure ui/router.js documents at length -- and it
 * would tear down and rebuild the live Chart.js canvases on every pointermove.
 *
 * POINTER EVENTS, not mouse/touch pairs: one code path covers mouse, touch
 * and pen, and setPointerCapture keeps the gesture alive when the pointer
 * leaves the element -- which it will, because the widget moves out from
 * under it.
 */

(function () {
  var GRID_COLUMNS = 12;

  /* The app has two permanent announcers (layouts/base.njk) and a helper that
     knows to clear-then-set on the next frame, because assistive tech only
     reacts to a CHANGE -- "moved to position 3" twice in a row is silent
     otherwise. The first version hand-rolled this lookup against "#pb-live",
     an element that does not exist anywhere in the app, so every announcement
     the keyboard path made was dropped in silence. No gate caught it: axe
     cannot see a live region that is never written to. */
  function announce(msg) {
    if (window.PBAnnounce && window.PBAnnounce.announce) window.PBAnnounce.announce(msg);
  }

  function widgetEls(grid) {
    return Array.prototype.slice.call(grid.querySelectorAll("[data-widget-id]"));
  }

  /* DOM order equals store order (the x-for renders the widget array), but
     while a gesture is previewing, `order` means the two diverge on screen.
     Anything hit-testing against the screen has to sort by what the user can
     actually see. */
  function visualEls(grid) {
    return widgetEls(grid).sort(function (a, b) {
      var ra = a.getBoundingClientRect();
      var rb = b.getBoundingClientRect();
      return ra.top - rb.top || ra.left - rb.left;
    });
  }

  /* Show the arrangement that WOULD result from moving `from` to `to`,
     without moving anything. Because the preview already reflects the
     intended arrangement, a visual slot index is the store index it would
     occupy -- which is what lets the hit test return a store index directly. */
  function applyOrderPreview(grid, from, to) {
    var els = widgetEls(grid);
    var seq = els.map(function (_, i) { return i; });
    var moved = seq.splice(from, 1)[0];
    seq.splice(to, 0, moved);
    seq.forEach(function (domIndex, visualPos) {
      els[domIndex].style.order = String(visualPos);
    });
  }

  function clearOrderPreview(grid) {
    widgetEls(grid).forEach(function (el) { el.style.order = ""; });
  }

  /* Which slot is the pointer over? Compares against element centres rather
     than edges: edge-based hit testing makes the drop target flicker between
     two widgets when the pointer sits on a boundary. */
  function slotFromPoint(grid, x, y, dragged) {
    var els = visualEls(grid);
    var others = els.filter(function (e) { return e !== dragged; });
    for (var i = 0; i < others.length; i++) {
      var r = others[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
      if (y <= r.bottom && x < r.left + r.width / 2) return i;
    }
    return others.length;
  }

  window.PBDashGrid = {
    /* Called by the Alpine view. `api` supplies the store calls so this file
       stays free of store knowledge and can be tested on its own. */
    attach: function (grid, api) {
      if (!grid || grid.__pbGridBound) return;
      grid.__pbGridBound = true;

      var drag = null; /* { el, id, pointerId, from, preview } */
      var resize = null;
      var kb = null; /* { el, id, from, preview, startW, startH } */

      function commitMove(state) {
        clearOrderPreview(grid);
        if (state.preview !== state.from) api.move(state.id, state.preview);
      }

      /* ---------- pointer ---------- */
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
          var rowPx = parseFloat(styles.getPropertyValue("grid-auto-rows")) || 44;
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
          var from = widgetEls(grid).indexOf(el);
          drag = {
            el: el, id: el.getAttribute("data-widget-id"),
            pointerId: e.pointerId, from: from, preview: from,
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
          api.previewSize(resize.el, resize.startW + dw, resize.startH + dh);
          return;
        }
        if (!drag) return;
        var to = slotFromPoint(grid, e.clientX, e.clientY, drag.el);
        if (to === drag.preview) return;
        drag.preview = to;
        applyOrderPreview(grid, drag.from, to);
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
          try { drag.el.releasePointerCapture(drag.pointerId); } catch (_e2) {}
          commitMove(drag);
          if (drag.preview !== drag.from) {
            announce("Widget moved to position " + (drag.preview + 1));
          }
          drag = null;
        }
      }
      grid.addEventListener("pointerup", endPointer);
      grid.addEventListener("pointercancel", endPointer);

      /* ---------- keyboard ---------- */
      grid.addEventListener("keydown", function (e) {
        var grip = e.target.closest("[data-widget-grip]");
        if (!grip) return;
        var el = e.target.closest("[data-widget-id]");
        if (!el) return;
        var id = el.getAttribute("data-widget-id");

        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (kb && kb.id === id) {
            var landed = kb.preview;
            commitMove(kb);
            el.classList.remove("is-keyboard-active");
            kb = null;
            announce("Widget dropped at position " + (landed + 1));
          } else {
            var from = widgetEls(grid).indexOf(el);
            var size = api.sizeOf(id);
            kb = { el: el, id: id, from: from, preview: from, startW: size.w, startH: size.h };
            el.classList.add("is-keyboard-active");
            announce(
              "Picked up " + api.titleOf(id) + ", position " + (from + 1) + " of " +
                widgetEls(grid).length + ". Arrow keys move, shift and arrow keys resize, " +
                "space to drop, escape to cancel."
            );
          }
          return;
        }

        if (!kb || kb.id !== id) return;

        /* Cancel is free. It drops the CSS preview and restores the size the
           widget had at pick-up; nothing reaches the store, so abandoning a
           gesture leaves no trace in history at all. */
        if (e.key === "Escape") {
          e.preventDefault();
          clearOrderPreview(grid);
          if (api.sizeOf(id).w !== kb.startW || api.sizeOf(id).h !== kb.startH) {
            api.resize(id, kb.startW, kb.startH);
          }
          el.classList.remove("is-keyboard-active");
          announce("Cancelled, widget back at position " + (kb.from + 1));
          kb = null;
          return;
        }

        var arrows = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 };
        if (!(e.key in arrows)) return;
        e.preventDefault();
        var horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
        var delta = arrows[e.key];

        if (e.shiftKey) {
          /* Resize still commits per keypress, deliberately: each press is a
             discrete decision with its own visible result, and the sizes are
             clamped so the stack cannot run away the way move could. */
          var s = api.sizeOf(id);
          api.resize(id, horizontal ? s.w + delta : s.w, horizontal ? s.h : s.h + delta);
          var after = api.sizeOf(id);
          announce(api.titleOf(id) + " is now " + after.w + " of 12 columns, " + after.h + " rows");
          return;
        }

        var next = Math.max(0, Math.min(widgetEls(grid).length - 1, kb.preview + delta));
        if (next === kb.preview) return;
        kb.preview = next;
        applyOrderPreview(grid, kb.from, next);
        announce(api.titleOf(id) + " moved to position " + (next + 1) + " of " + widgetEls(grid).length);
        /* No re-focus dance is needed any more. Previously each arrow key
           committed to the store, Alpine re-rendered the row, and the grip
           under the user's finger was replaced mid-gesture -- so focus had to
           be chased across a rebuilt DOM. Previewing in CSS leaves the very
           same element focused for the whole gesture. */
      });
    },
  };
})();
