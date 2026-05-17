/* main.js loads on EVERY page (marketing + app). Keeps the header
   interactions vanilla so marketing pages don't need to ship Alpine just
   to flip a menu open. App pages get Alpine in addition. */

(function () {
  "use strict";

  /* ---- Theme toggle ------------------------------------------------ */

  var THEME_KEY = "projectbudget-theme";

  /* All available themes — the original light/dark plus the preset
     library inspired by Guerilla Type. The header sun/moon button
     still toggles only between light + dark (the two "system"
     themes); the Settings → Appearance picker can set any. */
  /* "light" and "dark" are now the GitHub palette — the project's
     standard pair. The legacy Broadsheet cream/vermillion lives at
     "paper"/"ink" for users who prefer the original aesthetic. */
  var THEMES = [
    { id: "light",            label: "Light",                 scheme: "light" },
    { id: "dark",             label: "Dark",                  scheme: "dark"  },
    { id: "paper",            label: "Paper (Broadsheet)",    scheme: "light" },
    { id: "ink",              label: "Ink (Broadsheet)",      scheme: "dark"  },
    { id: "solarized-light",  label: "Solarized Light",       scheme: "light" },
    { id: "solarized-dark",   label: "Solarized Dark",        scheme: "dark"  },
    { id: "github-light",     label: "GitHub Light (alias)",  scheme: "light" },
    { id: "github-dark",      label: "GitHub Dark (alias)",   scheme: "dark"  },
    { id: "dracula",          label: "Dracula",               scheme: "dark"  },
    { id: "nord",             label: "Nord",                  scheme: "dark"  },
    { id: "gruvbox-dark",     label: "Gruvbox Dark",          scheme: "dark"  },
    { id: "one-dark",         label: "One Dark",              scheme: "dark"  },
    { id: "tokyo-night",      label: "Tokyo Night",           scheme: "dark"  },
    { id: "catppuccin",       label: "Catppuccin",            scheme: "dark"  },
    { id: "rose-pine",        label: "Rosé Pine",             scheme: "dark"  },
  ];
  var THEME_IDS = THEMES.map(function (t) { return t.id; });

  function applyTheme(t) {
    /* Accept any registered theme ID. Unknown values fall back to
       "light" so the page never ends up in an undefined state. */
    if (THEME_IDS.indexOf(t) === -1) t = "light";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent("pb:theme-change", { detail: { theme: t } }));
    } catch (_e) {}
  }
  function currentTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    return THEME_IDS.indexOf(t) !== -1 ? t : "light";
  }
  /* Header button: light ↔ dark within the same theme family when
     possible. Families: github (light/dark = the defaults), paper/ink
     (Broadsheet), solarized-light/solarized-dark. Single-scheme
     presets (Dracula, Nord, etc.) toggle back to the default pair. */
  var THEME_PAIRS = {
    "light": "dark",
    "dark": "light",
    "github-light": "github-dark",
    "github-dark": "github-light",
    "paper": "ink",
    "ink": "paper",
    "solarized-light": "solarized-dark",
    "solarized-dark": "solarized-light",
  };
  function toggleTheme() {
    var t = currentTheme();
    if (THEME_PAIRS[t]) { applyTheme(THEME_PAIRS[t]); return; }
    /* Single-scheme presets (Dracula, etc.) — flip to the base
       light/dark depending on the preset's color scheme. */
    var preset = THEMES.find(function (x) { return x.id === t; });
    applyTheme(preset && preset.scheme === "dark" ? "light" : "dark");
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

  function docsSection()    { return document.getElementById("search-docs-section"); }
  function actionsSection() { return document.getElementById("search-actions-section"); }

  /* Command-palette upgrade: query goes through both the action registry
     (handled in command-palette.js) and Pagefind docs search. A leading
     "?" or "/" skips actions entirely (search-only). Empty query shows
     the top actions so users discover what's possible. */
  async function runSearch(rawQuery) {
    var hint = searchHint();
    var list = searchResults();
    var docs = docsSection();
    var actions = actionsSection();
    if (!list || !hint) return;
    var query = (rawQuery || "").trim();
    var docsQuery = (query.charAt(0) === "?" || query.charAt(0) === "/") ? query.slice(1).trim() : query;

    /* Render actions first (synchronous, fast). */
    var actionHits = (window.ProjectBudget && window.ProjectBudget.paletteRender)
      ? window.ProjectBudget.paletteRender(query)
      : [];

    /* Empty query: show actions hint + the top-action defaults, hide docs. */
    if (!query) {
      list.innerHTML = ""; list.hidden = true; if (docs) docs.hidden = true;
      hint.hidden = !(actions && actions.hidden); /* hide hint only if actions shown */
      hint.textContent = "Type a command, page, or search term. Press “?” then a query to search the docs only.";
      return;
    }

    /* Below threshold for docs query → show actions only. */
    if (!docsQuery || docsQuery.length < 2) {
      list.innerHTML = ""; list.hidden = true; if (docs) docs.hidden = true;
      hint.hidden = actionHits.length > 0;
      hint.textContent = actionHits.length ? "" : "Keep typing to search.";
      return;
    }

    hint.hidden = true;
    if (docs) docs.hidden = false;
    list.hidden = false;
    list.innerHTML = "<li class='search-modal__loading'>Searching docs…</li>";
    var pf = await ensurePagefind();
    var out = await pf.search(docsQuery);
    var hits = await Promise.all((out.results || []).slice(0, 8).map(function (r) { return r.data(); }));
    if (!hits.length) {
      list.innerHTML = "<li class='search-modal__loading'>No matches for “" + escapeHTML(docsQuery) + "”.</li>";
      return;
    }
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

    /* Web3Forms contact-form handler. Submits via fetch so we can swap
       the button label + redirect to a thank-you page without a full
       page reload. Falls back to a regular form POST if fetch errors. */
    document.querySelectorAll("form[data-web3forms]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = form.querySelector("[type=\"submit\"]");
        var errorBox = form.querySelector(".form-error");
        var origLabel = btn ? btn.textContent : "";
        if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
        if (errorBox) errorBox.style.display = "none";
        var data = new FormData(form);
        /* Preserve the user's topic + severity selections through the
           redirect so the thank-you page can swap in copy tailored to
           the kind of message they sent. */
        var topic = data.get("topic") || "";
        var severity = data.get("severity") || "";
        fetch("https://api.web3forms.com/submit", { method: "POST", body: data })
          .then(function (r) { return r.json(); })
          .then(function (json) {
            if (json && json.success) {
              var base = form.dataset.redirect || "/thank-you/";
              var sep = base.indexOf("?") === -1 ? "?" : "&";
              var qs = "topic=" + encodeURIComponent(topic) +
                (severity ? "&severity=" + encodeURIComponent(severity) : "");
              window.location.href = base + (topic ? sep + qs : "");
            } else {
              if (btn) { btn.disabled = false; btn.textContent = origLabel; }
              if (errorBox) { errorBox.style.display = "block"; errorBox.textContent = "Sending failed. Please try again or email directly."; }
            }
          })
          .catch(function () {
            if (btn) { btn.disabled = false; btn.textContent = origLabel; }
            if (errorBox) { errorBox.style.display = "block"; errorBox.textContent = "Network error. Please try again."; }
          });
      });
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

    /* Search / command-palette modal close handlers + input */
    document.querySelectorAll("[data-search-close]").forEach(function (el) {
      el.addEventListener("click", closeSearch);
    });
    var input = searchInput();
    if (input) {
      input.addEventListener("input", debounce(function () { runSearch(input.value); }, 200));
      /* Enter runs the top action (no query → first listed). Falls
         through to default if no actions to run. */
      input.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        if (window.ProjectBudget && window.ProjectBudget.paletteRunTop && window.ProjectBudget.paletteRunTop()) {
          e.preventDefault();
        }
      });
      /* When the modal opens with no query, prime the actions list so
         users see what's available immediately. */
      input.addEventListener("focus", function () { runSearch(input.value); });
    }

    /* Global keybinds.
       - Cmd/Ctrl+K   → search + command palette (universal convention)
       - n            → quick-add transaction (only when not typing in a
                        field, so it doesn't intercept actual text input)
       - Cmd/Ctrl+Z   → undo (skipped when typing so OS-native text undo
                        keeps working inside inputs)
       Earlier the FAB tooltip pointed at Ctrl+K, which actually opens
       the palette — pressing `n` jumps straight to Quick Add without
       the intermediate palette step. */
    function inEditableField(target) {
      if (!target || !target.tagName) return false;
      var tag = target.tagName.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return !!target.isContentEditable;
    }
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "?" && !inEditableField(e.target)) {
        /* GitHub-style: `?` opens the command palette so users can
           discover available actions + navigation. Same destination
           as Cmd/Ctrl+K but without a modifier — easier to remember. */
        e.preventDefault();
        openSearch();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "n" && !inEditableField(e.target)) {
        /* Only fire when the FAB partial is on the page (app shell). */
        if (document.querySelector(".fab-quick-add")) {
          e.preventDefault();
          try { document.dispatchEvent(new CustomEvent("pb:quick-add-open")); } catch (_e) {}
        }
      } else if (e.key === "Escape") {
        if (searchModal() && !searchModal().hidden) closeSearch();
        if (siteMenu() && siteMenu().classList.contains("is-open")) closeSiteMenu();
      } else if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "z") {
        /* Skip undo/redo when the user is typing in a field so they
           can use the OS-native text undo inside inputs/textareas. */
        var t = e.target;
        var tag = t && t.tagName ? t.tagName.toUpperCase() : "";
        if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
        var s = window.Alpine && window.Alpine.store && window.Alpine.store("budget");
        if (!s) return;
        e.preventDefault();
        if (e.shiftKey) {
          if (s.canRedo()) s.redo();
        } else {
          if (s.canUndo()) s.undo();
        }
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
  /* Theme picker (header dropdown + diagnostics) needs the full
     theme list + a direct setter; expose them alongside the toggle. */
  window.ProjectBudget.themes = THEMES;
  window.ProjectBudget.currentTheme = currentTheme;
  window.ProjectBudget.applyTheme = applyTheme;
  window.ProjectBudget.openSearch = openSearch;
  window.ProjectBudget.closeSearch = closeSearch;
  window.ProjectBudget.toggleSiteMenu = toggleSiteMenu;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
