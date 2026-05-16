/* Stacked horizontal bars showing each debt account's current balance,
   with payoff months alongside. */

import { colors } from "./theme-colors.js";

export function render(el, rows) {
  if (!el || !window.d3) return;
  var d3 = window.d3;
  el.innerHTML = "";
  if (!rows || !rows.length) { el.textContent = "No debt accounts."; return; }

  var c = colors();
  var rect = el.getBoundingClientRect();
  var width = Math.max(320, rect.width || 600);
  var rowH = 36;
  var height = rows.length * rowH + 16;

  var svg = d3.select(el).append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("class", "chart__svg")
    .attr("role", "img")
    .attr("aria-label", "Debt balances");

  var margin = { left: 160, right: 96, top: 8, bottom: 8 };
  var maxV = d3.max(rows, function (r) { return r.balance; }) || 1;
  var x = d3.scaleLinear().domain([0, maxV]).range([0, width - margin.left - margin.right]);

  rows.forEach(function (r, i) {
    var yTop = margin.top + i * rowH;
    svg.append("text")
      .attr("x", margin.left - 8).attr("y", yTop + 22)
      .attr("text-anchor", "end").attr("fill", c["fg"])
      .attr("font-size", 13).text(r.account);

    svg.append("rect")
      .attr("x", margin.left).attr("y", yTop + 8)
      .attr("width", x(r.balance)).attr("height", rowH - 16)
      .attr("fill", c["chart-5"]).attr("fill-opacity", 0.85);

    var label = "$" + (r.balance / 100).toFixed(0);
    if (r.monthsToPayoff) label += " · " + r.monthsToPayoff + " mo";
    svg.append("text")
      .attr("x", margin.left + x(r.balance) + 8).attr("y", yTop + 22)
      .attr("fill", c["fg-muted"]).attr("font-size", 12).text(label);
  });
}
