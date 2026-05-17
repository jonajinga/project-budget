/* Cash-flow Sankey — D3 sankey diagram for /app/reports/sankey/.
 *
 * Three "logical columns":
 *   Income sources → Cash flow pivot → Spending categories + transfers
 * The pivot is a single node every income and outflow link routes
 * through; without it the layout devolves into a many-to-many
 * spaghetti grid for households with lots of categories.
 *
 * Renderer is theme-aware (rebuilds on theme change via mountChart),
 * shows a tooltip on hover, and dims unrelated links when one is
 * hovered so the reader can trace a single flow at a glance.
 *
 * Data shape (from sankeyFlows()):
 *   { nodes: [{ name }, ...],
 *     links: [{ source: i, target: j, value: dollars }, ...] }
 *
 * d3.sankey() expects mutable nodes + links; we deep-copy before
 * laying out so re-renders on the same data don't accumulate the
 * x0/y0/depth fields the layout writes back.
 */

import { colors } from "./theme-colors.js";

export function render(el, data) {
  if (!el || !window.d3 || !window.d3.sankey) {
    if (el) el.textContent = "Sankey library not loaded.";
    return;
  }
  if (!data || !data.nodes || !data.links || !data.links.length) {
    el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No cash flow in this range.</p>";
    return;
  }
  var d3 = window.d3;
  el.innerHTML = "";
  var c = colors();
  var rect = el.getBoundingClientRect();
  var width = Math.max(480, rect.width || 800);
  var height = Math.max(360, Math.min(720, data.nodes.length * 22 + 80));

  /* Deep-copy nodes + links so successive renders against the same
     reactive `data` object don't accumulate layout side effects. */
  var nodes = data.nodes.map(function (n) { return Object.assign({}, n); });
  var links = data.links.map(function (l) { return Object.assign({}, l); });

  var svg = d3.select(el).append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("class", "chart__svg")
    .attr("role", "img")
    .attr("aria-label", "Cash flow Sankey diagram");

  var sankey = d3.sankey()
    .nodeId(function (n, i) { return i; })
    .nodeWidth(14)
    .nodePadding(8)
    .extent([[8, 8], [width - 8, height - 8]]);

  var graph = sankey({ nodes: nodes, links: links });
  var palette = c.palette || [c["chart-1"], c["chart-2"], c["chart-3"], c["chart-4"], c["chart-5"], c["chart-6"]];

  /* Defs for one gradient per link so the link inherits both endpoint
     colors — more legible than a flat fill, especially when several
     links pile up. */
  var defs = svg.append("defs");
  graph.links.forEach(function (lnk, i) {
    var sourceColor = palette[lnk.source.index % palette.length];
    var targetColor = palette[lnk.target.index % palette.length];
    var g = defs.append("linearGradient")
      .attr("id", "pb-sankey-grad-" + i)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", lnk.source.x1).attr("x2", lnk.target.x0);
    g.append("stop").attr("offset", "0%").attr("stop-color", sourceColor);
    g.append("stop").attr("offset", "100%").attr("stop-color", targetColor);
  });

  var fmtDollars = function (v) {
    var n = Math.round(v);
    return "$" + n.toLocaleString("en-US");
  };

  /* Links — gradient-filled paths. Hover highlights this link and
     dims the rest. */
  var linkSel = svg.append("g")
    .attr("fill", "none")
    .selectAll("path")
    .data(graph.links)
    .enter()
    .append("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", function (_l, i) { return "url(#pb-sankey-grad-" + i + ")"; })
    .attr("stroke-width", function (l) { return Math.max(1, l.width); })
    .attr("stroke-opacity", 0.55)
    .style("transition", "stroke-opacity 120ms ease")
    .style("cursor", "default")
    .on("mouseenter", function () {
      var hovered = this;
      linkSel.attr("stroke-opacity", function () { return this === hovered ? 0.95 : 0.15; });
    })
    .on("mouseleave", function () { linkSel.attr("stroke-opacity", 0.55); });

  linkSel.append("title").text(function (l) {
    return l.source.name + " → " + l.target.name + ": " + fmtDollars(l.value);
  });

  /* Nodes — colored rectangles with a label to the side. */
  var nodeG = svg.append("g")
    .selectAll("g")
    .data(graph.nodes)
    .enter()
    .append("g");

  nodeG.append("rect")
    .attr("x", function (n) { return n.x0; })
    .attr("y", function (n) { return n.y0; })
    .attr("height", function (n) { return Math.max(2, n.y1 - n.y0); })
    .attr("width", function (n) { return n.x1 - n.x0; })
    .attr("fill", function (n) { return palette[n.index % palette.length]; })
    .attr("stroke", c["bg"])
    .attr("stroke-width", 0.5)
    .style("cursor", "pointer")
    .on("click", function (_evt, n) {
      /* Pivot node ("Cash flow") isn't a useful filter target. */
      if (!n || !n.name || n.name === "Cash flow") return;
      location.href = "/app/register/?q=" + encodeURIComponent(n.name);
    })
    .append("title").text(function (n) { return n.name + " · " + fmtDollars(n.value || 0) + " · click to filter the register"; });

  nodeG.append("text")
    .attr("x", function (n) { return n.x0 < width / 2 ? n.x1 + 6 : n.x0 - 6; })
    .attr("y", function (n) { return (n.y1 + n.y0) / 2; })
    .attr("dy", "0.35em")
    .attr("text-anchor", function (n) { return n.x0 < width / 2 ? "start" : "end"; })
    .attr("fill", c["fg"])
    .attr("font-family", "var(--font-ui, system-ui, sans-serif)")
    .attr("font-size", 11)
    .attr("font-weight", "600")
    .text(function (n) { return n.name; });

  /* Value labels — small, faded, second line under the node label.
     Skipped on very thin nodes where the second line wouldn't fit. */
  nodeG.append("text")
    .attr("x", function (n) { return n.x0 < width / 2 ? n.x1 + 6 : n.x0 - 6; })
    .attr("y", function (n) { return (n.y1 + n.y0) / 2 + 12; })
    .attr("dy", "0.35em")
    .attr("text-anchor", function (n) { return n.x0 < width / 2 ? "start" : "end"; })
    .attr("fill", c["fg-muted"])
    .attr("font-family", "var(--font-ui, system-ui, sans-serif)")
    .attr("font-size", 10)
    .text(function (n) { return (n.y1 - n.y0) >= 18 ? fmtDollars(n.value || 0) : ""; });
}
