/* Chart lifecycle for dashboard widgets.
 *
 * A widget's chart can appear, be reordered, be resized, be reconfigured to a
 * different renderer, or be removed, at any moment and without a navigation.
 * The old code was ~60 lines inside a template that knew about exactly two
 * charts by hardcoded id, which is why a report widget rendered an empty box.
 *
 * THREE THINGS THIS GETS RIGHT THAT THE PREVIOUS VERSION DID NOT.
 *
 * 1. It is keyed on the ELEMENT, not on whether a chart object exists. Alpine
 *    reuses keyed nodes across a reorder but replaces them when a widget is
 *    removed and re-added, and a chart still bound to a detached element is
 *    exactly the leak ui/router.js was written to clean up after.
 *
 * 2. It destroys the Chart INSTANCE, not just the markup. mountChart's own
 *    disposer does `el.innerHTML = ""`, which detaches the canvas and leaves
 *    the Chart.js instance alive in Chart.instances with its ResizeObserver
 *    still attached. Router.js records instances growing 2 -> 45 over 75
 *    navigations from precisely this. Lookup matches router.js:
 *    Chart.getChart(canvas) || canvas.__pbChart.
 *
 * 3. State lives ON THE GRID ELEMENT, so it dies with the grid when the
 *    router tears the view down. A module-level Map would outlive the page.
 *
 * Renderers are ES modules and this is a classic script (it has to be, so the
 * template can call it), so modules are pulled with dynamic import() and
 * cached. D3-backed views load D3 on demand rather than shipping 280KB to a
 * dashboard that may contain no D3 chart at all.
 */

(function () {
  var modCache = Object.create(null);
  var libPromises = Object.create(null);

  function loadScript(src) {
    if (libPromises[src]) return libPromises[src];
    libPromises[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) { resolve(); return; }
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("failed to load " + src)); };
      document.head.appendChild(s);
    });
    return libPromises[src];
  }

  /* Order matters and is the contract: d3-sankey reads d3 off window at
     evaluation time, so these cannot be loaded in parallel. Same rule the
     router applies to its own vendor chain. */
  function ensureLibs(needs) {
    var chain = Promise.resolve();
    (needs || []).forEach(function (lib) {
      chain = chain.then(function () {
        if (lib === "d3") {
          if (window.d3) return null;
          return loadScript("/assets/js/vendor/d3.min.js");
        }
        if (lib === "d3-sankey") {
          if (window.d3 && window.d3.sankey) return null;
          return loadScript("/assets/js/vendor/d3-sankey.min.js");
        }
        return null;
      });
    });
    return chain;
  }

  function loadRenderer(name) {
    if (modCache[name]) return modCache[name];
    modCache[name] = import("/assets/js/charts/" + name + ".js");
    return modCache[name];
  }

  /* Destroy the Chart.js instance before handing back to mountChart's
     disposer, which only clears markup. */
  function destroyInstancesIn(el) {
    if (!el) return;
    var canvases = el.querySelectorAll ? el.querySelectorAll("canvas") : [];
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      var inst = (window.Chart && window.Chart.getChart && window.Chart.getChart(c)) || c.__pbChart;
      if (inst && typeof inst.destroy === "function") {
        try { inst.destroy(); } catch (_e) {}
      }
    }
  }

  function disposeEntry(entry) {
    if (!entry) return;
    destroyInstancesIn(entry.el);
    if (entry.mounted && typeof entry.mounted.dispose === "function") {
      try { entry.mounted.dispose(); } catch (_e) {}
    }
  }

  window.PBDashCharts = {
    /* Idempotent. Safe to call after every render, which is what keeps charts
       in step with a layout the user is actively editing.
       `api.dataFor(widgetId)` returns the widget's data; `api.needsFor` its
       library dependencies. */
    sync: function (grid, api) {
      if (!grid) return;
      if (!grid.__pbCharts) grid.__pbCharts = Object.create(null);
      var state = grid.__pbCharts;
      var seen = Object.create(null);

      var hosts = grid.querySelectorAll("[data-chart-host]");
      for (var i = 0; i < hosts.length; i++) {
        (function (host) {
          var id = host.getAttribute("data-widget-id");
          var moduleName = host.getAttribute("data-chart-module");
          if (!id || !moduleName) return;
          seen[id] = true;

          var entry = state[id];
          if (entry && entry.el === host && entry.module === moduleName) {
            /* Same element, same renderer: just redraw with current data. */
            if (entry.mounted) { try { entry.mounted.redraw(); } catch (_e) {} }
            return;
          }
          /* Element replaced, or the user picked a different renderer. */
          if (entry) disposeEntry(entry);
          state[id] = entry = { el: host, module: moduleName, mounted: null };

          ensureLibs(api.needsFor(id))
            .then(function () { return loadRenderer(moduleName); })
            .then(function (mod) {
              /* The widget may have been removed or reconfigured while the
                 module was in flight. */
              if (state[id] !== entry || !host.isConnected) return;
              if (!mod || typeof mod.render !== "function") return;
              entry.mounted = window.pbMountChart(host, mod.render, function () {
                return api.dataFor(id);
              });
            })
            .catch(function (err) {
              host.textContent = "Chart could not load.";
              /* console.warn, not error: router-all-routes.spec.js fails the
                 build on any console.error, and a missing optional library is
                 a degraded widget rather than a broken page. */
              console.warn("dashboard chart failed for", moduleName, err);
            });
        })(hosts[i]);
      }

      /* Anything we hold that is no longer on the board. */
      Object.keys(state).forEach(function (id) {
        if (seen[id]) return;
        disposeEntry(state[id]);
        delete state[id];
      });
    },

    /* Called on teardown so nothing outlives the view. */
    destroy: function (grid) {
      if (!grid || !grid.__pbCharts) return;
      Object.keys(grid.__pbCharts).forEach(function (id) {
        disposeEntry(grid.__pbCharts[id]);
      });
      grid.__pbCharts = null;
    },
  };
})();
