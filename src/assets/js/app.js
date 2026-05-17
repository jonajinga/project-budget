/* Project Budget app entry — boots the Alpine store and surfaces helpers. */

import { createStore } from "./store/store.js";

document.addEventListener("alpine:init", function () {
  if (!window.Alpine) return;
  var store = createStore();
  window.Alpine.store("budget", store);
  store.init();
});

/* ---- Tippy.js wiring -------------------------------------------------- */
/* Initialize after Alpine has hydrated DOM. The MutationObserver picks up
   nodes added later (modals, new rows). A localStorage flag
   (projectbudget:tooltips-off) disables tooltips entirely. */

function tooltipsEnabled() {
  try { return localStorage.getItem("projectbudget:tooltips-off") !== "1"; }
  catch (_e) { return true; }
}

/* Touch-only devices (phones, tablets without a mouse) get tippy
   skipped — the long-press affordance conflicts with text selection
   and the native context menu, and the data-tip content is already
   echoed in aria-label for AT users. CSS media query `(any-hover:
   none)` is the canonical way to detect a primary-pointer-less
   device. Saves the runtime cost on those devices entirely. */
function isTouchOnly() {
  try {
    return window.matchMedia && window.matchMedia("(any-hover: none)").matches;
  } catch (_e) { return false; }
}

/* Touch-only fallback — mirror data-tip into the native `title`
   attribute so the OS long-press tooltip surfaces the same content
   tippy would show. Desktop is unaffected (tippy intercepts the
   hover before the native title triggers). Runs in addition to the
   tippy init below; on touch-only devices it runs alone. */
function mirrorDataTipToTitle(scope) {
  var root = scope || document;
  if (!root.querySelectorAll) return;
  root.querySelectorAll("[data-tip]:not([title])").forEach(function (el) {
    var v = el.getAttribute("data-tip");
    if (v) el.setAttribute("title", v);
  });
}

document.addEventListener("alpine:initialized", function () {
  /* Touch path — no tippy, native title tooltip + aria-label cover it. */
  if (isTouchOnly()) {
    mirrorDataTipToTitle();
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === "childList") {
          m.addedNodes.forEach(function (n) { if (n.nodeType === 1) mirrorDataTipToTitle(n); });
        } else if (m.type === "attributes" && m.attributeName === "data-tip") {
          var v = m.target.getAttribute("data-tip");
          if (v && !m.target.hasAttribute("title")) m.target.setAttribute("title", v);
        }
      });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tip"] });
    return;
  }
  if (typeof window.tippy !== "function") return;

  function attachOne(el) {
    if (!el || el.nodeType !== 1 || el.getAttribute("data-tippy-bound") === "1") return;
    var content = el.getAttribute("data-tip");
    if (!content) return;
    el.setAttribute("data-tippy-bound", "1");
    var inst = window.tippy(el, {
      content: content,
      theme: "projectbudget",
      placement: "top",
      maxWidth: 280,
      delay: [120, 80],
      touch: ["hold", 250],
      allowHTML: false,
      /* Re-read data-tip at show time so reactive content (Alpine
         :data-tip bindings that update after binding) stays fresh. */
      onShow: function (instance) {
        var fresh = el.getAttribute("data-tip");
        if (!fresh) return false;
        if (fresh !== instance.props.content) instance.setContent(fresh);
      },
    });
    return inst;
  }

  function attach(scope) {
    if (!tooltipsEnabled()) return;
    var root = scope || document;
    if (root.matches && root.matches("[data-tip]")) attachOne(root);
    var nodes = root.querySelectorAll ? root.querySelectorAll("[data-tip]:not([data-tippy-bound])") : [];
    nodes.forEach(attachOne);
  }

  attach();

  /* Alpine sets :data-tip values AFTER the DOM node is inserted, so
     childList-only observation misses many bindings (the attribute is
     empty when we look). Also watch for data-tip attribute mutations
     so deferred binds + reactive updates pick up. */
  /* Walk a removed subtree and destroy any tippy instances we'd
     otherwise leak. Without this, when a chart canvas re-mounts
     (or any Alpine x-for swaps its rendered nodes), the previously
     attached buttons disappear but their tippy popups stay in the
     DOM — looks like "tooltips frozen on screen" until you click
     away or navigate. */
  function detachSubtree(root) {
    if (!root || root.nodeType !== 1) return;
    var nodes = root.matches && root.matches("[data-tippy-bound]") ? [root] : [];
    if (root.querySelectorAll) {
      Array.prototype.push.apply(nodes, Array.prototype.slice.call(root.querySelectorAll("[data-tippy-bound]")));
    }
    nodes.forEach(function (el) {
      if (el._tippy) {
        try { el._tippy.hide(); el._tippy.destroy(); } catch (_e) {}
      }
      el.removeAttribute("data-tippy-bound");
    });
  }
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.type === "childList") {
        m.addedNodes && m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1) attach(n);
        });
        m.removedNodes && m.removedNodes.forEach(function (n) {
          if (n.nodeType === 1) detachSubtree(n);
        });
      } else if (m.type === "attributes" && m.attributeName === "data-tip") {
        attachOne(m.target);
      }
    });
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-tip"],
  });

  /* The settings page toggles this flag. We listen for storage events so
     the toggle takes effect across tabs without a reload. */
  window.addEventListener("storage", function (e) {
    if (e.key !== "projectbudget:tooltips-off") return;
    if (tooltipsEnabled()) {
      attach();
    } else {
      document.querySelectorAll("[data-tippy-bound]").forEach(function (el) {
        if (el._tippy) el._tippy.destroy();
        el.removeAttribute("data-tippy-bound");
      });
    }
  });

  /* Settings page emits a custom event for same-tab updates. */
  document.addEventListener("projectbudget:tooltips-changed", function () {
    if (tooltipsEnabled()) {
      attach();
    } else {
      document.querySelectorAll("[data-tippy-bound]").forEach(function (el) {
        if (el._tippy) el._tippy.destroy();
        el.removeAttribute("data-tippy-bound");
      });
    }
  });
});

/* ---- Resizable app sidebar ------------------------------------------- */
/* Drag handle between sidebar and main writes to --app-sidebar-width on
   the layout root; the width is persisted to localStorage and restored
   on next boot. Double-click resets to default. Keyboard arrows when
   focused give a 16px nudge. */

(function () {
  var KEY = "projectbudget:sidebar-width";
  var MIN = 180, MAX = 480, DEFAULT = 260;
  var widthCache = DEFAULT;

  function applyWidth(px) {
    var clamped = Math.max(MIN, Math.min(MAX, Math.round(px)));
    widthCache = clamped;
    document.querySelectorAll(".layout-app").forEach(function (root) {
      root.style.setProperty("--app-sidebar-width", clamped + "px");
    });
  }

  function loadSaved() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var v = parseInt(raw, 10);
      if (isFinite(v)) applyWidth(v);
    } catch (_e) {}
  }

  function save() { try { localStorage.setItem(KEY, String(widthCache)); } catch (_e) {} }

  function wire() {
    var handle = document.querySelector(".app-sidebar-handle");
    if (!handle) return;
    var dragging = false;
    var startX = 0;
    var startWidth = widthCache;

    function onMove(e) {
      if (!dragging) return;
      var x = (e.touches ? e.touches[0].clientX : e.clientX);
      applyWidth(startWidth + (x - startX));
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("is-dragging");
      document.body.style.removeProperty("cursor");
      save();
    }

    handle.addEventListener("mousedown", function (e) {
      dragging = true;
      handle.classList.add("is-dragging");
      startX = e.clientX;
      startWidth = widthCache;
      document.body.style.cursor = "col-resize";
      e.preventDefault();
    });
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);

    handle.addEventListener("touchstart", function (e) {
      dragging = true;
      startX = e.touches[0].clientX;
      startWidth = widthCache;
      handle.classList.add("is-dragging");
    }, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onUp);

    handle.addEventListener("dblclick", function () { applyWidth(DEFAULT); save(); });

    handle.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft")  { applyWidth(widthCache - 16); save(); e.preventDefault(); }
      if (e.key === "ArrowRight") { applyWidth(widthCache + 16); save(); e.preventDefault(); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { loadSaved(); wire(); });
  } else { loadSaved(); wire(); }
})();

window.ProjectBudget = window.ProjectBudget || {};
window.ProjectBudget.version = "0.1.0";
