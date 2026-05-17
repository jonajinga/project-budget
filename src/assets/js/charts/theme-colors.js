/* Reads chart palette from CSS custom properties so charts always use the
   active theme. Watches <html data-theme> via MutationObserver and
   notifies subscribers when the theme flips so they can recolor without
   a full re-render. */

const VARS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6",
              /* Background tokens were missing — Chart.js tooltip
                 text/border read c["bg"] and got undefined, which
                 made tooltips render with near-invisible defaults. */
              "--bg", "--bg-elevated", "--bg-alt",
              "--fg", "--fg-muted", "--fg-subtle",
              "--border", "--border-strong",
              "--accent", "--accent-hover", "--link", "--danger", "--ok", "--warn"];

function read() {
  if (typeof document === "undefined") {
    return Object.fromEntries(VARS.map(v => [v.slice(2), "#888"]));
  }
  var s = getComputedStyle(document.documentElement);
  var out = {};
  VARS.forEach(function (v) {
    out[v.slice(2)] = (s.getPropertyValue(v) || "").trim() || "#888";
  });
  out.palette = [out["chart-1"], out["chart-2"], out["chart-3"], out["chart-4"], out["chart-5"], out["chart-6"]];
  return out;
}

let cached = null;
const subscribers = new Set();
let observer = null;

function ensureObserver() {
  if (observer || typeof document === "undefined") return;
  observer = new MutationObserver(function () {
    cached = null;
    subscribers.forEach(function (fn) { try { fn(colors()); } catch (_e) {} });
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

export function colors() {
  if (!cached) cached = read();
  ensureObserver();
  return cached;
}

export function onThemeChange(fn) {
  ensureObserver();
  subscribers.add(fn);
  return function () { subscribers.delete(fn); };
}
