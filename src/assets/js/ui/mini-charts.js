/* Small inline-SVG charts for the history pages.

   PBMini.into(el, spec) measures the element, draws the chart at that
   width so text is never stretched, and redraws on resize. spec is
   { kind: "bars" | "lines", ...options }. The older string builders
   PBMini.bars(opts) and PBMini.lines(opts) remain for callers that
   want markup. Colours come from the app's tokens through CSS
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
  /* Choose which axis labels to draw so none of them touch.
     Candidates are every k-th label plus the last one; each is then
     accepted only if its estimated box clears the previous accepted
     box. Estimating from character count avoids a DOM measure pass and
     is close enough at these type sizes. */
  function pickLabels(n, labels, xOf, fontPx) {
    var need = fontPx * 0.62;
    var wide = 0;
    labels.forEach(function (l) { wide = Math.max(wide, String(l == null ? "" : l).length); });
    var slotNeed = (wide + 1) * need;
    var span = n > 1 ? Math.abs(xOf(n - 1) - xOf(0)) : slotNeed;
    var fit = Math.max(1, Math.floor(span / slotNeed) + 1);
    var every = Math.max(1, Math.ceil(n / fit));
    var candidates = [];
    for (var i = 0; i < n; i += every) candidates.push(i);
    if (candidates[candidates.length - 1] !== n - 1) candidates.push(n - 1);
    var out = [], lastRight = -Infinity;
    candidates.forEach(function (i) {
      var w = String(labels[i] == null ? "" : labels[i]).length * need;
      var anchor = i === 0 ? "start" : (i === n - 1 ? "end" : "middle");
      var x = xOf(i);
      var left = anchor === "start" ? x : (anchor === "end" ? x - w : x - w / 2);
      if (left < lastRight + 4) return;
      lastRight = left + w;
      out.push({ i: i, anchor: anchor, x: x });
    });
    return out;
  }
  function typeSize(W) { return W >= 900 ? 13 : (W >= 600 ? 12 : 11); }

  function bars(opts) {
    var values = opts.values || [];
    var labels = opts.labels || [];
    var line = opts.line || null;
    var n = values.length;
    if (!n) return '<p class="mini-chart__empty">No data yet.</p>';
    var W = opts.width || 600, H = opts.height || 180;
    var fs = typeSize(W);
    var padL = fs * 5, padR = 8, padT = 10, padB = fs + 12;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var maxV = Math.max.apply(null, values.concat(line || [0]).concat([0]));
    var top = nice(maxV);
    var y = function (v) { return padT + innerH - (v / top) * innerH; };
    var slot = innerW / n;
    var bw = Math.max(3, Math.min(32, slot * 0.62));
    var out = '<svg class="mini-chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(opts.aria || "chart") + '" style="font-size:' + fs + 'px">';
    [0, 0.5, 1].forEach(function (f) {
      var yy = y(top * f);
      out += '<line class="mini-chart__grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"/>';
      out += '<text class="mini-chart__tick" x="' + (padL - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + esc(fmt(top * f)) + '</text>';
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
    pickLabels(n, labels, function (i) { return padL + i * slot + slot / 2; }, fs).forEach(function (p) {
      out += '<text class="mini-chart__label" x="' + p.x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + p.anchor + '">' + esc(labels[p.i]) + '</text>';
    });
    return out + "</svg>";
  }

  function lines(opts) {
    var series = opts.series || [];
    var labels = opts.labels || [];
    var n = labels.length;
    if (!n || !series.length) return '<p class="mini-chart__empty">No data yet.</p>';
    var W = opts.width || 600, H = opts.height || 180;
    var fs = typeSize(W);
    var padL = fs * 5, padR = 8, padT = 10, padB = fs + 12;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var all = [];
    series.forEach(function (s) { all = all.concat(s.values); });
    var maxV = Math.max.apply(null, all.concat([0]));
    var minV = Math.min.apply(null, all.concat([0]));
    var top = nice(maxV);
    var bottom = minV < 0 ? -nice(-minV) : 0;
    var y = function (v) { return padT + innerH - ((v - bottom) / (top - bottom)) * innerH; };
    var x = function (i) { return padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW); };
    var out = '<svg class="mini-chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(opts.aria || "chart") + '" style="font-size:' + fs + 'px">';
    [bottom, (top + bottom) / 2, top].forEach(function (v) {
      out += '<line class="mini-chart__grid' + (v === 0 ? " is-zero" : "") + '" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      out += '<text class="mini-chart__tick" x="' + (padL - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmt(v)) + '</text>';
    });
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); }).join(" ");
      if (s.area) {
        out += '<polygon class="mini-chart__area ' + esc(s.cls || "") + '" points="' + x(0).toFixed(1) + "," + y(bottom).toFixed(1) + " " + pts + " " + x(n - 1).toFixed(1) + "," + y(bottom).toFixed(1) + '"/>';
      }
      out += '<polyline class="mini-chart__line ' + esc(s.cls || "") + '" points="' + pts + '"/>';
    });
    pickLabels(n, labels, x, fs).forEach(function (p) {
      out += '<text class="mini-chart__label" x="' + p.x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + p.anchor + '">' + esc(labels[p.i]) + '</text>';
    });
    return out + "</svg>";
  }

  /* Draw into an element at its own width. Remembers the spec so a
     window resize redraws every mounted chart. */
  var mounted = [];
  function into(el, spec) {
    if (!el || !spec) return;
    var w = el.clientWidth || (el.parentElement && el.parentElement.clientWidth) || 600;
    var opts = Object.assign({}, spec, { width: Math.max(240, Math.floor(w)) });
    el.innerHTML = spec.kind === "lines" ? lines(opts) : bars(opts);
    var entry = mounted.find(function (m) { return m.el === el; });
    if (entry) entry.spec = spec; else mounted.push({ el: el, spec: spec });
  }
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      mounted = mounted.filter(function (m) { return document.body.contains(m.el); });
      mounted.forEach(function (m) { into(m.el, m.spec); });
    }, 120);
  });

  window.PBMini = { bars: bars, lines: lines, into: into };
})();
