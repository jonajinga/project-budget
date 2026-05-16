/* Treemap of spending by category over a window. */

import { colors } from "./theme-colors.js";

export function render(el, data) {
  if (!el || !window.d3) return;
  var d3 = window.d3;
  el.innerHTML = "";
  if (!data || !data.length) { el.textContent = "No spending in this range."; return; }

  var c = colors();
  var rect = el.getBoundingClientRect();
  var width = Math.max(320, rect.width || 600);
  var height = 360;

  var svg = d3.select(el).append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("class", "chart__svg")
    .attr("role", "img")
    .attr("aria-label", "Spending by category");

  var root = d3.hierarchy({ children: data })
    .sum(function (d) { return d.value || 0; })
    .sort(function (a, b) { return (b.value || 0) - (a.value || 0); });

  d3.treemap().size([width, height]).paddingInner(2)(root);

  var leaves = root.leaves();
  var palette = c.palette;

  var cells = svg.selectAll("g").data(leaves).enter().append("g")
    .attr("transform", function (d) { return "translate(" + d.x0 + "," + d.y0 + ")"; });

  cells.append("rect")
    .attr("width", function (d) { return d.x1 - d.x0; })
    .attr("height", function (d) { return d.y1 - d.y0; })
    .attr("fill", function (_d, i) { return palette[i % palette.length]; })
    .attr("fill-opacity", 0.85)
    .attr("stroke", c["border"])
    .attr("stroke-width", 1);

  cells.append("text")
    .attr("x", 6).attr("y", 16)
    .attr("fill", "#fff")
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .each(function (d) {
      var w = d.x1 - d.x0;
      var h = d.y1 - d.y0;
      if (w < 40 || h < 20) return;
      var sel = d3.select(this);
      sel.append("tspan").text(d.data.category);
      sel.append("tspan")
        .attr("x", 6).attr("dy", 14).attr("font-weight", 400).attr("font-size", 11)
        .text("$" + (d.data.value / 100).toFixed(0));
    });
}
