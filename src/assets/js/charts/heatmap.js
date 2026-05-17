/* Category heatmap — D3 grid of categories × months, cell color
 * scaled by spending intensity.
 *
 * Input data shape (from categoryHeatmap()):
 *   { months: ["YYYY-MM", ...],
 *     categories: [{ categoryId, category, group, total, cells }, ...],
 *     cells: { categoryId: { month: cents } },
 *     max: <max cell value across the grid in cents> }
 *
 * Color ramp: d3.interpolateOranges (matches the project's accent
 * family — orange in light themes, picks up the accent variable for
 * a near-monochrome look in dark themes). The renderer also exposes
 * a Tippy-style native tooltip on each cell with the category +
 * month + amount, and the row label links to /app/calendar/ for the
 * intersection month.
 */

import { colors } from "./theme-colors.js";

export function render(el, data) {
  if (!el || !window.d3) {
    if (el) el.textContent = "D3 library not loaded.";
    return;
  }
  if (!data || !data.categories || !data.categories.length || !data.months.length) {
    el.innerHTML = "<p style=\"padding: var(--space-md); color: var(--fg-muted);\">No spending in this range.</p>";
    return;
  }
  var d3 = window.d3;
  el.innerHTML = "";
  var c = colors();

  /* Sizing — measure container width, then compute cell width to fit
     all months. Label column gets a fixed 180px. */
  var rect = el.getBoundingClientRect();
  var totalW = Math.max(560, rect.width || 800);
  var labelW = 180;
  var totalsW = 80;
  var gridW = totalW - labelW - totalsW - 16;
  var cellW = Math.max(24, Math.floor(gridW / data.months.length));
  var cellH = 28;
  var headerH = 28;
  var height = headerH + data.categories.length * cellH + 8;

  /* Sequential color scale — d3.interpolateOranges keeps the brand
     in the warm family; we cap intensity at the grid's max so quiet
     households don't end up with everything saturated. Fallback for
     empty cells: a single neutral cell color. */
  var maxCents = data.max || 1;
  var scale = d3.scaleSequential()
    .domain([0, maxCents])
    .interpolator(d3.interpolateOranges);

  var svg = d3.select(el).append("svg")
    .attr("viewBox", "0 0 " + totalW + " " + height)
    .attr("class", "chart__svg")
    .attr("role", "img")
    .attr("aria-label", "Category heatmap");

  /* Month header row — abbreviated YYYY-MM → 'MMM YY' for narrow
     columns; full label retained when there's room. */
  function shortMonth(m) {
    var parts = m.split("-");
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[Number(parts[1]) - 1] + " '" + parts[0].slice(2);
  }

  data.months.forEach(function (m, i) {
    svg.append("text")
      .attr("x", labelW + i * cellW + cellW / 2)
      .attr("y", headerH - 8)
      .attr("text-anchor", "middle")
      .attr("fill", c["fg-muted"])
      .attr("font-family", "var(--font-ui, system-ui, sans-serif)")
      .attr("font-size", cellW < 50 ? 9 : 10)
      .attr("font-weight", "600")
      .text(cellW < 36 ? m.slice(5) : shortMonth(m));
  });
  /* Totals column header. */
  svg.append("text")
    .attr("x", labelW + gridW + totalsW / 2)
    .attr("y", headerH - 8)
    .attr("text-anchor", "middle")
    .attr("fill", c["fg-muted"])
    .attr("font-family", "var(--font-ui, system-ui, sans-serif)")
    .attr("font-size", 10)
    .attr("font-weight", "700")
    .attr("text-transform", "uppercase")
    .text("Total");

  /* Rows: category label + cells + totals. */
  data.categories.forEach(function (cat, rowIdx) {
    var y = headerH + rowIdx * cellH;
    /* Category name + group annotation. */
    svg.append("text")
      .attr("x", 8)
      .attr("y", y + cellH / 2 + 4)
      .attr("fill", c["fg"])
      .attr("font-family", "var(--font-ui, system-ui, sans-serif)")
      .attr("font-size", 11)
      .attr("font-weight", "600")
      .text(cat.category.length > 22 ? cat.category.slice(0, 22) + "…" : cat.category);
    if (cat.group) {
      svg.append("text")
        .attr("x", 8)
        .attr("y", y + cellH / 2 + 14)
        .attr("fill", c["fg-muted"])
        .attr("font-family", "var(--font-ui, system-ui, sans-serif)")
        .attr("font-size", 9)
        .text(cat.group.length > 26 ? cat.group.slice(0, 26) + "…" : cat.group);
    }

    /* Cells. */
    data.months.forEach(function (m, i) {
      var v = (data.cells[cat.categoryId] || {})[m] || 0;
      var fill = v === 0 ? c["bg-alt"] : scale(v);
      var rect = svg.append("rect")
        .attr("x", labelW + i * cellW + 1)
        .attr("y", y + 1)
        .attr("width", cellW - 2)
        .attr("height", cellH - 2)
        .attr("fill", fill)
        .attr("stroke", c["bg"])
        .attr("stroke-width", 0.5)
        .style("cursor", v > 0 ? "pointer" : "default")
        .on("click", function () {
          if (v > 0) location.href = "/app/calendar/?m=" + m;
        });
      rect.append("title").text(
        cat.category + " · " + m + " · " +
        (v === 0 ? "no spending" : "$" + (v / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " · click to open")
      );
      /* Cell label — only when the cell is wide enough AND the value
         is large enough to be worth reading. */
      if (cellW >= 56 && v > 0 && v / maxCents > 0.05) {
        var displayText = v >= 100000
          ? "$" + Math.round(v / 100000) + "k"
          : "$" + Math.round(v / 100);
        svg.append("text")
          .attr("x", labelW + i * cellW + cellW / 2)
          .attr("y", y + cellH / 2 + 4)
          .attr("text-anchor", "middle")
          .attr("fill", v / maxCents > 0.5 ? "#fff" : c["fg"])
          .attr("font-family", "var(--font-ui, system-ui, sans-serif)")
          .attr("font-size", 9)
          .attr("font-weight", "600")
          .style("pointer-events", "none")
          .text(displayText);
      }
    });

    /* Total column. */
    svg.append("text")
      .attr("x", labelW + gridW + totalsW / 2)
      .attr("y", y + cellH / 2 + 4)
      .attr("text-anchor", "middle")
      .attr("fill", c["fg"])
      .attr("font-family", "var(--font-ui, system-ui, sans-serif)")
      .attr("font-size", 11)
      .attr("font-weight", "700")
      .text("$" + Math.round((cat.total || 0) / 100).toLocaleString("en-US"));
  });
}
