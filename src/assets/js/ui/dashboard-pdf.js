/* Dashboard -> a PDF file.
 *
 * The first version called window.print() and labelled the menu item "Export
 * as PDF". It defended that on the grounds that hand-laying-out thirteen
 * widget types means a second renderer that drifts from the first.
 *
 * That argument died when a widget became {source, params, view}. The
 * composer dispatches on VIEW KIND - five cases, not thirteen widget types -
 * and pulls its numbers from the same memoized store methods the screen
 * reads, so there is no second data path to drift. The only bespoke surface
 * left is the thirteen panels, and those are ~13 small projections in
 * domain/dashboard-pdf-blocks.js with no DOM and their own unit test.
 *
 * Everything here is built on primitives pdf-export.js already owns:
 * pbEnsureJsPDF (lazy, vendored), pbCaptureChart (handles the Chart.js 2x
 * path and the D3 SVG path), pbDrawTable, pbDrawKPIStrip, pbStampFooters. No
 * new dependency, and one place where a table gets drawn.
 *
 * The @media print block in dashboard.css stays - Cmd+P should still produce
 * something sensible. What is gone is a menu item that says PDF and opens a
 * print dialog.
 */

(function () {
  var MARGIN = 36;
  var GAP = 14;

  function heading(doc, text, x, y, size, color) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(color == null ? 20 : color);
    doc.text(String(text), x, y);
    return y + size + 4;
  }

  window.PBDashboardPdf = {
    /* `api` supplies what only the page knows: the widgets in order, each
       one's chart host element, and how to read its data. Keeping the store
       out of this file is what lets the block projections be unit-tested
       against a fake one. */
    export: async function (opts) {
      var name = (opts && opts.name) || "Dashboard";
      var widgets = (opts && opts.widgets) || [];
      var api = opts || {};

      if (!window.pbEnsureJsPDF) return { ok: false, reason: "pdf-export.js not loaded" };
      await window.pbEnsureJsPDF();
      var JsPDF = window.jspdf && window.jspdf.jsPDF;
      if (!JsPDF) return { ok: false, reason: "jsPDF unavailable" };

      var doc = new JsPDF({ unit: "pt", format: "a4" });
      var pageW = doc.internal.pageSize.getWidth();
      var pageH = doc.internal.pageSize.getHeight();
      var contentW = pageW - MARGIN * 2;

      /* Title block, mirroring pbExportReportPDF so the two documents look
         like they came from the same application. */
      var y = heading(doc, name, MARGIN, MARGIN + 16, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text(
        (api.profileName ? api.profileName + "  -  " : "") + (api.today || ""),
        MARGIN,
        y
      );
      y += 10;
      doc.setDrawColor(220);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y, pageW - MARGIN, y);
      y += 20;

      var skipped = [];

      for (var i = 0; i < widgets.length; i++) {
        var w = widgets[i];
        var kind = api.kindOf(w);
        var title = api.titleOf(w);

        /* Measure-then-place: a block never starts so low on the page that
           its own heading is orphaned from its content. */
        if (y > pageH - MARGIN - 90) {
          doc.addPage();
          y = MARGIN + 16;
        }

        y = heading(doc, title, MARGIN, y, 12, 40);

        if (kind === "chart") {
          var host = api.hostFor(w.id);
          var capture = host && window.pbCaptureChart ? await window.pbCaptureChart(host) : null;
          if (capture && capture.dataUrl) {
            var imgW = contentW;
            var imgH = Math.min(240, imgW / (capture.aspectRatio || 2));
            if (y + imgH > pageH - MARGIN) { doc.addPage(); y = MARGIN + 16; }
            doc.addImage(capture.dataUrl, "PNG", MARGIN, y, imgW, imgH);
            y += imgH + GAP;
          } else {
            skipped.push(title);
            y += GAP;
          }
          continue;
        }

        if (kind === "table" || kind === "list") {
          var fields = api.fieldsFor(w);
          var rows = api.rowsFor(w);
          if (!fields.length || !rows.length) { skipped.push(title); y += GAP; continue; }
          y = window.pbDrawTable(
            doc,
            fields.map(function (f) { return f.label; }),
            rows.slice(0, 25).map(function (r) {
              return fields.map(function (f) { return api.formatField(r[f.key], f); });
            }),
            MARGIN, y, contentW, pageH - MARGIN
          );
          y += GAP;
          continue;
        }

        if (kind === "stat") {
          var stat = api.statFor(w);
          if (!stat) { skipped.push(title); y += GAP; continue; }
          y = window.pbDrawKPIStrip(
            doc, [{ label: stat.label, value: api.formatStat(stat) }], MARGIN, y, contentW
          );
          y += GAP;
          continue;
        }

        /* panel */
        var block = api.blockFor(w.source);
        if (block === undefined || block === null) { skipped.push(title); y += GAP; continue; }
        if (block.kind === "kpis" && block.kpis && block.kpis.length) {
          y = window.pbDrawKPIStrip(doc, block.kpis, MARGIN, y, contentW);
        } else if (block.kind === "table" && block.rows && block.rows.length) {
          y = window.pbDrawTable(doc, block.columns, block.rows.slice(0, 25), MARGIN, y, contentW, pageH - MARGIN);
        } else {
          skipped.push(title);
        }
        y += GAP;
      }

      if (window.pbStampFooters) window.pbStampFooters(doc, MARGIN, pageH);

      var file = String(name).replace(/[^a-z0-9]+/gi, "-").toLowerCase() +
        "-" + (api.today || "export") + ".pdf";
      doc.save(file);
      return { ok: true, pages: doc.internal.getNumberOfPages(), skipped: skipped };
    },
  };
})();
