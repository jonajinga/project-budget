/* Per-category history — assigned vs spent paired bars per month, one
   small chart per category. Mirrors the monthly-trends small-multiples
   layout for visual consistency. */

import { colors } from "./theme-colors.js";

export function render(el, series) {
  if (!el || !window.d3) return;
  var d3 = window.d3;
  el.innerHTML = "";
  if (!series || !series.length) { el.textContent = "No data."; return; }

  var c = colors();
  var cellH = 110;

  var grid = document.createElement("div");
  grid.className = "small-multiples";
  el.appendChild(grid);

  series.forEach(function (s, idx) {
    var card = document.createElement("div");
    card.className = "small-multiple";
    grid.appendChild(card);

    var head = document.createElement("p");
    head.className = "small-multiple__title";
    head.textContent = s.category;
    card.appendChild(head);

    var sub = document.createElement("p");
    sub.className = "small-multiple__sub";
    var totalAssigned = s.points.reduce(function (a, p) { return a + p.assigned; }, 0);
    var totalSpent = s.points.reduce(function (a, p) { return a + p.spent; }, 0);
    sub.textContent = "Assigned $" + (totalAssigned / 100).toFixed(0) + " · Spent $" + (totalSpent / 100).toFixed(0);
    card.appendChild(sub);

    var rect = card.getBoundingClientRect();
    var w = Math.max(240, rect.width || 240);
    var svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.setAttribute("viewBox", "0 0 " + w + " " + cellH);
    svgEl.setAttribute("class", "chart__svg");
    card.appendChild(svgEl);

    var x0 = d3.scaleBand().domain(s.points.map(function (p) { return p.month; })).range([4, w - 4]).padding(0.15);
    var x1 = d3.scaleBand().domain(["assigned", "spent"]).range([0, x0.bandwidth()]).padding(0.04);
    var max = d3.max(s.points, function (p) { return Math.max(p.assigned, p.spent); }) || 1;
    var y = d3.scaleLinear().domain([0, max]).range([cellH - 12, 8]);

    var svg = d3.select(svgEl);
    s.points.forEach(function (p) {
      var g = svg.append("g").attr("transform", "translate(" + x0(p.month) + ",0)");
      g.append("rect").attr("x", x1("assigned")).attr("y", y(p.assigned))
        .attr("width", x1.bandwidth()).attr("height", (cellH - 12) - y(p.assigned))
        .attr("fill", c["chart-1"]);
      g.append("rect").attr("x", x1("spent")).attr("y", y(p.spent))
        .attr("width", x1.bandwidth()).attr("height", (cellH - 12) - y(p.spent))
        .attr("fill", c["chart-5"]);
    });
  });
}
