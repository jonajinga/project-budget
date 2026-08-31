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

/* Release the outgoing view's Alpine state before dropping it.
 *
 * Alpine bindings register effects that SUBSCRIBE to the store. The store
 * therefore holds a reference to every effect, each effect holds its
 * component scope, and each scope holds its DOM. Detaching the nodes is not
 * enough -- the subscription is what keeps them alive, so a view is retained
 * in full until its effects are released. Measured on this app: 2 KB per
 * navigation between static routes, 23 KB between light Alpine ones, and
 * 923 KB between /app/register/ and /app/budget/. It scales with the number
 * of bindings, which is exactly what an un-released effect list looks like.
 *
 * Alpine.destroyTree() is what releases them, and calling it is why this is
 * fiddly. Two hazards, both learned the hard way:
 *
 *  1. NEVER destroyTree(mount). #app-view sits inside the shell's x-data and
 *     carries an inherited _x_dataStack; wiping it leaves the next initTree
 *     unable to rebuild the scope chain, and Alpine throws "Cannot convert
 *     undefined or null to object" on every route. Destroy the CHILDREN.
 *
 *  2. Alpine's own MutationObserver runs cleanups again when innerHTML
 *     removes these nodes, and x-for's cleanup is not idempotent:
 *
 *         n(() => { Object.values(e._x_lookup).forEach(...);
 *                   delete e._x_prevKeys; delete e._x_lookup })
 *
 *     The second pass hits Object.values(undefined) and throws -- on every
 *     route with a list in it, which is nearly all of them. Putting an empty
 *     lookup back makes that second pass a no-op instead of a crash.
 *
 * Restoring the state Alpine just deleted is not elegant, but the alternative
 * is either the crash or the leak, and patching a vendored library is worse.
 */
function teardownAlpineIn(mount) {
  const A = window.Alpine;
  if (!A || typeof A.destroyTree !== "function") return;

  /* Snapshot every descendant BEFORE teardown, and record the x-for hosts
     while their state still exists. The snapshot matters: x-for's cleanup
     calls .remove() on its rows, so they leave the tree DURING the walk and
     destroyTree never reaches them. Measured: detached <tr> elements
     accumulated exactly 64 per visit to the register, each still carrying
     _x_effects, with their top detached ancestor still holding an
     _x_dataStack. An effect that is still subscribed keeps its scope, and
     the scope keeps the DOM -- which is the whole leak. */
  const all = Array.from(mount.querySelectorAll("*"));
  const forHosts = all.filter((el) => el._x_lookup !== undefined);

  for (const child of Array.from(mount.children)) {
    try { A.destroyTree(child); } catch (_e) { /* one bad subtree must not abort the rest */ }
  }

  /* Sweep whatever the walk could not reach. Alpine.release is its public
     way to unsubscribe an effect; without this the rows above stay wired to
     the store for the life of the session. Deliberately excludes `mount`
     itself -- it belongs to the shell, not the view. */
  if (typeof A.release === "function") {
    for (const el of all) {
      if (!el._x_effects) continue;
      for (const effect of Array.from(el._x_effects)) {
        try { A.release(effect); } catch (_e) {}
      }
      delete el._x_effects;
      delete el._x_runEffects;
    }
  }

  /* Tried clearing _x_dataStack/_x_refs/_x_bindings here too, on the theory
     that the element <-> scope cycle was the retainer. Measured no change
     (617 KB/nav against 599), so it is not here: deleting a library's
     internals for no measured gain is worse than leaving them alone. The
     remaining retainer is still unidentified -- see the commit message. */

  for (const el of forHosts) {
    if (el._x_lookup === undefined) el._x_lookup = {};
    if (el._x_prevKeys === undefined) el._x_prevKeys = [];
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
    teardownAlpineIn(mount);
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
    if (push) {
      /* A new navigation from anywhere but the tip discards the forward
         branch -- same rule the browser applies. */
      historyIndex += 1;
      historyDepth = historyIndex;
      history.pushState({ path, idx: historyIndex }, "", path);
      announceHistory();
    }

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
    if (push) {
      /* Still a real history entry -- the fragment is on screen. Skipping the
         bookkeeping here would leave the index one behind for the rest of the
         session and quietly mis-report canGoBack. */
      historyIndex += 1;
      historyDepth = historyIndex;
      history.pushState({ path, idx: historyIndex }, "", path);
      announceHistory();
    }
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
    /* Trust the state we stamped rather than trying to infer direction: the
       user can jump several entries at once from the browser's own back
       menu, and counting steps would drift. */
    if (e.state && typeof e.state.idx === "number") historyIndex = e.state.idx;
    announceHistory();
    navigate(path, { push: false });
  });
  history.replaceState({ path: normalise(location.pathname), idx: 0 }, "", location.href);
  historyIndex = 0;
  historyDepth = 0;
  announceHistory();
}

/* ---- Where we are in the session's history ----
 *
 * The browser deliberately does not tell a page whether back or forward would
 * go anywhere -- history.length counts entries from before this page existed
 * and never shrinks, so it cannot answer it. Buttons that are always enabled
 * and sometimes do nothing are worse than no buttons, so the router keeps its
 * own position by stamping an index into each history state.
 *
 * `depth` is the highest index reached on the current branch. Navigating from
 * a back-position truncates the forward branch, exactly as the browser does.
 */
let historyIndex = 0;
let historyDepth = 0;

function announceHistory() {
  window.dispatchEvent(
    new CustomEvent("pb:history", {
      detail: { canBack: historyIndex > 0, canForward: historyIndex < historyDepth },
    })
  );
}

export function canGoBack() { return historyIndex > 0; }
export function canGoForward() { return historyIndex < historyDepth; }
export function goBack() { if (canGoBack()) history.back(); }
export function goForward() { if (canGoForward()) history.forward(); }

/* Exposed for the router's own tests and for anything that needs to navigate
   without a click (the budget view jumps to a filtered register). */
window.pbRouter = { navigate, startRouter, canGoBack, canGoForward, goBack, goForward };
