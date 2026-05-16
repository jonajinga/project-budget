/* main.js loads on EVERY page (marketing + app). Keeps the header
   interactions vanilla so marketing pages don't need to ship Alpine just
   to flip a menu open. App pages get Alpine in addition. */

(function () {
  "use strict";

  /* ---- Theme toggle ------------------------------------------------ */

  var THEME_KEY = "projectbudget-theme";

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  function currentTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    return t === "dark" ? "dark" : "light";
  }
  function toggleTheme() {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  }

  /* ---- Site menu (hamburger) -------------------------------------- */

  function siteMenu() {
    return document.getElementById("site-menu");
  }
  function siteMenuBackdrop() {
    return document.querySelector(".site-menu-backdrop");
  }
  function openSiteMenu() {
    var m = siteMenu();
    if (!m) return;
    m.classList.add("is-open");
    var bd = siteMenuBackdrop();
    if (bd) bd.hidden = false;
    var triggers = document.querySelectorAll(".site-header__hamburger");
    triggers.forEach(function (b) { b.setAttribute("aria-expanded", "true"); });
  }
  function closeSiteMenu() {
    var m = siteMenu();
    if (!m) return;
    m.classList.remove("is-open");
    var bd = siteMenuBackdrop();
    if (bd) bd.hidden = true;
    var triggers = document.querySelectorAll(".site-header__hamburger");
    triggers.forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  }
  function toggleSiteMenu() {
    var m = siteMenu();
    if (m && m.classList.contains("is-open")) closeSiteMenu();
    else openSiteMenu();
  }

  /* ---- Search modal (lazy Pagefind) ------------------------------- */

  var pagefindInstance = null;
  function searchModal()  { return document.getElementById("search-modal"); }
  function searchInput()  { return document.getElementById("site-search-input"); }
  function searchResults(){ return document.getElementById("search-results"); }
  function searchHint()   { return document.getElementById("search-hint"); }

  function openSearch() {
    var m = searchModal();
    if (!m) return;
    m.hidden = false;
    setTimeout(function () {
      var i = searchInput();
      if (i) { i.focus(); i.select(); }
    }, 30);
  }
  function closeSearch() {
    var m = searchModal();
    if (!m) return;
    m.hidden = true;
    var i = searchInput();
    if (i) i.value = "";
    var r = searchResults();
    if (r) { r.innerHTML = ""; r.hidden = true; }
    var h = searchHint();
    if (h) h.hidden = false;
  }

  async function ensurePagefind() {
    if (pagefindInstance) return pagefindInstance;
    try {
      var pf = await import("/pagefind/pagefind.js");
      await pf.init();
      pagefindInstance = pf;
    } catch (e) {
      console.warn("Pagefind unavailable:", e);
      pagefindInstance = { search: async function () { return { results: [] }; } };
    }
    return pagefindInstance;
  }

  function escapeHTML(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" })[c];
    });
  }

  async function runSearch(query) {
    var hint = searchHint();
    var list = searchResults();
    if (!list || !hint) return;
    if (!query || query.length < 2) {
      list.innerHTML = ""; list.hidden = true;
      hint.textContent = "Start typing to search the site.";
      hint.hidden = false;
      return;
    }
    hint.textContent = "Searching…";
    hint.hidden = false;
    list.hidden = true;
    var pf = await ensurePagefind();
    var out = await pf.search(query);
    var hits = await Promise.all((out.results || []).slice(0, 10).map(function (r) { return r.data(); }));
    if (!hits.length) {
      hint.textContent = "No matches for “" + query + "”.";
      hint.hidden = false;
      list.hidden = true;
      return;
    }
    hint.hidden = true;
    list.hidden = false;
    list.innerHTML = hits.map(function (h) {
      var title = (h.meta && h.meta.title) || h.url;
      return "<li>"
        + "<a class='search-result' href='" + escapeHTML(h.url) + "'>"
        +   "<p class='search-result__title'>" + escapeHTML(title) + "</p>"
        +   "<p class='search-result__excerpt'>" + (h.excerpt || "") + "</p>"
        +   "<p class='search-result__url'>" + escapeHTML(h.url) + "</p>"
        + "</a></li>";
    }).join("");
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /* ---- Modal focus trap ------------------------------------------- */
  /* Any element with role="dialog" + aria-modal="true" gets focus
     management: when it becomes visible we save the previously-focused
     element, move focus inside (unless something inside already has
     focus, e.g. autofocus); when it hides we restore focus. Tab
     cycles within the dialog so keyboard users can't escape to the
     background while a modal is open. */

  var FOCUSABLE_SEL =
    'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),' +
    ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusableIn(root) {
    return Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE_SEL))
      .filter(function (el) { return el.offsetParent !== null; });
  }

  function topmostVisibleDialog() {
    var dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
    for (var i = dialogs.length - 1; i >= 0; i--) {
      if (dialogs[i].offsetParent !== null) return dialogs[i];
    }
    return null;
  }

  function handleDialogOpen(dialog) {
    if (dialog._fxActive) return;
    dialog._fxActive = true;
    dialog._fxPrev = document.activeElement;
    /* Defer to the next frame so any autofocus inside the modal wins
       — only steal focus if nothing inside has claimed it. */
    requestAnimationFrame(function () {
      if (!dialog.contains(document.activeElement)) {
        var fs = focusableIn(dialog);
        if (fs.length) fs[0].focus();
        else { dialog.setAttribute("tabindex", "-1"); dialog.focus(); }
      }
    });
  }

  function handleDialogClose(dialog) {
    if (!dialog._fxActive) return;
    dialog._fxActive = false;
    var prev = dialog._fxPrev;
    dialog._fxPrev = null;
    if (prev && document.body.contains(prev) && typeof prev.focus === "function") {
      prev.focus();
    }
  }

  function attachDialogObserver(dialog) {
    if (dialog._fxObserver) return;
    /* App modals are toggled by display:none on the .modal-backdrop
       parent; watching style + class + hidden on the parent covers
       Alpine x-show, native [hidden], and class-driven toggles. */
    var target = dialog.parentElement || dialog;
    var obs = new MutationObserver(function () {
      if (dialog.offsetParent !== null) handleDialogOpen(dialog);
      else handleDialogClose(dialog);
    });
    obs.observe(target, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    /* Also observe the dialog itself in case it's directly toggled. */
    obs.observe(dialog, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    dialog._fxObserver = obs;
    /* If it's already visible at boot, run the open path once. */
    if (dialog.offsetParent !== null) handleDialogOpen(dialog);
  }

  function scanDialogs() {
    document.querySelectorAll('[role="dialog"][aria-modal="true"]').forEach(attachDialogObserver);
  }

  function trapTabInDialog(e) {
    if (e.key !== "Tab") return;
    var dialog = topmostVisibleDialog();
    if (!dialog) return;
    var fs = focusableIn(dialog);
    if (!fs.length) { e.preventDefault(); return; }
    var first = fs[0], last = fs[fs.length - 1];
    var active = document.activeElement;
    if (!dialog.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  /* ---- Wire everything on DOM ready -------------------------------- */

  function wire() {
    /* Hamburger triggers (multiple — one per header variant) */
    document.querySelectorAll(".site-header__hamburger").forEach(function (btn) {
      btn.addEventListener("click", function (e) { e.preventDefault(); toggleSiteMenu(); });
    });

    /* Site menu links close menu on navigation */
    document.querySelectorAll(".site-menu__link").forEach(function (a) {
      a.addEventListener("click", closeSiteMenu);
    });

    /* Backdrop + close button */
    var bd = siteMenuBackdrop();
    if (bd) {
      bd.hidden = true;
      bd.addEventListener("click", closeSiteMenu);
    }
    document.querySelectorAll(".site-menu__close").forEach(function (b) {
      b.addEventListener("click", closeSiteMenu);
    });

    /* Search modal close handlers + input */
    document.querySelectorAll("[data-search-close]").forEach(function (el) {
      el.addEventListener("click", closeSearch);
    });
    var input = searchInput();
    if (input) input.addEventListener("input", debounce(function () { runSearch(input.value); }, 200));

    /* Global keybinds */
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      } else if (e.key === "Escape") {
        if (searchModal() && !searchModal().hidden) closeSearch();
        if (siteMenu() && siteMenu().classList.contains("is-open")) closeSiteMenu();
      }
    });

    /* System theme change with no explicit preference */
    try {
      var mql = window.matchMedia("(prefers-color-scheme: dark)");
      mql.addEventListener("change", function (e) {
        if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? "dark" : "light");
      });
    } catch (e) {}

    /* Modal focus trap — observe every existing dialog and watch for
       new ones added later (Alpine renders some lazily). */
    scanDialogs();
    new MutationObserver(scanDialogs).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", trapTabInDialog);
  }

  /* Export to window so onclick="" handlers can call these. */
  window.ProjectBudget = window.ProjectBudget || {};
  window.ProjectBudget.toggleTheme = toggleTheme;
  window.ProjectBudget.openSearch = openSearch;
  window.ProjectBudget.closeSearch = closeSearch;
  window.ProjectBudget.toggleSiteMenu = toggleSiteMenu;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
