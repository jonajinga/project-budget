/* Paired income/expense bars per month. */

import { colors } from "./theme-colors.js";

export function render(el, data) {
  if (!el || !window.d3) return;
  var d3 = window.d3;
  el.innerHTML = "";
  if (!data || !data.length) {
    el.textContent = "No data yet.";
    return;
  }

  var c = colors();
  var rect = el.getBoundingClientRect();
  var width = Math.max(320, rect.width || 600);
  var height = 280;
  var margin = { top: 16, right: 12, bottom: 36, left: 56 };
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var svg = d3.select(el).append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("class", "chart__svg")
    .attr("role", "img")
    .attr("aria-label", "Income vs expense by month");

  var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var x0 = d3.scaleBand().domain(data.map(function (d) { return d.month; })).range([0, innerW]).padding(0.2);
  var x1 = d3.scaleBand().domain(["income", "expense"]).range([0, x0.bandwidth()]).padding(0.05);
  var maxV = d3.max(data, function (d) { return Math.max(d.income, d.expense); }) || 1;
  var y = d3.scaleLinear().domain([0, maxV]).nice().range([innerH, 0]);

  g.append("g").attr("class", "axis").attr("transform", "translate(0," + innerH + ")")
    .call(d3.axisBottom(x0).tickFormat(function (m) { return m.slice(5); }));
  g.append("g").attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(function (v) { return "$" + Math.round(v / 100); }));

  data.forEach(function (d) {
    var group = g.append("g").attr("transform", "translate(" + x0(d.month) + ",0)");
    group.append("rect")
      .attr("x", x1("income")).attr("y", y(d.income))
      .attr("width", x1.bandwidth()).attr("height", innerH - y(d.income))
      .attr("fill", c["chart-1"]);
    group.append("rect")
      .attr("x", x1("expense")).attr("y", y(d.expense))
      .attr("width", x1.bandwidth()).attr("height", innerH - y(d.expense))
      .attr("fill", c["chart-5"]);
  });

  /* Legend */
  var lg = svg.append("g").attr("transform", "translate(" + (margin.left) + "," + (height - 8) + ")");
  lg.append("rect").attr("width", 10).attr("height", 10).attr("fill", c["chart-1"]);
  lg.append("text").attr("x", 14).attr("y", 9).attr("class", "legend").text("Income");
  lg.append("rect").attr("x", 80).attr("width", 10).attr("height", 10).attr("fill", c["chart-5"]);
  lg.append("text").attr("x", 94).attr("y", 9).attr("class", "legend").text("Expense");
}
