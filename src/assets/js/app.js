/* Project Budget app entry — boots the Alpine store and surfaces helpers. */

import { createStore } from "./store/store.js";

document.addEventListener("alpine:init", function () {
  if (!window.Alpine) return;
  var store = createStore();
  window.Alpine.store("budget", store);
  store.init();
});

/* Tippy.js wiring — initialize after Alpine has hydrated DOM so any
   dynamically-inserted [data-tip] elements get tooltips on first render.
   The MutationObserver picks up nodes added later (modals, new rows). */
document.addEventListener("alpine:initialized", function () {
  if (typeof window.tippy !== "function") return;

  function attach(scope) {
    var root = scope || document;
    var nodes = root.querySelectorAll ? root.querySelectorAll("[data-tip]:not([data-tippy-bound])") : [];
    nodes.forEach(function (el) {
      var content = el.getAttribute("data-tip");
      if (!content) return;
      el.setAttribute("data-tippy-bound", "1");
      window.tippy(el, {
        content: content,
        theme: "projectbudget",
        placement: "top",
        maxWidth: 280,
        delay: [120, 80],
        touch: ["hold", 250],
        allowHTML: false,
      });
    });
  }

  attach();

  /* Re-scan whenever Alpine mounts a new template (modals, table rows). */
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes && m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1) attach(n);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

window.ProjectBudget = window.ProjectBudget || {};
window.ProjectBudget.version = "0.1.0";
