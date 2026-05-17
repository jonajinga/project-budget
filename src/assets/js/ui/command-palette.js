/* Command palette — extends the existing Cmd/Ctrl+K search modal with
   action items (navigation + Alpine store calls) ranked above the
   docs/blog search results.

   Action registry is static + dynamic:
     - Static: page navigations, theme toggle, take-snapshot, etc.
     - Dynamic: "Switch to profile <name>" for every profile in the
       active store.

   The user can:
     - Type "budget" -> shows "Go to Budget" first, then docs about budget.
     - Type "?" or "/" as the FIRST char to skip actions and search docs only.

   Wiring: main.js dispatches `pb:palette-query` on the input. We
   own the rendering of #search-actions (the actions section) and let
   main.js / Pagefind own #search-results (the docs section). */
(function () {
  "use strict";

  function $store() {
    return (window.Alpine && window.Alpine.store && window.Alpine.store("budget")) || null;
  }

  /* Static actions. `run` may take optional args (none of ours do). */
  function staticActions() {
    return [
      { id: "go-dashboard",  label: "Go to Dashboard",   hint: "/app/",            run: function () { go("/app/"); } },
      { id: "go-budget",     label: "Go to Budget",      hint: "/app/budget/",     run: function () { go("/app/budget/"); } },
      { id: "go-register",   label: "Go to Register",    hint: "/app/register/",   run: function () { go("/app/register/"); } },
      { id: "go-calendar",   label: "Go to Calendar",    hint: "/app/calendar/",   run: function () { go("/app/calendar/"); } },
      { id: "go-accounts",   label: "Go to Accounts",    hint: "/app/accounts/",   run: function () { go("/app/accounts/"); } },
      { id: "go-categories", label: "Go to Categories",  hint: "/app/categories/", run: function () { go("/app/categories/"); } },
      { id: "go-payees",     label: "Go to Payees",      hint: "/app/payees/",     run: function () { go("/app/payees/"); } },
      { id: "go-scheduled",  label: "Go to Recurring",   hint: "/app/scheduled/",  run: function () { go("/app/scheduled/"); } },
      { id: "go-reports",    label: "Go to Reports",     hint: "/app/reports/",    run: function () { go("/app/reports/"); } },
      { id: "go-import",     label: "Go to Import",      hint: "/app/import/",     run: function () { go("/app/import/"); } },
      { id: "go-backup",     label: "Go to Backup",      hint: "/app/backup/",     run: function () { go("/app/backup/"); } },
      { id: "go-profiles",   label: "Go to Profiles",    hint: "/app/profiles/",   run: function () { go("/app/profiles/"); } },
      { id: "go-settings",   label: "Go to Settings",    hint: "/app/settings/",   run: function () { go("/app/settings/"); } },
      { id: "go-style-guide", label: "Go to Style Guide", hint: "/style-guide/",   run: function () { go("/style-guide/"); } },

      { id: "act-add-txn", label: "Add transaction", hint: "Open the quick-add form", run: function () {
        document.dispatchEvent(new CustomEvent("pb:quick-add-open"));
      }},
      { id: "act-snapshot", label: "Take snapshot of active profile", hint: "Backs up the current profile state", run: function () {
        var s = $store(); if (!s || !s.profile) return;
        if (!window.PBDialog) { s.takeSnapshot(""); return; }
        window.PBDialog.prompt({
          title: "Take snapshot",
          message: "Snapshots preserve the active profile's state so you can restore it later. The label is optional.",
          label: "Snapshot label (optional)",
          defaultValue: "",
          okLabel: "Take snapshot",
        }).then(function (label) {
          /* Cancel returns null — only abort then. Empty string is fine
             (user opted to skip the label). */
          if (label === null) return;
          s.takeSnapshot(label);
        });
      }},
      { id: "act-toggle-theme", label: "Toggle theme (light/dark)", hint: "Switches the current color scheme", run: function () {
        if (window.ProjectBudget && window.ProjectBudget.toggleTheme) window.ProjectBudget.toggleTheme();
      }},
      { id: "act-this-month", label: "Jump budget to current month", hint: "Sets the budget view to today's month", run: function () {
        var s = $store(); if (!s) return;
        s.jumpToThisMonth();
        go("/app/budget/");
      }},
    ];
  }

  /* Dynamic: one action per non-active profile, "Switch to <name>". */
  function dynamicActions() {
    var s = $store();
    if (!s || !s.profiles || !s.profiles.length) return [];
    return s.profiles
      .filter(function (p) { return p.id !== s.active; })
      .map(function (p) {
        return {
          id: "switch-" + p.id,
          label: "Switch to profile: " + p.name,
          hint: "Activates this profile",
          run: function () { s.switchTo(p.id); },
        };
      });
  }

  /* Data actions: search across the user's payees, categories, and
     accounts. Each match navigates to the register pre-filtered by
     that name (?q=<name>) or to the dedicated admin page when more
     useful. Built lazily on every render so list mutations show up
     immediately without an explicit refresh. */
  function dataActions() {
    var s = $store();
    if (!s || !s.profile) return [];
    var actions = [];

    /* Payees */
    var payees = s.profile.payees || [];
    payees.forEach(function (p) {
      if (!p || !p.name) return;
      actions.push({
        id: "data-payee-" + p.id,
        label: "Payee: " + p.name,
        hint: "Open the register filtered to this payee",
        run: function () { go("/app/register/?q=" + encodeURIComponent(p.name)); },
      });
    });

    /* Categories — skip payment cats (those are derived, not directly
       budgetable). */
    var cats = s.profile.categories || [];
    cats.forEach(function (c) {
      if (!c || !c.name) return;
      if (s.isPaymentCategory && s.isPaymentCategory(c.id)) return;
      actions.push({
        id: "data-cat-" + c.id,
        label: "Category: " + c.name,
        hint: "Open the register filtered to this category",
        run: function () { go("/app/register/?q=" + encodeURIComponent(c.name)); },
      });
    });

    /* Accounts */
    var accts = s.profile.accounts || [];
    accts.forEach(function (a) {
      if (!a || !a.name || a.closedAt) return;
      actions.push({
        id: "data-acct-" + a.id,
        label: "Account: " + a.name,
        hint: "Open this account's register",
        run: function () { go("/app/register/?account=" + encodeURIComponent(a.id)); },
      });
    });

    return actions;
  }

  function allActions() {
    return staticActions().concat(dynamicActions()).concat(dataActions());
  }

  function go(url) {
    /* Hide the modal first so the next page doesn't load with it open. */
    if (window.ProjectBudget && window.ProjectBudget.closeSearch) window.ProjectBudget.closeSearch();
    window.location.assign(url);
  }

  /* Fuzzy match via Fuse.js (already vendored). Falls back to substring
     match if Fuse failed to load. */
  function rank(query, items) {
    var q = (query || "").trim();
    if (!q) return items.slice(0, 8); /* show top 8 by registry order when empty */
    if (typeof window.Fuse === "function") {
      var fuse = new window.Fuse(items, {
        includeScore: true,
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 1,
        keys: [
          { name: "label", weight: 4 },
          { name: "hint",  weight: 1 },
        ],
      });
      return fuse.search(q).slice(0, 8).map(function (r) { return r.item; });
    }
    var ql = q.toLowerCase();
    return items.filter(function (a) {
      return a.label.toLowerCase().indexOf(ql) !== -1
          || (a.hint || "").toLowerCase().indexOf(ql) !== -1;
    }).slice(0, 8);
  }

  function escapeHTML(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" })[c];
    });
  }

  function render(query) {
    var section = document.getElementById("search-actions-section");
    var list = document.getElementById("search-actions");
    if (!section || !list) return [];
    var q = query || "";
    /* "?" / "/" prefix opts out of actions entirely. */
    if (q.charAt(0) === "?" || q.charAt(0) === "/") {
      section.hidden = true;
      list.innerHTML = "";
      return [];
    }
    var hits = rank(q, allActions());
    if (!hits.length) {
      section.hidden = true;
      list.innerHTML = "";
      return [];
    }
    section.hidden = false;
    list.innerHTML = hits.map(function (a, i) {
      return "<li>"
        + "<button type='button' class='search-result' data-action-id='" + escapeHTML(a.id) + "' tabindex='-1'"
        + (i === 0 ? " data-first" : "") + ">"
        +   "<p class='search-result__title'>" + escapeHTML(a.label) + "</p>"
        + (a.hint ? "<p class='search-result__excerpt'>" + escapeHTML(a.hint) + "</p>" : "")
        + "</button>"
        + "</li>";
    }).join("");
    /* Wire clicks. */
    Array.prototype.forEach.call(list.querySelectorAll("[data-action-id]"), function (btn) {
      btn.addEventListener("click", function () {
        var action = hits.find(function (h) { return h.id === btn.getAttribute("data-action-id"); });
        if (action && action.run) action.run();
      });
    });
    return hits;
  }

  /* Public: pressing Enter from the input runs the top action when the
     input has any text AND we have at least one action shown. */
  function runTopAction() {
    var input = document.getElementById("site-search-input");
    if (!input) return false;
    var q = input.value;
    if (!q || q.charAt(0) === "?" || q.charAt(0) === "/") return false;
    var hits = rank(q, allActions());
    if (!hits.length) return false;
    hits[0].run();
    return true;
  }

  window.ProjectBudget = window.ProjectBudget || {};
  window.ProjectBudget.paletteRender = render;
  window.ProjectBudget.paletteRunTop = runTopAction;
})();
