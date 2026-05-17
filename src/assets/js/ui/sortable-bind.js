/* SortableJS binding layer.

   Replaces the in-house HTML5 D&D that was wired into Alpine reactivity.
   Pattern: every reorderable container declares
       data-sortable-list
       data-sortable-kind="categories" | "cat-group" | "accounts"
                          | "acct-group" | "budget"
       data-sortable-group-id="<id>"     (only for item lists, not group
                                          lists; identifies the destination
                                          group on cross-group drops)
   Each draggable child carries data-sortable-id="<id>" and a .dnd-handle
   element used as the drag handle.

   On drop, we dispatch to the matching store mutator. The store already
   renumbers sortIndex + saves + bumps lists, so Alpine reactivity
   refreshes the rest of the UI.

   We also rescan on Alpine x-for mutations: a MutationObserver on
   <body> watches for [data-sortable-list] entries added/removed and
   attaches/destroys Sortable instances accordingly. */
(function () {
  "use strict";

  if (typeof window === "undefined" || typeof window.Sortable !== "function") {
    /* Vendor loads before Alpine via defer; if Sortable somehow missed
       (CDN block, ad-blocker, etc.) we fail soft — drag handles will
       look enabled but won't do anything, and the up/down arrow buttons
       still work on the categories + accounts pages. */
    console.warn("SortableJS not loaded; drag-and-drop disabled.");
    return;
  }

  var DATA_KEY = "__pbSortable";

  function dispatchMove(kind, itemId, toGroupId, newIndex) {
    var store = window.Alpine && window.Alpine.store && window.Alpine.store("budget");
    if (!store) return;
    switch (kind) {
      case "categories":
        store.moveCategory(itemId, toGroupId || null, newIndex);
        break;
      case "cat-group":
        store.moveCategoryGroup(itemId, newIndex);
        break;
      case "accounts":
        store.moveAccount(itemId, toGroupId || null, newIndex);
        break;
      case "acct-group":
        store.moveAccountGroup(itemId, newIndex);
        break;
      case "budget":
        /* Budget rows ARE categories — same mutator. */
        store.moveCategory(itemId, toGroupId || null, newIndex);
        break;
    }
  }

  function attach(el) {
    if (el[DATA_KEY]) return; /* already bound */
    var kind = el.getAttribute("data-sortable-kind");
    if (!kind) return;

    /* Categories on /app/categories/ vs /app/budget/ are the same kind
       conceptually (both move the same entities) but live in different
       page contexts. Allow cross-group drops only within a single page
       by scoping the Sortable group name to the page kind. */
    var groupName = "pb-" + kind;

    el[DATA_KEY] = window.Sortable.create(el, {
      animation: 150,
      handle: ".dnd-handle",
      ghostClass: "is-ghost",
      chosenClass: "is-chosen",
      dragClass: "is-dragging",
      group: groupName,
      fallbackOnBody: true,
      swapThreshold: 0.6,
      /* Always use SortableJS's JS-driven implementation. The HTML5
         D&D fallback has poor + inconsistent touch support — drags
         would start but freeze mid-gesture on iOS Safari + Chrome
         mobile. JS fallback works uniformly on mouse + touch + pen. */
      forceFallback: true,
      /* Longer touch-hold delay only on touch devices (mouse stays
         instant) so accidental finger drags during normal scroll
         don't trigger a reorder. 200ms is the iOS standard for
         distinguishing tap-vs-drag. */
      delay: 200,
      delayOnTouchOnly: true,
      /* Scroll the viewport while dragging near the edges. Required
         for long lists where the drop target is offscreen. */
      scroll: true,
      scrollSensitivity: 60,
      scrollSpeed: 12,
      onStart: function () {
        document.body.classList.add("pb-dragging");
        document.documentElement.classList.add("pb-dragging");
      },
      onEnd: function (evt) {
        document.body.classList.remove("pb-dragging");
        document.documentElement.classList.remove("pb-dragging");
        var item = evt.item;
        if (!item) return;
        var itemId = item.getAttribute("data-sortable-id");
        if (!itemId) return;
        var toContainer = evt.to;
        var toGroupId = toContainer ? toContainer.getAttribute("data-sortable-group-id") : null;
        var newIndex = evt.newIndex || 0;
        dispatchMove(kind, itemId, toGroupId, newIndex);
      },
    });
  }

  function detach(el) {
    var inst = el[DATA_KEY];
    if (inst && typeof inst.destroy === "function") inst.destroy();
    el[DATA_KEY] = null;
  }

  function scan(root) {
    var nodes = (root || document).querySelectorAll("[data-sortable-list]");
    nodes.forEach(attach);
  }

  function init() {
    scan(document);
    /* Alpine renders x-for items asynchronously; rescan on any added
       node that's either a [data-sortable-list] or contains one. */
    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes && m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches("[data-sortable-list]")) attach(n);
          if (n.querySelectorAll) scan(n);
        });
        m.removedNodes && m.removedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches("[data-sortable-list]")) detach(n);
          if (n.querySelectorAll) {
            n.querySelectorAll("[data-sortable-list]").forEach(detach);
          }
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (window.Alpine && window.Alpine.store && window.Alpine.store("budget")) {
    /* Alpine already initialized — run now. */
    init();
  } else {
    document.addEventListener("alpine:initialized", init);
  }

  /* Safety net for aborted touch drags. SortableJS's onEnd doesn't
     fire if the OS cancels the touch sequence (user scrolls away,
     phone call interrupts, browser loses track). The .is-ghost class
     stays stranded on the row, fading it to opacity 0.35 — looks like
     "categories invisible on mobile" the next visit. Clearing on every
     touchend/touchcancel is a no-op when drag completes normally
     (Sortable already removed the class) and a rescue otherwise. */
  function clearStrandedGhosts() {
    document.querySelectorAll(".is-ghost").forEach(function (el) {
      el.classList.remove("is-ghost");
    });
    document.body.classList.remove("pb-dragging");
    document.documentElement.classList.remove("pb-dragging");
  }
  document.addEventListener("touchend", clearStrandedGhosts, { passive: true });
  document.addEventListener("touchcancel", clearStrandedGhosts, { passive: true });
})();
