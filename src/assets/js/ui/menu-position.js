/* Viewport-aware placement for the overflow (kebab) menu.
 *
 * The menu used to be a plain `position: absolute` popover pinned at
 * `top: calc(100% + 4px)`. That is correct only when the trigger has room
 * below it. The budget row menu is 9 items -- around 360px tall -- so
 * opening it from any row in the lower half of a phone screen put most of
 * it below the fold, with no way to reach the items.
 *
 * Absolute positioning has a second failure mode that is easy to miss: the
 * popover is laid out inside its scroll container, so an ancestor with
 * `overflow: hidden` or `overflow-x: auto` CLIPS it. Several of the tables
 * these menus live in scroll horizontally.
 *
 * `position: fixed` fixes both -- it is laid out against the viewport, so no
 * ancestor can clip it -- and then the flip/clamp logic below keeps it on
 * screen. One caveat worth knowing: a `transform`, `filter`, `perspective`,
 * `contain` or `will-change` on ANY ancestor makes that ancestor the
 * containing block for fixed children, and the menu would be positioned
 * against it instead of the viewport. `assertNoFixedTrap` checks for that in
 * development rather than leaving it as a silent mystery.
 *
 * Deliberately not Popper, even though Tippy already pulls it in: this needs
 * flip + shift + a height cap and nothing else, the menu must be placeable
 * on first paint, and Popper's observers are more machinery than a menu that
 * closes on scroll needs.
 */

(function () {
  var MARGIN = 8; /* keep this much clear of every viewport edge */
  var GAP = 4; /* between trigger and menu */

  function place(trigger, list, align) {
    if (!trigger || !list) return;

    /* Measure at natural size: a previous placement may have capped the
       height, and re-measuring a capped element yields the cap, so the menu
       would ratchet smaller every time it opened. */
    list.style.position = "fixed";
    list.style.maxHeight = "";
    list.style.overflowY = "";
    list.style.right = "auto";
    list.style.bottom = "auto";

    var t = trigger.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var w = list.offsetWidth;
    var h = list.scrollHeight;

    var roomBelow = vh - t.bottom - GAP - MARGIN;
    var roomAbove = t.top - GAP - MARGIN;

    /* Prefer below (the conventional direction, and where the user is
       looking). Flip up only when below cannot hold it AND above is
       genuinely roomier -- flipping into an equally bad space just moves
       the problem and is more disorienting. */
    var top, cap;
    if (h <= roomBelow || roomBelow >= roomAbove) {
      top = t.bottom + GAP;
      cap = roomBelow;
    } else {
      cap = roomAbove;
      top = Math.max(MARGIN, t.top - GAP - Math.min(h, cap));
    }

    /* Still too tall for either side (a long menu on a short screen): cap it
       and let it scroll internally. Better a reachable scrolling menu than
       items rendered past the edge. */
    if (h > cap) {
      list.style.maxHeight = Math.max(0, cap) + "px";
      list.style.overflowY = "auto";
    }

    /* Horizontal: keep the requested anchor, then clamp into the viewport so
       a trigger near either edge cannot push the menu out of reach. */
    var left = align === "left" ? t.left : t.right - w;
    left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - w - MARGIN));

    list.style.top = Math.round(top) + "px";
    list.style.left = Math.round(left) + "px";
  }

  /* A transformed ancestor silently re-parents fixed positioning. Surface it
     on localhost instead of shipping a menu that lands in the wrong place on
     one screen and nobody can explain why. */
  function assertNoFixedTrap(list) {
    if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
    var el = list.parentElement;
    while (el && el !== document.body) {
      var cs = getComputedStyle(el);
      if (
        (cs.transform && cs.transform !== "none") ||
        (cs.filter && cs.filter !== "none") ||
        (cs.perspective && cs.perspective !== "none") ||
        (cs.contain && /paint|layout|strict|content/.test(cs.contain)) ||
        (cs.willChange && /transform|filter|perspective/.test(cs.willChange))
      ) {
        console.warn(
          "[overflow-menu] an ancestor creates a containing block for fixed " +
            "positioning, so this menu is positioned against it, not the viewport:",
          el
        );
        return;
      }
      el = el.parentElement;
    }
  }

  window.PBMenu = { place: place, assertNoFixedTrap: assertNoFixedTrap };

  /* The Alpine component behind partials/overflow-menu.njk. Defined here so
     the macro can be called dozens of times per page without emitting a
     script tag each time. */
  window.overflowMenu = function (align) {
    return {
      open: false,
      _onScroll: null,

      /* Every caller of this macro closes its menu by setting `open = false`
         inline ("@click=\"open = false; doThing()\""), across dozens of call
         sites. Watching the flag rather than exposing a close() method means
         none of them have to change and none can forget -- the listeners are
         released wherever the menu is closed from, including Escape and
         click-outside. */
      init: function () {
        var self = this;
        this.$watch("open", function (v) {
          if (v) self._bind();
          else self._release();
        });
      },

      toggle: function () {
        this.open = !this.open;
      },

      _bind: function () {
        var self = this;
        this.$nextTick(function () {
          var list = self.$refs.list;
          var trigger = self.$refs.trigger;
          if (!list || !trigger) return;
          place(trigger, list, align);
          assertNoFixedTrap(list);

          /* Fixed elements do not travel with the page, so the menu would
             detach from its trigger on scroll. Re-place instead of closing:
             a menu that vanishes because the user nudged a trackpad feels
             broken. rAF-throttled, and bound on capture so it also catches
             scrolling inside the table the row lives in. */
          var ticking = false;
          self._onScroll = function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
              ticking = false;
              if (self.open && self.$refs.list && self.$refs.trigger) {
                place(self.$refs.trigger, self.$refs.list, align);
              }
            });
          };
          window.addEventListener("scroll", self._onScroll, true);
          window.addEventListener("resize", self._onScroll);
        });
      },

      _release: function () {
        if (this._onScroll) {
          window.removeEventListener("scroll", this._onScroll, true);
          window.removeEventListener("resize", this._onScroll);
          this._onScroll = null;
        }
      },
    };
  };
})();
