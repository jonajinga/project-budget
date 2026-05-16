(function () {
  "use strict";

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

  window.ProjectBudget = window.ProjectBudget || {};
  window.ProjectBudget.toggleTheme = toggleTheme;

  // Reflect system changes only when no explicit preference is stored.
  try {
    var mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", function (e) {
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  } catch (e) {}
})();
