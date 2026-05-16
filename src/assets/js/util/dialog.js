/* PBDialog — promise-based replacement for window.confirm and
   window.prompt. Renders a real in-app modal (uses the existing
   .modal / .modal--sm / .form-actions / .btn chrome) so dialogs
   match the rest of the app instead of the browser's native UA
   dialog ("Code" title, OS buttons).

   Usage:
     await PBDialog.confirm({
       title: 'Remove this snapshot?',
       message: 'This permanently deletes the snapshot.',
       confirmLabel: 'Remove snapshot',
       danger: true,
     });
     // → true on confirm, false on cancel/Esc/backdrop-click

     const name = await PBDialog.prompt({
       title: 'Rename group',
       label: 'Group name',
       defaultValue: 'Daily',
       okLabel: 'Save',
     });
     // → trimmed string, or null on cancel

   Both methods return a Promise; the host expression can await it
   directly inside an Alpine x-on (Alpine awaits async handlers).
   Multiple calls queue safely — each invocation creates its own
   DOM, removed on close. */

(function () {
  "use strict";

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  /* Standard ✕ glyph — matches the modal__close + toast close used
     elsewhere so every close icon in the app reads the same size. */
  function xIcon() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2.4");
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    [["6","6","18","18"], ["6","18","18","6"]].forEach(function (xy) {
      var l = document.createElementNS(ns, "line");
      l.setAttribute("x1", xy[0]); l.setAttribute("y1", xy[1]);
      l.setAttribute("x2", xy[2]); l.setAttribute("y2", xy[3]);
      svg.appendChild(l);
    });
    return svg;
  }

  function openDialog(opts) {
    return new Promise(function (resolve) {
      var settled = false;
      var prevFocus = document.activeElement;

      function done(result) {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onKey, true);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (prevFocus && typeof prevFocus.focus === "function") {
          try { prevFocus.focus(); } catch (_e) {}
        }
        resolve(result);
      }

      function onKey(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          done(opts.kind === "prompt" ? null : false);
        } else if (e.key === "Enter" && opts.kind === "confirm") {
          /* Enter confirms only when focus isn't inside a button (so
             a focused Cancel button still cancels). */
          if (document.activeElement && document.activeElement.tagName !== "BUTTON") {
            e.preventDefault();
            done(true);
          }
        } else if (e.key === "Tab") {
          /* Simple focus trap — keep tab cycling inside the modal. */
          var focusables = panel.querySelectorAll(
            "input, button, select, textarea, a[href], [tabindex]:not([tabindex='-1'])"
          );
          if (!focusables.length) return;
          var first = focusables[0], last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
          }
        }
      }

      /* Build modal DOM. */
      var role = opts.kind === "confirm" ? "alertdialog" : "dialog";
      var titleEl = el("h3", { class: "modal__title" }, [opts.title || ""]);
      var bodyChildren = [];
      if (opts.message) {
        bodyChildren.push(el("p", {
          class: "pb-dialog__message",
          style: "color: var(--fg-muted); margin: 0 0 var(--space-md); line-height: 1.5;",
        }, [opts.message]));
      }

      var input = null;
      if (opts.kind === "prompt") {
        var field = el("div", { class: "field", style: "margin: 0 0 var(--space-md);" }, [
          opts.label ? el("label", { class: "field__label", for: "pb-dialog-input" }, [opts.label]) : null,
        ]);
        input = el("input", {
          class: "input",
          id: "pb-dialog-input",
          type: opts.inputType || "text",
          value: opts.defaultValue || "",
        });
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            done((input.value || "").trim() || null);
          }
        });
        field.appendChild(input);
        bodyChildren.push(field);
      }

      var confirmLabel = opts.confirmLabel || (opts.kind === "prompt" ? "Save" : "Confirm");
      var cancelLabel  = opts.cancelLabel  || "Cancel";
      var confirmClass = "btn " + (opts.danger ? "btn--danger" : "btn--primary");
      var confirmBtn = el("button", {
        type: "button",
        class: confirmClass,
        onclick: function () {
          if (opts.kind === "prompt") {
            var v = (input && input.value || "").trim();
            done(v || null);
          } else {
            done(true);
          }
        },
      }, [confirmLabel]);
      var cancelBtn = el("button", {
        type: "button",
        class: "btn btn--ghost",
        onclick: function () { done(opts.kind === "prompt" ? null : false); },
      }, [cancelLabel]);

      var closeBtn = el("button", {
        type: "button",
        class: "modal__close",
        "aria-label": "Close",
        onclick: function () { done(opts.kind === "prompt" ? null : false); },
      }, [xIcon()]);

      var actions = el("div", { class: "form-actions" }, [confirmBtn, cancelBtn]);
      var panel = el("div", {
        class: "modal modal--sm",
        role: role,
        "aria-modal": "true",
        "aria-labelledby": "pb-dialog-title",
      }, [closeBtn, titleEl].concat(bodyChildren, [actions]));
      titleEl.id = "pb-dialog-title";

      var backdrop = el("div", {
        class: "modal-backdrop pb-dialog-backdrop",
        onclick: function (e) {
          if (e.target === backdrop) done(opts.kind === "prompt" ? null : false);
        },
      }, [panel]);

      document.body.appendChild(backdrop);
      document.addEventListener("keydown", onKey, true);

      /* Initial focus: prompt input first, confirm button otherwise. */
      setTimeout(function () {
        if (input) { input.focus(); input.select(); }
        else if (confirmBtn) confirmBtn.focus();
      }, 0);
    });
  }

  window.PBDialog = {
    confirm: function (opts) {
      return openDialog(Object.assign({}, opts || {}, { kind: "confirm" }));
    },
    prompt: function (opts) {
      return openDialog(Object.assign({}, opts || {}, { kind: "prompt" }));
    },
  };
})();
