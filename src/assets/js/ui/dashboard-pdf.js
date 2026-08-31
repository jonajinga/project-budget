/* Dashboard → PDF.
 *
 * Deliberately NOT the jsPDF path that ui/pdf-export.js uses for reports.
 * That builds a page by hand -- title block, KPI strip, one chart, one table
 * -- which is exactly right for a report, whose shape is known. A dashboard
 * is a grid of thirteen different widget types in a user-chosen arrangement;
 * hand-laying that out in jsPDF would mean writing and maintaining a second
 * renderer for every widget, and it would drift from the real one the first
 * time somebody edited a card.
 *
 * So this prints the actual DOM, which means the PDF shows what the user is
 * looking at, in their theme, with their layout, forever, with no second
 * renderer to maintain. Text stays vector and selectable, which a rasterised
 * screenshot would lose.
 *
 * The one thing browser print genuinely does badly is Chart.js: a <canvas>
 * prints at screen resolution and looks soft. pdf-export.js already solved
 * that (pbCaptureChart pulls a 2x PNG), so this borrows it -- every canvas is
 * swapped for a high-DPI image before printing and swapped back after.
 *
 * Restoration runs from `afterprint` AND from a timeout, because afterprint
 * is unreliable when the user cancels the dialog in some browsers, and a
 * dashboard permanently stuck showing flat images of its charts would be a
 * much worse bug than a soft chart.
 */

(function () {
  function restoreAll(swaps) {
    for (var i = 0; i < swaps.length; i++) {
      var s = swaps[i];
      if (s.img && s.img.parentNode) s.img.parentNode.replaceChild(s.canvas, s.img);
    }
  }

  window.PBDashboardPdf = {
    export: function (grid, name) {
      if (!grid) return Promise.resolve();

      var canvases = Array.prototype.slice.call(grid.querySelectorAll("canvas"));
      var swaps = [];
      var capture = window.pbCaptureChart;

      /* Title drives the default filename in the print dialog, so the user
         gets "Overview — Project Budget.pdf" rather than "app". */
      var originalTitle = document.title;
      document.title = (name || "Dashboard") + " — Project Budget";
      document.body.classList.add("is-printing-dashboard");

      var work = canvases.map(function (c) {
        if (!capture) return Promise.resolve(null);
        return capture(c)
          .then(function (cap) {
            if (!cap || !cap.dataUrl) return null;
            var img = new Image();
            img.src = cap.dataUrl;
            img.className = "dash-print-chart";
            /* Hold the on-screen box so the grid does not reflow while the
               dialog is open -- a layout jump mid-print produces a PDF that
               does not match what was on screen. */
            var r = c.getBoundingClientRect();
            img.style.width = r.width + "px";
            img.style.height = r.height + "px";
            if (c.parentNode) {
              c.parentNode.replaceChild(img, c);
              swaps.push({ canvas: c, img: img });
            }
            return null;
          })
          .catch(function () { return null; });
      });

      return Promise.all(work).then(function () {
        var done = false;
        function cleanup() {
          if (done) return;
          done = true;
          restoreAll(swaps);
          document.body.classList.remove("is-printing-dashboard");
          document.title = originalTitle;
          window.removeEventListener("afterprint", cleanup);
        }
        window.addEventListener("afterprint", cleanup);
        /* Belt and braces: afterprint does not fire reliably on cancel in
           every browser, and leaving the page in its print state would be a
           worse failure than a soft chart. */
        setTimeout(cleanup, 60000);

        /* One frame so the swapped images are laid out before the dialog
           snapshots the page. */
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            window.print();
          });
        });
      });
    },
  };
})();
