/* Shared CSV-export helper for the reports section.
 *
 * Every report's Alpine factory used to inline ~20 lines of CSV-building
 * boilerplate. They were all subtly different — different cents/dollars
 * handling, different escape rules — which made it easy for new reports
 * to drop CSV support entirely (trends, assignment-history, debt,
 * projection all had no CSV before this helper landed). Centralizing
 * the logic here gives every report the same export with one call.
 *
 * Usage:
 *   import { exportCSV } from "/assets/js/ui/csv-export.js";
 *   exportCSV("income-vs-expense", rows, [
 *     { key: "month",  label: "Month" },
 *     { key: "income", label: "Income",  numeric: true },
 *     { key: "expense", label: "Expense", numeric: true },
 *     { key: "net",    label: "Net",    numeric: true },
 *   ]);
 *
 * For pages that don't use ES modules, the helper is also attached to
 * window.pbExportCSV so the inline Alpine factories can call it.
 *
 * Column definitions:
 *   key:     property name on each row object
 *   label:   header text in the CSV
 *   numeric: when true, values that look like cents (>= $10 integer)
 *            are converted to dollars (divide by 100, fixed to 2dp).
 *   format:  optional function(value, row) -> string for custom formatting
 *            (overrides the cents-detection heuristic).
 */
export function exportCSV(filenameBase, rows, columns) {
  if (!rows || !rows.length || !columns || !columns.length) return;
  var header = columns.map(function (c) { return JSON.stringify(c.label); }).join(",");
  var body = rows.map(function (r) {
    return columns.map(function (c) {
      var v = r[c.key];
      if (typeof c.format === "function") {
        return JSON.stringify(String(c.format(v, r)));
      }
      if (v == null) return "";
      /* Cents → dollars heuristic — only kicks in for numeric columns
         where the value is an integer >= 1000 (so balances, transfers,
         goals etc. all get the divide-by-100; small integers like
         counts and percentages are left alone). */
      if (c.numeric && Math.abs(v) >= 1000 && Number.isInteger(v)) {
        v = (v / 100).toFixed(2);
      }
      return JSON.stringify(String(v));
    }).join(",");
  }).join("\r\n");
  var blob = new Blob([header + "\r\n" + body], { type: "text/csv;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = (filenameBase || "report") + "-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}

/* Window export so Alpine factories can call window.pbExportCSV(...)
   without an import. Mirrors the pattern used by window.pbMountChart
   etc. in the bootstrap module. */
if (typeof window !== "undefined") {
  window.pbExportCSV = exportCSV;
}
