/* Small multiples — one mini line per category over the last N months. */

import { colors } from "./theme-colors.js";

export function render(el, series) {
  if (!el || !window.d3) return;
  var d3 = window.d3;
  el.innerHTML = "";
  if (!series || !series.length) { el.textContent = "No data."; return; }

  var c = colors();
  var cols = 3;
  var rect = el.getBoundingClientRect();
  var width = Math.max(320, rect.width || 600);
  var cellW = Math.floor(width / cols) - 8;
  var cellH = 80;

  var grid = document.createElement("div");
  grid.className = "small-multiples";
  el.appendChild(grid);

  series.forEach(function (s, i) {
    var card = document.createElement("div");
    card.className = "small-multiple";
    grid.appendChild(card);

    var head = document.createElement("p");
    head.className = "small-multiple__title";
    head.textContent = s.category;
    card.appendChild(head);

    var sub = document.createElement("p");
    sub.className = "small-multiple__sub";
    sub.textContent = "Total $" + (s.total / 100).toFixed(0);
    card.appendChild(sub);

    var svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.setAttribute("viewBox", "0 0 " + cellW + " " + cellH);
    svgEl.setAttribute("class", "chart__svg");
    card.appendChild(svgEl);

    var max = d3.max(s.points, function (p) { return p.value; }) || 1;
    var x = d3.scalePoint().domain(s.points.map(function (p) { return p.month; })).range([4, cellW - 4]);
    var y = d3.scaleLinear().domain([0, max]).range([cellH - 8, 8]);

    var line = d3.line()
      .x(function (p) { return x(p.month); })
      .y(function (p) { return y(p.value); })
      .curve(d3.curveMonotoneX);

    var svg = d3.select(svgEl);
    svg.append("path").datum(s.points)
      .attr("fill", "none")
      .attr("stroke", c.palette[i % c.palette.length])
      .attr("stroke-width", 1.5)
      .attr("d", line);
  });
}
