/* Project Budget doc system client.
   - Generates the right-hand sticky TOC from .doc-content__prose headings
   - Highlights the active heading via IntersectionObserver
   - Toggles the left sidebar (mobile + opt-in collapse)
   - Toggles the right TOC open/closed (collapsible per user request) */

(function () {
  if (typeof document === "undefined") return;

  function slugify(text) {
    return (text || "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 64);
  }

  function ensureId(el) {
    if (el.id) return el.id;
    var base = slugify(el.textContent) || "section";
    var id = base, i = 1;
    while (document.getElementById(id)) { i++; id = base + "-" + i; }
    el.id = id;
    return id;
  }

  function buildToc() {
    var prose = document.querySelector(".doc-content__prose");
    var list = document.getElementById("toc-list");
    if (!prose || !list) return [];
    var nodes = prose.querySelectorAll("h2, h3");
    if (!nodes.length) {
      document.getElementById("docs-toc").style.display = "none";
      return [];
    }
    var items = [];
    nodes.forEach(function (h) {
      var id = ensureId(h);
      var li = document.createElement("li");
      li.className = h.tagName === "H3" ? "toc-h3" : "toc-h2";
      var a = document.createElement("a");
      a.href = "#" + id;
      a.textContent = h.textContent;
      a.dataset.target = id;
      li.appendChild(a);
      list.appendChild(li);
      items.push({ el: h, link: a });
    });
    return items;
  }

  function observeActive(items) {
    if (!items.length || !("IntersectionObserver" in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        items.forEach(function (it) {
          it.link.classList.toggle("active", it.el === e.target);
        });
      });
    }, { rootMargin: "-30% 0px -55% 0px" });
    items.forEach(function (it) { observer.observe(it.el); });
  }

  function wireTocToggle() {
    var toggle = document.getElementById("docs-toc-toggle");
    var list = document.getElementById("toc-list");
    if (!toggle || !list) return;
    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") !== "false";
      toggle.setAttribute("aria-expanded", String(!expanded));
      list.hidden = expanded;
      toggle.classList.toggle("is-collapsed", expanded);
    });
  }

  function wireSidebarToggle() {
    window.toggleDocsSidebar = function () {
      var layout = document.getElementById("docs-layout");
      var btn = document.querySelector(".docs-sidebar-toggle");
      if (!layout) return;
      var open = layout.getAttribute("data-sidebar") === "open";
      layout.setAttribute("data-sidebar", open ? "closed" : "open");
      if (btn) btn.setAttribute("aria-expanded", String(!open));
    };
  }

  function init() {
    wireSidebarToggle();
    wireTocToggle();
    var items = buildToc();
    observeActive(items);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
