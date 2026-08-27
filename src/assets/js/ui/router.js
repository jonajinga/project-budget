/* Client-side router for /app/*.
 *
 * WHY THIS EXISTS
 *
 * Every app route was its own HTML document. Tapping a nav link tore down
 * Alpine, re-read localStorage, LZ-decompressed ~123 KB back to ~512 KB of
 * JSON, re-parsed it and re-rendered — then re-requested 56-59 ES modules and
 * a 323 KB stylesheet, because there is no bundler. Measured on a throttled
 * Pixel 7 with the sample profile: 4.5s to interactive on /app/budget/, 3.4s
 * on /app/, 1.4s on /app/register/. Per tap.
 *
 * Almost none of that is download. It is the store being rebuilt from scratch
 * every single time. So the fix is not to make the pages lighter, it is to
 * stop throwing the store away: one document, one store, views swapped in
 * place.
 *
 * HOW IT WORKS
 *
 * Eleventy still authors each view as its own .njk template — that part is
 * good and stays. It additionally emits each one, WITHOUT the shell, as a
 * fragment at /app/_views/<slug>.html. This router fetches the fragment,
 * swaps it into the mount point, and hands the new subtree to Alpine.
 *
 * Deliberately NOT a framework. No virtual DOM, no component model, no
 * hydration protocol — the app is Alpine and Nunjucks and should stay that
 * way. This is ~200 lines of fetch, innerHTML and history.
 */

const MOUNT_ID = "app-view";
const FRAGMENT_BASE = "/app/_views/";

/* Routes whose Alpine factory lives in its own file rather than inline in the
 * template. Everything else carries its factory inside the fragment, which
 * executes when the fragment is injected (see runScripts below).
 *
 * Loaded lazily and once: a user who never opens the calendar never pays for
 * calendar-view.js. This replaces the {% if page.url == %} script table that
 * layouts/app.njk used to carry. */
const VIEW_SCRIPTS = {
  "/app/register/": "/assets/js/views/register-view.js",
  "/app/budget/": "/assets/js/views/budget-view.js",
  "/app/calendar/": "/assets/js/views/calendar-view.js",
};

/* Heavy vendor libraries, loaded on first arrival at a route that needs them.
 * Same reasoning as VIEW_SCRIPTS: D3 is ~273 KB and three reports use it. */
const VENDOR_FOR_ROUTE = {
  "/app/reports/spending/": ["/assets/js/vendor/d3.min.js"],
  "/app/reports/heatmap/": ["/assets/js/vendor/d3.min.js"],
  "/app/reports/sankey/": ["/assets/js/vendor/d3.min.js", "/assets/js/vendor/d3-sankey.min.js"],
};

const CHART_ROUTES = /^\/app\/(reports\/|$)/;
const CHART_SCRIPTS = [
  "/assets/js/vendor/chart.umd.min.js",
  "/assets/js/vendor/chartjs-plugin-datalabels.min.js",
];

/* layouts/app.njk carries FOUR page.url-keyed script blocks, not three. The
   fourth is this one, and dropping it made Export PDF silently do nothing on
   all 13 reports whenever the user arrived by clicking rather than by URL --
   every report guards with `if (!window.pbExportReportPDF) return;`, so there
   was no error, no dialog, no download. */
const REPORT_ROUTES = /^\/app\/reports\//;
const REPORT_SCRIPTS = ["/assets/js/ui/pdf-export.js"];

const loaded = new Set();
const fragmentCache = new Map();

function normalise(path) {
  if (!path) return "/app/";
  return path.endsWith("/") ? path : path + "/";
}

/* NOT "index" for the root. tests/e2e/fixtures.js discovers routes by walking
   the build for index.html files, so a fragment named _views/index.html made
   /app/_views/ look like a real route -- to the route sweep, and to the a11y
   and smoke gates that share it. */
function slugFor(path) {
  const rest = normalise(path).slice("/app/".length).replace(/\/$/, "");
  return rest === "" ? "_root" : rest.replace(/\//g, "--");
}

/* Classic <script src> rather than import(): the view files assign their
 * factory to window (x-data="budgetView()" needs a global), and they are not
 * ES modules. Resolves on load so the caller can await it. */
function loadScript(src) {
  /* Keyed on pathname so a server-rendered "/x.js?v=hash" and a router-
     injected "/x.js" are recognised as the same file. */
  if (loaded.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.onload = () => { loaded.add(src); resolve(); };
    el.onerror = () => reject(new Error("failed to load " + src));
    document.head.appendChild(el);
  });
}

async function loadDepsFor(path) {
  const deps = [];
  if (VIEW_SCRIPTS[path]) deps.push(VIEW_SCRIPTS[path]);
  if (VENDOR_FOR_ROUTE[path]) deps.push(...VENDOR_FOR_ROUTE[path]);
  if (CHART_ROUTES.test(path)) deps.push(...CHART_SCRIPTS);
  if (REPORT_ROUTES.test(path)) deps.push(...REPORT_SCRIPTS);
  /* Sequential, not Promise.all: d3-sankey needs d3 already on window, and
     the datalabels plugin needs Chart. Order is the contract. */
  for (const src of deps) await loadScript(src);
}

async function fetchFragment(path) {
  if (fragmentCache.has(path)) return fragmentCache.get(path);
  const res = await fetch(FRAGMENT_BASE + slugFor(path) + ".html", { credentials: "same-origin" });
  if (!res.ok) throw new Error("fragment " + res.status + " for " + path);
  const html = await res.text();
  fragmentCache.set(path, html);
  return html;
}

/* innerHTML does not execute <script>. Each app view carries its Alpine
 * factory in an inline script at the bottom of its template, so those have to
 * be re-created by hand or every converted route loses its x-data. */
function runScripts(container) {
  const scripts = Array.from(container.querySelectorAll("script"));
  for (const old of scripts) {
    const fresh = document.createElement("script");
    for (const { name, value } of Array.from(old.attributes)) fresh.setAttribute(name, value);
    fresh.textContent = old.textContent;
    old.replaceWith(fresh);
  }
}

/* The other half of that fourth block: an inline script that records report
   visits so the hub can show a Recents strip. Under the router it never ran,
   so projectbudget:report:recent stayed null and the strip stayed empty. */
function logReportVisit(path) {
  if (path === "/app/reports/" || !/^\/app\/reports\/[^/]+\/$/.test(path)) return;
  try {
    const slug = path.split("/").filter(Boolean).pop();
    const key = "projectbudget:report:recent";
    const raw = localStorage.getItem(key);
    let list = raw ? JSON.parse(raw) : [];
    list = (list || []).filter((e) => e && e.slug && e.slug !== slug);
    list.unshift({ slug, visited: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 10)));
  } catch (_e) { /* private browsing -- skip, as the inline version did */ }
}

/* Chart.js parks its instance on the canvas and keeps a ResizeObserver on it.
   Swapping the fragment detaches the canvas but the instance survives in
   Chart.instances, holding its data and its observer. Measured: instances
   grew 2 -> 45 over 75 navigations with two canvases actually in the DOM.
   Nothing did this before because the document itself used to be discarded. */
function destroyChartsIn(root) {
  const Chart = window.Chart;
  for (const canvas of Array.from(root.querySelectorAll("canvas"))) {
    try {
      const inst = (Chart && Chart.getChart && Chart.getChart(canvas)) || canvas.__pbChart;
      if (inst && typeof inst.destroy === "function") inst.destroy();
      canvas.__pbChart = null;
    } catch (_e) { /* a half-built chart is not worth failing a navigation */ }
  }
}

function setTitleFrom(container) {
  const h1 = container.querySelector("h1, .app-page__title");
  document.title = (h1 ? h1.textContent.trim() + " · " : "") + "Project Budget";
}

let navToken = 0;

export async function navigate(rawPath, { push = true, restoreScroll = null } = {}) {
  const path = normalise(rawPath);
  const mount = document.getElementById(MOUNT_ID);
  if (!mount) return false;

  /* Guards an out-of-order arrival: tap Budget then Register quickly and the
     slower fetch must not win and paint the wrong screen. */
  const token = ++navToken;

  const store = window.Alpine && window.Alpine.store && window.Alpine.store("budget");
  if (store) store.routeLoading = true;

  let html;
  try {
    [html] = await Promise.all([fetchFragment(path), loadDepsFor(path)]);
  } catch (err) {
    /* Could not get the fragment or its scripts: an unconverted route, a
       stale cache, a deploy skew, a genuine 404. A full page load is the
       right answer -- every route stays reachable. */
    console.warn("router: no fragment for", path, "-- falling back to a full load", err);
    window.location.assign(path);
    return false;
  }

  try {
    if (token !== navToken) return false;

    /* Alpine does the teardown and the setup itself.
     *
     * It runs a MutationObserver over the document: removed nodes get their
     * directive cleanups, added nodes get initialised. So assigning innerHTML
     * is the whole operation -- calling destroyTree/initTree around it makes
     * Alpine do each half TWICE, and x-for's cleanup is not idempotent:
     *
     *   n(() => { Object.values(e._x_lookup).forEach(...); delete e._x_lookup })
     *
     * The second pass hits Object.values(undefined) and throws "Cannot
     * convert undefined or null to object" from inside alpine.min.js -- on
     * every route with a list in it, which is nearly all of them.
     *
     * The observer is asynchronous, so the swap settles a microtask later
     * rather than synchronously. Nothing here depends on it being synchronous.
     */
    destroyChartsIn(mount);
    mount.innerHTML = html;
    runScripts(mount);

    /* KNOWN COST, measured, not yet solved.
     *
     * On a 4x-throttled Pixel 7 with the 1,399-transaction sample, the FIRST
     * arrival at a heavy view costs more through the router than a full page
     * load did: /app/register/ is ~3.1s here against ~2.0s cold (3 paired
     * runs, medians 3075ms vs 1994ms). Phase timing puts 1,476ms of that in
     * Alpine.initTree alone; fetch is 57ms, innerHTML 8ms, destroyTree 1ms.
     *
     * The likely reason is that a cold boot runs Alpine while the store is
     * still loading, so x-for first renders an empty list and fills in later
     * in small reactive batches. initTree runs against an already-populated
     * store, so the whole list materialises in one synchronous pass.
     *
     * Every LATER visit is 44-107ms against the 1.4-4.5s a full load used to
     * cost, so the trade is strongly positive across a session -- but the
     * first-visit regression is real and should be fixed before this is
     * called done. */
    setTitleFrom(mount);
    if (push) history.pushState({ path }, "", path);

    /* Browsers restore scroll for back/forward on real navigations; with
       pushState that is ours to do. */
    window.scrollTo(0, restoreScroll == null ? 0 : restoreScroll);

    logReportVisit(path);
    /* The sidebar bakes currentUrl at build time and is never re-rendered, so
       aria-current and the active highlight stayed on the first route for the
       whole session. partials/app-shell.njk listens for this. */
    window.dispatchEvent(new CustomEvent("pb:navigated", { detail: { path } }));
    /* Deliberately NOT dispatching close-sidebar here. The sidebar links
       already dispatch it themselves (partials/app-shell.njk), and doing it
       again from the router closed the DESKTOP sidebar too -- where it is a
       persistent column, not a drawer -- so the nav vanished after one click. */
    return true;
  } catch (err) {
    /* The fragment arrived and is on screen; something in the view's own init
       threw. Reloading would NOT help -- the same code would run again -- and
       it would throw away the store, which is the one thing this router
       exists to protect. Report it and leave the user where they are. */
    console.error("router: view init failed for", path, err);
    if (push) history.pushState({ path }, "", path);
    return false;
  } finally {
    if (token === navToken && store) store.routeLoading = false;
  }
}

function isInternalAppLink(a) {
  if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
  if (a.dataset.noRouter !== undefined) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (!url.pathname.startsWith("/app/")) return false;
  /* A hash on the current page is an in-page jump, not a navigation. */
  if (url.pathname === location.pathname && url.hash) return false;
  return true;
}

function onClick(e) {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest("a[href]");
  if (!isInternalAppLink(a)) return;
  e.preventDefault();
  navigate(new URL(a.href, location.href).pathname);
}

export function startRouter() {
  if (!document.getElementById(MOUNT_ID)) return;

  /* Seed from the scripts the server already rendered. The `loaded` set only
     knew about scripts the router itself injected, so the first hop off /app/
     re-fetched and re-EXECUTED Chart.js and its datalabels plugin -- ~200 KB
     re-parsed, window.Chart replaced, and the dashboard's live chart
     instances orphaned against the old constructor. */
  for (const el of Array.from(document.querySelectorAll("script[src]"))) {
    try { loaded.add(new URL(el.src, location.href).pathname); } catch (_e) {}
  }

  document.addEventListener("click", onClick);
  window.addEventListener("popstate", (e) => {
    const path = (e.state && e.state.path) || location.pathname;
    navigate(path, { push: false });
  });
  history.replaceState({ path: normalise(location.pathname) }, "", location.href);
}

/* Exposed for the router's own tests and for anything that needs to navigate
   without a click (the budget view jumps to a filtered register). */
window.pbRouter = { navigate, startRouter };
