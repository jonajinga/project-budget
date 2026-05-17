/* Per-report PDF export — builds a clean, branded one-or-many-page PDF
 * via jsPDF (UMD vendored at /assets/js/vendor/jspdf.umd.min.js).
 *
 * Why client-side jsPDF instead of browser Save-as-PDF: the browser
 * print path rasterizes Chart.js canvas at screen DPI which is soft
 * on retina/print. jsPDF lets us:
 *   - Pull a crisp 2x PNG of every Chart.js canvas via toBase64Image(2)
 *   - Convert D3 SVGs to PNG via a temporary canvas
 *   - Lay out title + KPI strip + chart + table deterministically
 *   - Stamp a brand footer + page numbers
 *
 * Usage (from a report's Alpine factory):
 *   import or rely on window.pbExportReportPDF; then:
 *     this.exportPDF = function () {
 *       window.pbExportReportPDF({
 *         title: "Income vs expense",
 *         subtitle: "Trailing 12 months · Sample household",
 *         filename: "income-vs-expense",
 *         kpis: [
 *           { label: "Avg monthly income", value: "$8,521" },
 *           { label: "Avg monthly expense", value: "$6,033" },
 *           ...
 *         ],
 *         chartEl: document.getElementById("chart-ie"),
 *         columns: [
 *           { key: "month",   label: "Month" },
 *           { key: "income",  label: "Income",  numeric: true },
 *           ...
 *         ],
 *         rows: this.rows,
 *       });
 *     };
 *
 * Layout (Letter portrait):
 *   - Margins: 0.5in
 *   - Header: brand wordmark + title (Helvetica Bold 18pt) + subtitle (10pt muted)
 *   - KPI strip: 2-col x N-row table of labels + values
 *   - Chart: full-width PNG (computed aspect ratio preserved)
 *   - Table: header row + alternating fill rows, paginated
 *   - Footer (every page): "Project Budget · projectbudget.org" + page N of M + generation timestamp
 */

(function () {
  if (typeof window === "undefined") return;

  /* Approximate cents -> "$1,234.56" for KPI + table cells. We use
     this only for `numeric: true` columns where the value is an
     integer >= 1000 (cents heuristic). Otherwise the raw value is
     stringified directly. */
  function fmtCellValue(v, col) {
    if (typeof col.format === "function") return String(col.format(v));
    if (v == null) return "";
    if (col.numeric && Math.abs(v) >= 1000 && Number.isInteger(v)) {
      var n = v / 100;
      var sign = n < 0 ? "-" : "";
      var abs = Math.abs(n);
      return sign + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(v);
  }

  /* Convert any inline SVG element to a PNG data URL via the
     XMLSerializer + Image + Canvas pipeline. Returns a Promise<string>
     that resolves with the dataURL, or null if the conversion fails
     (e.g. SVG has external references the temporary Image can't load). */
  function svgToPNG(svg, scale) {
    return new Promise(function (resolve) {
      if (!svg || svg.tagName.toLowerCase() !== "svg") return resolve(null);
      try {
        var rect = svg.getBoundingClientRect();
        var w = Math.round(rect.width  || svg.viewBox.baseVal.width  || 800);
        var h = Math.round(rect.height || svg.viewBox.baseVal.height || 600);
        var s = scale || 2;
        /* Clone + ensure xmlns is set so the standalone serialization
           is a valid document. */
        var clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        if (!clone.getAttribute("width"))  clone.setAttribute("width", w);
        if (!clone.getAttribute("height")) clone.setAttribute("height", h);
        var xml = new XMLSerializer().serializeToString(clone);
        var src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement("canvas");
          canvas.width  = w * s;
          canvas.height = h * s;
          var ctx = canvas.getContext("2d");
          /* White background under the SVG so dark themes don't ship
             a transparent PNG that prints invisibly on white paper. */
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = function () { resolve(null); };
        img.src = src;
      } catch (_e) { resolve(null); }
    });
  }

  /* Pull a PNG dataURL out of either:
       - a <canvas> element inside chartEl (Chart.js path) via the
         tracked __pbChart instance's toBase64Image() at 2x devicePixelRatio
       - the SVG element inside chartEl (D3 path) via svgToPNG()
     Returns Promise<{ dataUrl, aspectRatio }> or null. */
  function captureChart(chartEl) {
    return new Promise(function (resolve) {
      if (!chartEl) return resolve(null);
      var canvas = chartEl.querySelector("canvas");
      if (canvas && canvas.__pbChart) {
        try {
          /* Chart.js toBase64Image accepts (type, quality) — pass
             undefined for type to default to PNG. The 2x scale is
             baked into the chart's devicePixelRatio at render. */
          var inst = canvas.__pbChart;
          /* Force a 2x DPR redraw so the captured PNG is crisp even
             when the user is on a 1x display. */
          var prevDpr = inst.options.devicePixelRatio;
          inst.options.devicePixelRatio = 2;
          inst.resize(); inst.draw();
          var dataUrl = inst.toBase64Image("image/png", 1.0);
          /* Restore screen DPR so the on-page chart goes back to
             normal after capture. */
          inst.options.devicePixelRatio = prevDpr || 1;
          inst.resize(); inst.draw();
          var aspectRatio = (canvas.width || 800) / (canvas.height || 400);
          return resolve({ dataUrl: dataUrl, aspectRatio: aspectRatio });
        } catch (_e) { /* fall through to SVG path */ }
      }
      var svg = chartEl.querySelector("svg");
      if (svg) {
        var rect = svg.getBoundingClientRect();
        var aspect = (rect.width || 800) / (rect.height || 400);
        return svgToPNG(svg, 2).then(function (url) {
          if (!url) return resolve(null);
          resolve({ dataUrl: url, aspectRatio: aspect });
        });
      }
      resolve(null);
    });
  }

  /* Lay out a KPI strip as a 2-col grid (or 4-col if there are <= 4
     KPIs and they fit). Returns the y-cursor after drawing. */
  function drawKPIStrip(doc, kpis, x, y, maxWidth) {
    if (!kpis || !kpis.length) return y;
    var cols = kpis.length <= 4 ? kpis.length : 2;
    var rows = Math.ceil(kpis.length / cols);
    var cellW = maxWidth / cols;
    var cellH = 56;
    kpis.forEach(function (k, i) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var cx = x + col * cellW;
      var cy = y + row * cellH;
      doc.setDrawColor(220);
      doc.setLineWidth(0.5);
      doc.rect(cx + 2, cy + 2, cellW - 4, cellH - 4);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110);
      doc.text(String(k.label || "").toUpperCase(), cx + 8, cy + 14);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(30);
      doc.text(String(k.value || ""), cx + 8, cy + 36);
      if (k.delta) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(140);
        doc.text(String(k.delta), cx + 8, cy + 48);
      }
    });
    return y + rows * cellH + 8;
  }

  /* Draw a paginated table. Returns the y-cursor on the final page. */
  function drawTable(doc, columns, rows, x, y, maxWidth, footerY) {
    if (!columns || !columns.length || !rows || !rows.length) return y;
    var cols = columns;
    var colW = maxWidth / cols.length;
    var rowH = 16;
    var headerH = 20;
    function drawHeader(yy) {
      doc.setFillColor(245);
      doc.rect(x, yy, maxWidth, headerH, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(50);
      cols.forEach(function (c, i) {
        var align = c.numeric ? "right" : "left";
        var tx = align === "right" ? x + (i + 1) * colW - 6 : x + i * colW + 6;
        doc.text(String(c.label), tx, yy + 13, { align: align });
      });
      return yy + headerH;
    }
    var cy = drawHeader(y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30);
    var alt = false;
    for (var i = 0; i < rows.length; i++) {
      if (cy + rowH > footerY) {
        /* New page */
        doc.addPage();
        cy = drawHeader(28);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30);
        alt = false;
      }
      if (alt) {
        doc.setFillColor(250);
        doc.rect(x, cy, maxWidth, rowH, "F");
      }
      alt = !alt;
      var r = rows[i];
      cols.forEach(function (c, ci) {
        var v = fmtCellValue(r[c.key], c);
        var align = c.numeric ? "right" : "left";
        var tx = align === "right" ? x + (ci + 1) * colW - 6 : x + ci * colW + 6;
        /* Truncate long cells with ellipsis to avoid running over
           the next column. */
        var maxChars = Math.floor(colW / 5);
        if (v.length > maxChars) v = v.slice(0, Math.max(1, maxChars - 1)) + "…";
        doc.text(v, tx, cy + 11, { align: align });
      });
      cy += rowH;
    }
    return cy;
  }

  /* Footer on every page — Project Budget brand + page number +
     generation timestamp. Called once per page. */
  function stampFooters(doc, marginX, pageH) {
    var total = doc.internal.getNumberOfPages();
    var stamp = "Generated " + new Date().toLocaleString();
    for (var p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(130);
      doc.text("Project Budget · projectbudget.org", marginX, pageH - 14);
      doc.text(stamp, marginX, pageH - 6);
      doc.text("Page " + p + " of " + total, doc.internal.pageSize.getWidth() - marginX, pageH - 6, { align: "right" });
    }
  }

  /* Expose the capture helpers so the hub's bundle-PDF can iframe a
     report, pull its rendered chart, and assemble multi-report docs
     without duplicating the SVG/canvas pipeline. */
  window.pbCaptureChart = captureChart;
  window.pbSvgToPNG = svgToPNG;

  /* The main entry point. Returns a Promise that resolves when the
     PDF has been triggered for download. */
  window.pbExportReportPDF = function (opts) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.error("jsPDF not loaded — PDF export unavailable.");
      return Promise.resolve();
    }
    var doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var margin = 36; /* 0.5in */
    var contentW = pageW - margin * 2;

    /* Title block */
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20);
    doc.text(String(opts.title || "Report"), margin, margin + 16);
    if (opts.subtitle) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
      doc.text(String(opts.subtitle), margin, margin + 32);
    }
    /* Thin divider under the title block. */
    doc.setDrawColor(220); doc.setLineWidth(0.5);
    doc.line(margin, margin + 42, pageW - margin, margin + 42);

    var y = margin + 56;
    y = drawKPIStrip(doc, opts.kpis, margin, y, contentW);

    return captureChart(opts.chartEl).then(function (capture) {
      if (capture && capture.dataUrl) {
        /* Fit width; cap height at 280pt so very tall charts don't
           push the table to a second page unnecessarily. */
        var imgW = contentW;
        var imgH = Math.min(280, imgW / (capture.aspectRatio || 2));
        doc.addImage(capture.dataUrl, "PNG", margin, y, imgW, imgH);
        y += imgH + 12;
      }
      y = drawTable(doc, opts.columns || [], opts.rows || [], margin, y, contentW, pageH - 28);
      stampFooters(doc, margin, pageH);
      var name = (opts.filename || "report") + "-" + new Date().toISOString().slice(0, 10) + ".pdf";
      doc.save(name);
    });
  };
})();
