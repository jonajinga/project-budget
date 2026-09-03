/* Small inline-SVG charts for the history pages. Strings, not DOM, so a
   view can drop them in with x-html and they redraw on every reactive
   update. Colours come from the app's tokens via currentColor and CSS
   classes, so light and dark both work without a palette here. */
(function () {
  "use strict";
  function esc(t) { return String(t).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }
  function fmt(c) { return (c < 0 ? "-" : "") + "$" + Math.round(Math.abs(c) / 100).toLocaleString("en-US"); }
  function nice(max) {
    if (max <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(max)));
    var n = max / p;
    var s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return s * p;
  }

  /* Vertical bars with optional overlay line, y grid, month labels.
     opts: { values, labels, line, highlight, height, valueClass } */
  function bars(opts) {
    var values = opts.values || [];
    var labels = opts.labels || [];
    var line = opts.line || null;
    var n = values.length;
    if (!n) return '<p class="mini-chart__empty">No data yet.</p>';
    var narrow = window.innerWidth < 700;
    var W = narrow ? 360 : 600, H = opts.height || 180, padL = 44, padR = 8, padT = 10, padB = 22;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var maxV = Math.max.apply(null, values.concat(line || [0]).concat([0]));
    var top = nice(maxV);
    var y = function (v) { return padT + innerH - (v / top) * innerH; };
    var slot = innerW / n;
    var bw = Math.max(3, Math.min(28, slot * 0.62));
    var out = '<svg class="mini-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(opts.aria || "chart") + '">';
    [0, 0.5, 1].forEach(function (f) {
      var yy = y(top * f);
      out += '<line class="mini-chart__grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"/>';
      out += '<text class="mini-chart__tick" x="' + (padL - 6) + '" y="' + (yy + 3) + '" text-anchor="end">' + esc(fmt(top * f)) + '</text>';
    });
    values.forEach(function (v, i) {
      var x = padL + i * slot + (slot - bw) / 2;
      var h = Math.max(0, (v / top) * innerH);
      var cls = "mini-chart__bar" + (opts.highlight === i ? " is-highlight" : "") + (opts.valueClass ? " " + opts.valueClass(v, i) : "");
      out += '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + (y(v)).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"><title>' + esc((labels[i] || "") + ": " + fmt(v)) + '</title></rect>';
    });
    if (line) {
      var pts = line.map(function (v, i) { return (padL + i * slot + slot / 2).toFixed(1) + "," + y(v).toFixed(1); }).join(" ");
      out += '<polyline class="mini-chart__line" points="' + pts + '"/>';
      line.forEach(function (v, i) {
        out += '<circle class="mini-chart__dot" cx="' + (padL + i * slot + slot / 2).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.5"><title>' + esc((labels[i] || "") + ": " + fmt(v)) + '</title></circle>';
      });
    }
    var every = n > 24 ? 6 : (n > 12 ? 3 : (narrow && n > 6 ? 2 : 1));
    labels.forEach(function (l, i) {
      if (i % every !== 0 && i !== n - 1) return;
      var anchor = i === 0 ? "start" : (i === n - 1 ? "end" : "middle");
      out += '<text class="mini-chart__label" x="' + (padL + i * slot + slot / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anchor + '">' + esc(l) + '</text>';
    });
    return out + "</svg>";
  }

  /* One or more lines. series: [{ values, cls }] */
  function lines(opts) {
    var series = opts.series || [];
    var labels = opts.labels || [];
    var n = labels.length;
    if (!n || !series.length) return '<p class="mini-chart__empty">No data yet.</p>';
    var narrow = window.innerWidth < 700;
    var W = narrow ? 360 : 600, H = opts.height || 180, padL = 44, padR = 8, padT = 10, padB = 22;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var all = [];
    series.forEach(function (s) { all = all.concat(s.values); });
    var maxV = Math.max.apply(null, all.concat([0]));
    var minV = Math.min.apply(null, all.concat([0]));
    var top = nice(maxV);
    var bottom = minV < 0 ? -nice(-minV) : 0;
    var y = function (v) { return padT + innerH - ((v - bottom) / (top - bottom)) * innerH; };
    var x = function (i) { return padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW); };
    var out = '<svg class="mini-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(opts.aria || "chart") + '">';
    [bottom, (top + bottom) / 2, top].forEach(function (v) {
      out += '<line class="mini-chart__grid' + (v === 0 ? " is-zero" : "") + '" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      out += '<text class="mini-chart__tick" x="' + (padL - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + esc(fmt(v)) + '</text>';
    });
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); }).join(" ");
      if (s.area) {
        out += '<polygon class="mini-chart__area ' + esc(s.cls || "") + '" points="' + x(0).toFixed(1) + "," + y(bottom).toFixed(1) + " " + pts + " " + x(n - 1).toFixed(1) + "," + y(bottom).toFixed(1) + '"/>';
      }
      out += '<polyline class="mini-chart__line ' + esc(s.cls || "") + '" points="' + pts + '"/>';
    });
    var every = n > 24 ? 6 : (n > 12 ? 3 : (narrow && n > 6 ? 2 : 1));
    labels.forEach(function (l, i) {
      if (i % every !== 0 && i !== n - 1) return;
      var anchor = i === 0 ? "start" : (i === n - 1 ? "end" : "middle");
      out += '<text class="mini-chart__label" x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anchor + '">' + esc(l) + '</text>';
    });
    return out + "</svg>";
  }

  window.PBMini = { bars: bars, lines: lines };
})();
