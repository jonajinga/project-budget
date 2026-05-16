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
