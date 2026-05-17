/* Save-view event handler — global listener that turns any
 * `pb:save-view` event into a saved-views entry without the user
 * leaving the page.
 *
 * Usage from a filterable page (register, calendar, reports):
 *   <button @click="$dispatch('pb:save-view', { kind: 'register', name: '' })"
 *           data-tip="Save the current filters as a recall-able view">Save view</button>
 *
 * The dispatcher does NOT need to read location.href — this handler
 * does, so every page captures the live URL including all current
 * query params. The Alpine factory just needs to:
 *   1. Have already pushed its filter state to history.replaceState
 *   2. Dispatch the event with at least a `kind` so the templates
 *      page can label the entry.
 *
 * Storage key matches /app/templates/'s `projectbudget:savedViews`. */

(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var STORAGE_KEY = "projectbudget:savedViews";

  function readAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_e) { return []; }
  }
  function writeAll(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); return true; }
    catch (_e) { return false; }
  }

  function toast(msg, kind) {
    try {
      if (window.Alpine && window.Alpine.store) {
        var s = window.Alpine.store("budget");
        if (s && s.pushToast) { s.pushToast(msg, kind || "ok"); return; }
      }
    } catch (_e) {}
  }

  async function handleSaveView(evt) {
    var detail = (evt && evt.detail) || {};
    var url = new URL(window.location.href);
    var params = url.search.replace(/^\?/, "");
    /* Suggest a name from the page title + a short summary of the
       current params so the user has something sensible to accept. */
    var suggested = detail.name || (document.title.split(" — ")[0] || "Saved view");
    var name = null;
    if (window.PBDialog && window.PBDialog.prompt) {
      name = await window.PBDialog.prompt({
        title: "Save this view",
        label: "Name",
        message: params
          ? ("Captures the current URL filters: " + params)
          : "Captures this page (no active filters).",
        defaultValue: suggested,
        okLabel: "Save view",
      });
    } else {
      name = window.prompt("Name this saved view:", suggested);
    }
    if (!name || !String(name).trim()) return;
    var list = readAll();
    list.push({
      id: "sv-" + Math.random().toString(36).slice(2, 9),
      name: String(name).trim(),
      kind: detail.kind || "register",
      params: params,
      notes: detail.notes || "",
      createdAt: new Date().toISOString(),
    });
    if (writeAll(list)) {
      toast("View saved. Recall from /app/templates/.", "ok");
    } else {
      toast("Couldn't save view — localStorage full.", "danger");
    }
  }

  document.addEventListener("pb:save-view", handleSaveView);

  /* Expose a helper for code paths that can't dispatch via Alpine
     (e.g. command-palette actions). */
  window.pbSaveCurrentView = function (opts) {
    document.dispatchEvent(new CustomEvent("pb:save-view", { detail: opts || {} }));
  };
}());
