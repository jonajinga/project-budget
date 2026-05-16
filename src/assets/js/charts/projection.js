/* Forward cashflow — line with shaded band (low/high envelope). */

import { colors } from "./theme-colors.js";

export function render(el, data) {
  if (!el || !window.d3) return;
  var d3 = window.d3;
  el.innerHTML = "";
  if (!data || !data.length) { el.textContent = "No data yet."; return; }

  var c = colors();
  var rect = el.getBoundingClientRect();
  var width = Math.max(320, rect.width || 600);
  var height = 280;
  var margin = { top: 16, right: 16, bottom: 36, left: 64 };
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var svg = d3.select(el).append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("class", "chart__svg")
    .attr("role", "img")
    .attr("aria-label", "Cashflow projection");

  var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var x = d3.scalePoint().domain(data.map(function (d) { return d.month; })).range([0, innerW]).padding(0.5);
  var ext = [
    d3.min(data, function (d) { return d.low; }),
    d3.max(data, function (d) { return d.high; }),
  ];
  var pad = Math.max(100, (ext[1] - ext[0]) * 0.1);
  var y = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).nice().range([innerH, 0]);

  g.append("g").attr("class", "axis").attr("transform", "translate(0," + innerH + ")")
    .call(d3.axisBottom(x).tickFormat(function (m) { return m.slice(5); }));
  g.append("g").attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(function (v) { return "$" + Math.round(v / 100); }));

  var area = d3.area()
    .x(function (d) { return x(d.month); })
    .y0(function (d) { return y(d.low); })
    .y1(function (d) { return y(d.high); })
    .curve(d3.curveMonotoneX);

  g.append("path").datum(data)
    .attr("fill", c["chart-1"]).attr("fill-opacity", 0.15)
    .attr("d", area);

  var line = d3.line()
    .x(function (d) { return x(d.month); })
    .y(function (d) { return y(d.expected); })
    .curve(d3.curveMonotoneX);

  g.append("path").datum(data)
    .attr("fill", "none").attr("stroke", c["chart-1"]).attr("stroke-width", 2)
    .attr("d", line);

  /* Zero line for reference */
  if (y(0) >= 0 && y(0) <= innerH) {
    g.append("line")
      .attr("x1", 0).attr("x2", innerW).attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke", c["danger"]).attr("stroke-dasharray", "3 3").attr("stroke-width", 1);
  }
}
